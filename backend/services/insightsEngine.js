const Document = require('../models/Document');
const Insight = require('../models/Insight');
const { buildPayslipHistoryIntelligence } = require('./payslipHistoryAggregationService');

const SALARY_CHANGE_THRESHOLD = 0.05;
const UNUSUAL_DEDUCTION_THRESHOLD = 0.5;
const RECOMMENDED_PENSION_EMPLOYEE_RATE = 0.06;

function toFinite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pctChange(prev, curr) {
  if (!Number.isFinite(prev) || prev === 0 || !Number.isFinite(curr)) return null;
  return (curr - prev) / prev;
}

function getPensionEmployeeRate(doc) {
  const gross = toFinite(doc?.analysisData?.salary?.gross_total)
    ?? toFinite(doc?.analysisData?.summary?.grossSalary);
  const pension = toFinite(doc?.analysisData?.contributions?.pension?.employee_amount)
    ?? toFinite(doc?.analysisData?.summary?.pensionEmployee);
  if (!gross || !Number.isFinite(pension)) return null;
  return pension / gross;
}

function enrichSummary(doc) {
  const summary = doc?.analysisData?.summary || {};
  const salary = doc?.analysisData?.salary || {};
  const deductions = doc?.analysisData?.deductions?.mandatory || {};
  return {
    grossSalary: toFinite(summary.grossSalary) ?? toFinite(salary.gross_total),
    netSalary: toFinite(summary.netSalary) ?? toFinite(salary.net_payable),
    tax: toFinite(summary.tax) ?? toFinite(deductions.income_tax),
    nationalInsurance: toFinite(summary.nationalInsurance) ?? toFinite(deductions.national_insurance),
    healthInsurance: toFinite(summary.healthInsurance) ?? toFinite(deductions.health_insurance),
    pensionEmployee: toFinite(summary.pensionEmployee)
      ?? toFinite(doc?.analysisData?.contributions?.pension?.employee_amount),
    mandatoryTotal: toFinite(summary.mandatoryDeductionsTotal) ?? toFinite(deductions.total),
  };
}

function buildInsightDraft({ kind, severity, title, description, payload, sourceDocumentIds }) {
  return { kind, severity, title, description, payload: payload || {}, sourceDocumentIds: sourceDocumentIds || [] };
}

async function analyzePayslipTrends(userId, history) {
  const items = history.items || [];
  const drafts = [];
  if (items.length < 2) return drafts;

  const latest = items[0];
  const previous = items[1];
  const grossChange = pctChange(previous.grossSalary, latest.grossSalary);
  const netChange = pctChange(previous.netSalary, latest.netSalary);

  if (grossChange != null && grossChange <= -SALARY_CHANGE_THRESHOLD) {
    drafts.push(
      buildInsightDraft({
        kind: 'salary_drop',
        severity: grossChange <= -0.1 ? 'critical' : 'warning',
        title: 'ירידה בשכר הברוטו',
        description: `שכר הברוטו ירד ב-${Math.abs(Math.round(grossChange * 100))}% לעומת החודש הקודם.`,
        payload: {
          previousValue: previous.grossSalary,
          currentValue: latest.grossSalary,
          changePercent: Math.round(grossChange * 100),
          periodFrom: previous.periodMonth,
          periodTo: latest.periodMonth,
        },
        sourceDocumentIds: [latest.id, previous.id].filter(Boolean),
      }),
    );
  }

  if (netChange != null && netChange >= SALARY_CHANGE_THRESHOLD) {
    drafts.push(
      buildInsightDraft({
        kind: 'salary_growth',
        severity: 'info',
        title: 'עלייה בשכר הנטו',
        description: `שכר הנטו עלה ב-${Math.round(netChange * 100)}% לעומת החודש הקודם.`,
        payload: {
          previousValue: previous.netSalary,
          currentValue: latest.netSalary,
          changePercent: Math.round(netChange * 100),
          periodFrom: previous.periodMonth,
          periodTo: latest.periodMonth,
        },
        sourceDocumentIds: [latest.id, previous.id].filter(Boolean),
      }),
    );
  }

  return drafts;
}

async function analyzePensionContributions(userId, documents) {
  const completed = documents.filter(d => d.status === 'completed');
  if (!completed.length) return [];

  const latest = completed[0];
  const rate = getPensionEmployeeRate(latest);
  const pensionAmt = enrichSummary(latest).pensionEmployee;
  const drafts = [];

  if (pensionAmt === 0 || pensionAmt == null) {
    drafts.push(
      buildInsightDraft({
        kind: 'pension_missing',
        severity: 'critical',
        title: 'לא זוהתה הפרשה לפנסיה',
        description: 'בתלוש האחרון לא נמצאה הפרשת עובד לפנסיה. כדאי לבדוק מול המעסיק.',
        payload: { period: latest.analysisData?.period?.month || null },
        sourceDocumentIds: [latest._id],
      }),
    );
    return drafts;
  }

  if (rate != null && rate < RECOMMENDED_PENSION_EMPLOYEE_RATE - 0.005) {
    drafts.push(
      buildInsightDraft({
        kind: 'pension_low',
        severity: 'warning',
        title: 'הפרשת פנסיה נמוכה מהמומלץ',
        description: `הפרשת העובד לפנסיה היא כ-${Math.round(rate * 100)}%, מתחת ל-6% המומלצים.`,
        payload: {
          currentRate: Math.round(rate * 1000) / 10,
          recommendedRate: RECOMMENDED_PENSION_EMPLOYEE_RATE * 100,
          pensionEmployee: pensionAmt,
        },
        sourceDocumentIds: [latest._id],
      }),
    );
  }

  return drafts;
}

async function detectMissingMonths(userId, history) {
  const stats = history.selectedYearStats;
  if (!stats?.missingMonths?.length) return [];

  const monthNames = ['', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const missingLabels = stats.missingMonths.map(m => monthNames[m]).join(', ');

  return [
    buildInsightDraft({
      kind: 'missing_payslip',
      severity: stats.missingMonths.length >= 3 ? 'warning' : 'info',
      title: 'חסרים תלושי שכר',
      description: `בשנת ${stats.year} חסרים תלושים לחודשים: ${missingLabels}.`,
      payload: {
        year: stats.year,
        missingMonths: stats.missingMonths,
        coveragePercent: stats.coveragePercent,
      },
      sourceDocumentIds: [],
    }),
  ];
}

async function detectUnusualDeductions(userId, documents) {
  const completed = documents.filter(d => d.status === 'completed');
  if (completed.length < 2) return [];

  const latestSummary = enrichSummary(completed[0]);
  const prevSummary = enrichSummary(completed[1]);
  const drafts = [];

  const fields = [
    ['tax', 'מס הכנסה'],
    ['nationalInsurance', 'ביטוח לאומי'],
    ['healthInsurance', 'מס בריאות'],
    ['mandatoryTotal', 'סך ניכויי חובה'],
  ];

  fields.forEach(([key, label]) => {
    const prev = prevSummary[key];
    const curr = latestSummary[key];
    const change = pctChange(prev, curr);
    if (change != null && change >= UNUSUAL_DEDUCTION_THRESHOLD) {
      drafts.push(
        buildInsightDraft({
          kind: 'unusual_deduction',
          severity: 'warning',
          title: `עלייה חריגה ב${label}`,
          description: `${label} עלה ב-${Math.round(change * 100)}% לעומת התלוש הקודם.`,
          payload: {
            field: key,
            previousValue: prev,
            currentValue: curr,
            changePercent: Math.round(change * 100),
          },
          sourceDocumentIds: [completed[0]._id, completed[1]._id],
        }),
      );
    }
  });

  const gross = latestSummary.grossSalary;
  const net = latestSummary.netSalary;
  if (gross && net && net / gross > 0.92) {
    drafts.push(
      buildInsightDraft({
        kind: 'tax_anomaly',
        severity: 'warning',
        title: 'נטו קרוב מאוד לברוטו',
        description: 'הנטו גבוה ביחס לברוטו — ייתכן שחסרים ניכויים או שיש בעיה בניתוח התלוש.',
        payload: { grossSalary: gross, netSalary: net, ratio: Math.round((net / gross) * 100) },
        sourceDocumentIds: [completed[0]._id],
      }),
    );
  }

  return drafts;
}

async function upsertInsights(userId, drafts) {
  const created = [];
  for (const draft of drafts) {
    const existing = await Insight.findOne({
      user: userId,
      kind: draft.kind,
      status: 'active',
      'payload.periodTo': draft.payload?.periodTo ?? undefined,
    });

    if (existing) {
      existing.title = draft.title;
      existing.description = draft.description;
      existing.severity = draft.severity;
      existing.payload = draft.payload;
      existing.sourceDocumentIds = draft.sourceDocumentIds;
      await existing.save();
      created.push(existing);
    } else {
      const insight = await Insight.create({ user: userId, ...draft });
      created.push(insight);
      try {
        const notificationService = require('./notificationService');
        if (notificationService?.notifyInsightCreated) {
          await notificationService.notifyInsightCreated(userId, insight);
        }
      } catch {
        /* notifications optional */
      }
    }
  }
  return created;
}

async function runFullAnalysis(userId) {
  const documents = await Document.find({ user: userId })
    .sort({ uploadedAt: -1 })
    .lean(false);

  const history = buildPayslipHistoryIntelligence(documents);
  const completedDocs = documents.filter(d => d.status === 'completed');

  const drafts = [
    ...(await analyzePayslipTrends(userId, history)),
    ...(await analyzePensionContributions(userId, completedDocs)),
    ...(await detectMissingMonths(userId, history)),
    ...(await detectUnusualDeductions(userId, completedDocs)),
  ];

  return upsertInsights(userId, drafts);
}

module.exports = {
  analyzePayslipTrends,
  analyzePensionContributions,
  detectMissingMonths,
  detectUnusualDeductions,
  runFullAnalysis,
  SALARY_CHANGE_THRESHOLD,
  RECOMMENDED_PENSION_EMPLOYEE_RATE,
};
