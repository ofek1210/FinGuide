const Document = require('../models/Document');
const UserProfile = require('../models/UserProfile');
const Insight = require('../models/Insight');
const Recommendation = require('../models/Recommendation');
const ChatMessage = require('../models/ChatMessage');
const { askLLM } = require('../services/aiService');
const { chat: claudeChat, streamChat: claudeStreamChat, askClaude } = require('../services/claudeChatService');
const { detectSalaryAnomalies } = require('../utils/detectSalaryAnomalies');
const { simulateWhatIf } = require('../utils/simulateWhatIf');
const { selectRecentPayslipDocuments } = require('../utils/selectRecentPayslipDocuments');
const mongoose = require('mongoose');

const RLM = '\u200F';

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizeMessage(message) {
  return String(message || '').trim().toLowerCase();
}

// Client-supplied hint about the screen the user is viewing. Used only to enrich
// the LLM prompt — never for intent detection or as a trusted financial source.
function sanitizePageContext(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 900);
  return trimmed || null;
}

function isSameMonth(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth()
  );
}

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatAmount(value) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return `${Number(value).toLocaleString('he-IL')} ₪`;
}

// Extract what-if change from a Hebrew message, e.g. "אם אקבל 10%" or "עוד 500 שקל"
function parseWhatIfChange(msg) {
  const pctMatch = /(\d+(?:\.\d+)?)\s*(?:%|אחוז)/.exec(msg);
  if (pctMatch) {
    return { type: 'gross_percent', value: parseFloat(pctMatch[1]) / 100 };
  }
  const amtMatch = /(\d[\d,]*(?:\.\d+)?)\s*(?:שקל|ש.ח|₪|ש״ח)/.exec(msg);
  if (amtMatch) {
    return { type: 'gross_amount', value: parseFloat(amtMatch[1].replace(/,/g, '')) };
  }
  // Bare number: ≤100 treated as percent, >100 as amount
  const numMatch = /(\d+(?:\.\d+)?)/.exec(msg);
  if (numMatch) {
    const n = parseFloat(numMatch[1]);
    return n <= 100
      ? { type: 'gross_percent', value: n / 100 }
      : { type: 'gross_amount', value: n };
  }
  return null;
}

// ── intent detection ──────────────────────────────────────────────────────────

function detectIntent(message) {
  const msg = normalizeMessage(message);

  if (msg.includes('שלום') || msg === 'hi' || msg === 'hello' || msg === 'hey') return 'hello';

  // Financial summary / overview
  if (
    msg.includes('סיכום פיננסי') ||
    msg.includes('תן לי סיכום') ||
    msg.includes('מה המצב הפיננסי') ||
    msg.includes('מצב כספי') ||
    (msg.includes('סיכום') && msg.includes('מצב')) ||
    msg === 'summary' || msg === 'summarize'
  ) {
    return 'financial_summary';
  }

  if (msg.includes('כמה מסמכים') && msg.includes('הועלו')) {
    return 'documents_count_month';
  }

  if (msg.includes('תסכם') && msg.includes('מסמכים')) {
    return 'documents_summary';
  }

  if (
    msg.includes('איזו פעולה') ||
    msg.includes('איזה פעולה') ||
    msg.includes('איזה פעולות') ||
    msg.includes('איזו פעולות') ||
    msg.includes('מה הכי חשוב') ||
    msg.includes('מומלץ לבצע') ||
    msg.includes('what should i do') ||
    msg.includes('next steps')
  ) {
    return 'recommended_action';
  }

  if (msg.includes('חריג') || msg.includes('anomaly') || msg.includes('unusual')) {
    return 'anomaly_check';
  }

  if (msg.includes('יש לי ביטוח') || msg.includes('האם יש לי')) {
    return 'profile_insurance';
  }

  // Recommendations: only when asking about *my* specific recommendations, not general insurance questions
  if (
    (msg.includes('המלצ') && (msg.includes('שלי') || msg.includes('לי') || msg.includes('אישי'))) ||
    (msg.includes('ביטוח') && msg.includes('צריך') && !msg.includes('ממוצע') && !msg.includes('כמה עולה') && !msg.includes('כמה משלמים'))
  ) {
    return 'my_recommendations';
  }

  if (msg.includes('התרא') || msg.includes('notification')) {
    return 'my_notifications';
  }

  if (msg.includes('מה השתנה') || msg.includes('what changed') || msg.includes('השינוי')) {
    return 'what_changed';
  }

  if (msg.includes('פנסיה') && (msg.includes('כמה') || msg.includes('שילמתי'))) {
    return 'pension_total';
  }

  if (msg.includes('למה') && (msg.includes('ירד') || msg.includes('ירידה') || msg.includes('פחות'))) {
    return 'salary_why_down';
  }

  if (
    msg.includes('פנסיה') &&
    !msg.includes('ממוצע') &&
    !msg.includes('בארץ') &&
    !msg.includes('בישראל') &&
    !msg.includes('מה זה') &&
    !msg.includes('שיעור')
  ) {
    if (msg.includes('מעסיק')) return 'pension_employer';
    return 'pension_employee';
  }

  if (msg.includes('קרן השתלמות') || msg.includes('study fund') || msg.includes('השתלמות')) {
    return 'training_fund';
  }

  if (msg.includes('נטו') || msg.includes('net salary') || msg.includes('take home')) {
    return 'net_salary';
  }

  if (msg.includes('ברוטו') || msg.includes('gross salary') || msg.includes('gross pay')) {
    return 'gross_salary';
  }

  if (
    (msg.includes('מס הכנסה') || msg.includes('מס שולי') || msg.includes('income tax')) &&
    (msg.includes('שלי') || msg.includes('שילמתי') || msg.includes('ניכו') || msg.includes('בתלוש') || msg.includes('כמה') || msg.includes('how much'))
  ) {
    return 'tax_info';
  }

  if (msg.includes('ביטוח לאומי') || msg.includes('ב.ל') || msg.includes('national insurance') || msg.includes('bituach leumi')) {
    return 'national_insurance';
  }

  if (msg.includes('חופשה') || msg.includes('ימי חופש') || msg.includes('vacation') || msg.includes('days off')) {
    return 'vacation_days';
  }

  if (msg.includes('מחלה') || msg.includes('ימי מחלה') || msg.includes('sick days') || msg.includes('sick leave')) {
    return 'sick_days';
  }

  if (msg.includes('מעסיק') && (msg.includes('שם') || msg.includes('איפה') || msg.includes('אצל מי'))) {
    return 'employer_info';
  }

  if (msg.includes('ניכויי חובה') || msg.includes('כמה מנכים') || msg.includes('סך ניכויים') || msg.includes('deductions')) {
    return 'mandatory_deductions';
  }

  if (
    msg.includes('מה יקרה אם') ||
    msg.includes('כמה אקבל אם') ||
    msg.includes('סימולציה') ||
    msg.includes('simulation') ||
    msg.includes('what if') ||
    (msg.includes('העלאה') && /\d/.test(msg)) ||
    (msg.includes('raise') && /\d/.test(msg))
  ) {
    return 'whatif';
  }

  return 'fallback';
}

// ── document helpers ──────────────────────────────────────────────────────────

function summarizeDocuments(documents) {
  const total = documents.length;
  const completed = documents.filter(d => d.status === 'completed').length;
  const uploaded = documents.filter(d => d.status === 'uploaded').length;
  const failed = documents.filter(d => d.status === 'failed').length;

  const byType = {};
  documents.forEach(d => {
    const t = d.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
  });

  return { total, completed, uploaded, failed, byType };
}

function countDocumentsThisMonth(documents) {
  const now = new Date();
  return documents.filter(d => {
    const at = safeDate(d.uploadedAt);
    return at && isSameMonth(at, now);
  }).length;
}

function getRecommendedAction(documents) {
  if (!documents.length) {
    return 'עדיין לא העלית מסמכים. הפעולה הכי חשובה כרגע היא להעלות תלוש שכר ראשון.';
  }

  const failed = documents.filter(d => d.status === 'failed');
  if (failed.length > 0) {
    return `יש לך ${failed.length} מסמכים שנכשלו בניתוח. כדאי לבדוק אותם או להעלות אותם מחדש.`;
  }

  const pending = documents.filter(d => d.status === 'uploaded' || d.status === 'pending');
  if (pending.length > 0) {
    return `יש לך ${pending.length} מסמכים שהועלו אבל עדיין לא נותחו. המתין לסיום הניתוח.`;
  }

  const hasPayslip = documents.some(d => d.type === 'payslip');
  if (!hasPayslip) {
    return 'כדאי להעלות תלוש שכר כדי שאוכל לנתח את הנתונים הפיננסיים שלך.';
  }

  return 'מצב המסמכים שלך תקין. אפשר לשאול שאלות ספציפיות על שכר, פנסיה, קרן השתלמות או מס.';
}

// ── server-side RAG: build context from DB ────────────────────────────────────

async function buildUserContext(userId) {
  const documents = await Document.find({
    user: userId,
    status: { $in: ['completed', 'needs_review'] },
    analysisData: { $exists: true, $ne: null },
  })
    .select('status uploadedAt processedAt metadata analysisData createdAt updatedAt')
    .sort({ uploadedAt: -1 })
    .limit(50)
    .lean();

  const [profile, insights, recommendations] = await Promise.all([
    UserProfile.findOne({ user: userId }).lean(),
    Insight.find({ user: userId, status: 'active' }).sort({ createdAt: -1 }).limit(5).lean(),
    Recommendation.find({ user: userId, status: 'active' }).sort({ importance: 1 }).limit(5).lean(),
  ]);

  const completedPayslips = selectRecentPayslipDocuments(documents, 3);

  const latestPayslip = completedPayslips[0];
  const fullAnalysis = latestPayslip?.analysisData || {};
  const summary = fullAnalysis.summary || {};

  // Historical payslips (all except the latest) for month-over-month context
  const payslipHistory = completedPayslips.slice(1).map(p => ({
    date: p.analysisData?.summary?.date ?? null,
    grossSalary: p.analysisData?.summary?.grossSalary ?? null,
    netSalary: p.analysisData?.summary?.netSalary ?? null,
    tax: p.analysisData?.summary?.tax ?? null,
    pensionEmployee: p.analysisData?.summary?.pensionEmployee ?? null,
    trainingFundEmployee: p.analysisData?.summary?.trainingFundEmployee ?? null,
  }));

  let pensionAnalysis = null;
  try {
    const analysis = await buildPensionAnalysis(userId);
    pensionAnalysis = toPensionSummary(analysis);
  } catch {
    // Non-fatal — copilot works without pension import data
  }

  let insuranceAnalysis = null;
  try {
    const analysis = await buildInsuranceAnalysis(userId);
    insuranceAnalysis = toInsuranceSummary(analysis);
  } catch {
    // Non-fatal
  }

  return {
    documents: documents.map(d => ({
      status: d.status,
      type: d.metadata?.category || 'unknown',
      uploadedAt: d.uploadedAt,
    })),
    // Salary amounts from OCR summary
    grossSalary: summary.grossSalary ?? null,
    netSalary: summary.netSalary ?? null,
    baseSalary: summary.baseSalary ?? null,
    tax: summary.tax ?? null,
    nationalInsurance: summary.nationalInsurance ?? null,
    healthInsurance: summary.healthInsurance ?? null,
    mandatoryDeductionsTotal: summary.mandatoryDeductionsTotal ?? null,
    pensionEmployee: summary.pensionEmployee ?? null,
    pensionEmployer: summary.pensionEmployer ?? null,
    pensionSeverance: summary.pensionSeverance ?? null,
    trainingFundEmployee: summary.trainingFundEmployee ?? null,
    trainingFundEmployer: summary.trainingFundEmployer ?? null,
    jobPercentage: summary.jobPercentage ?? null,
    employeeName: summary.employeeName ?? null,
    employerName: summary.employerName ?? null,
    payslipDate: summary.date ?? null,
    // Leave and work data
    vacationDays: summary.vacationDays ?? null,
    sickDays: summary.sickDays ?? null,
    workingDays: summary.workingDays ?? null,
    workingHours: summary.workingHours ?? null,
    // Salary components (overtime, bonus, etc.)
    salaryComponents: fullAnalysis.salary?.components ?? null,
    // Rates/percents where OCR extracts them
    trainingFundEmployeePercent: fullAnalysis.contributions?.study_fund?.employee_rate_percent ?? null,
    trainingFundEmployerPercent: fullAnalysis.contributions?.study_fund?.employer_rate_percent ?? null,
    marginalTaxRate: fullAnalysis.tax?.marginal_tax_rate_percent ?? null,
    taxCreditPoints: fullAnalysis.tax?.tax_credit_points ?? null,
    // Prior payslips for trend questions
    payslipHistory,
    profile,
    insights,
    recommendations,
    pensionAnalysis,
    insuranceAnalysis,
  };
}

// ── rule-based answers ────────────────────────────────────────────────────────
// Returns a string, or null to signal "use LLM"

function buildRuleBasedAnswer(intent, ctx) {
  const docs = ctx.documents || [];

  switch (intent) {
    case 'hello':
      return 'שלום! אני העוזר הפיננסי של FinGuide. אפשר לשאול אותי על תלוש השכר, הפנסיה, קרן ההשתלמות או מצב המסמכים שלך.';

    case 'financial_summary': {
      const parts = ['**סיכום מצב פיננסי:**'];
      const gross = formatAmount(ctx.grossSalary);
      const net = formatAmount(ctx.netSalary);
      const tax = formatAmount(ctx.tax);
      const pensionEmp = formatAmount(ctx.pensionEmployee);
      const fundEmp = formatAmount(ctx.trainingFundEmployee);

      if (gross) parts.push(`- שכר ברוטו: ${gross}`);
      if (net) parts.push(`- שכר נטו: ${net}`);
      if (tax) parts.push(`- מס הכנסה: ${tax}`);
      if (ctx.marginalTaxRate != null) parts.push(`- שיעור מס שולי: ${ctx.marginalTaxRate}%`);
      if (pensionEmp) parts.push(`- הפרשה לפנסיה (עובד): ${pensionEmp}`);
      if (fundEmp) {
        const pct = ctx.trainingFundEmployeePercent;
        parts.push(`- קרן השתלמות: ${fundEmp}${pct != null ? ` (${pct}%)` : ''}`);
      }
      if (ctx.vacationDays != null) parts.push(`- יתרת ימי חופשה: ${ctx.vacationDays}`);

      const docs = ctx.documents || [];
      const completed = docs.filter(d => d.status === 'completed').length;
      if (docs.length) parts.push(`- מסמכים: ${completed} נותחו מתוך ${docs.length}`);

      const insights = ctx.insights || [];
      if (insights.length) {
        parts.push('', '**תובנות פעילות:**');
        insights.slice(0, 3).forEach(i => parts.push(`- ${i.title}: ${i.description}`));
      }

      if (parts.length <= 2) {
        return null; // Not enough data — use LLM for better context
      }

      return parts.join('\n');
    }

    case 'documents_count_month': {
      const count = countDocumentsThisMonth(docs);
      return `בחודש הנוכחי הועלו ${count} מסמכים.`;
    }

    case 'documents_summary': {
      if (!docs.length) {
        return 'אין לי עדיין מסמכים לסכם. העלה תלוש שכר והמערכת תנתח אותו.';
      }
      const s = summarizeDocuments(docs);
      const typeParts = Object.entries(s.byType)
        .map(([type, count]) => `${count} מסוג ${type}`)
        .join(', ');
      return `יש לך ${s.total} מסמכים. ${s.completed} נותחו, ${s.uploaded} ממתינים${s.failed ? `, ${s.failed} נכשלו` : ''}. סוגים: ${typeParts}.`;
    }

    case 'recommended_action':
      return getRecommendedAction(docs);

    case 'anomaly_check': {
      const gross = ctx.grossSalary;
      const net = ctx.netSalary;
      if (gross == null || net == null) {
        return 'אין לי נתוני שכר מנותחים. העלה תלוש שכר כדי שאוכל לבדוק חריגות.';
      }
      const { hasAnomalies, anomalies } = detectSalaryAnomalies({ grossSalary: gross, netSalary: net });
      if (!hasAnomalies) {
        return `לא זיהיתי חריגות בתלוש האחרון שלך (ברוטו ${formatAmount(gross)}, נטו ${formatAmount(net)}).`;
      }
      const msgMap = {
        NET_TOO_CLOSE_TO_GROSS: 'הנטו קרוב מאוד לברוטו — ייתכן שחסרים ניכויים.',
        GROSS_UNUSUALLY_HIGH: `שכר הברוטו (${formatAmount(gross)}) גבוה מהרגיל.`,
        GROSS_UNUSUALLY_LOW: `שכר הברוטו (${formatAmount(gross)}) נמוך מאוד.`,
        ZERO_DEDUCTIONS: 'לא זוהו ניכויים בתלוש — כדאי לבדוק זאת.',
      };
      const parts = anomalies.map(a => msgMap[a.code] || a.message);
      return `${parts.length > 1 ? 'כמה נקודות לתשומת לב' : 'נקודה לתשומת לב'}:\n${parts.map(p => `• ${p}`).join('\n')}`;
    }

    case 'pension_employee': {
      const amt = formatAmount(ctx.pensionEmployee);
      if (!amt) return 'אין לי נתוני הפרשת עובד לפנסיה בתלוש האחרון.';
      return `לפי תלוש השכר האחרון, הפרשת העובד לפנסיה היא ${amt}.`;
    }

    case 'pension_employer': {
      const amt = formatAmount(ctx.pensionEmployer);
      if (!amt) return 'אין לי נתוני הפרשת מעסיק לפנסיה בתלוש האחרון.';
      return `לפי תלוש השכר האחרון, הפרשת המעסיק לפנסיה היא ${amt}.`;
    }

    case 'training_fund': {
      const empAmt = formatAmount(ctx.trainingFundEmployee);
      const emplAmt = formatAmount(ctx.trainingFundEmployer);
      if (!empAmt && !emplAmt) {
        return 'לא מצאתי נתוני קרן השתלמות בתלוש האחרון.';
      }
      const empPct = ctx.trainingFundEmployeePercent;
      const emplPct = ctx.trainingFundEmployerPercent;
      const lines = ['לפי תלוש השכר האחרון:'];
      if (empAmt) lines.push(`• עובד: ${empAmt}${empPct != null ? ` (${empPct}%)` : ''}`);
      if (emplAmt) lines.push(`• מעסיק: ${emplAmt}${emplPct != null ? ` (${emplPct}%)` : ''}`);
      return lines.join('\n');
    }

    case 'net_salary': {
      const amt = formatAmount(ctx.netSalary);
      if (!amt) return 'אין לי נתוני שכר נטו בתלוש האחרון.';
      return `לפי תלוש השכר האחרון, שכר הנטו שלך הוא ${amt}.`;
    }

    case 'gross_salary': {
      const amt = formatAmount(ctx.grossSalary);
      if (!amt) return 'אין לי נתוני שכר ברוטו בתלוש האחרון.';
      return `לפי תלוש השכר האחרון, שכר הברוטו שלך הוא ${amt}.`;
    }

    case 'tax_info': {
      const tax = formatAmount(ctx.tax);
      if (!tax) return 'אין לי נתוני מס הכנסה בתלוש האחרון.';
      const rate = ctx.marginalTaxRate;
      return `לפי תלוש השכר האחרון, מס הכנסה: ${tax}${rate != null ? ` (שיעור שולי: ${rate}%)` : ''}.`;
    }

    case 'national_insurance': {
      const ni = formatAmount(ctx.nationalInsurance);
      const hi = formatAmount(ctx.healthInsurance);
      if (!ni && !hi) return 'אין לי נתוני ביטוח לאומי בתלוש האחרון.';
      const lines = ['לפי תלוש השכר האחרון:'];
      if (ni) lines.push(`• ביטוח לאומי: ${ni}`);
      if (hi) lines.push(`• ביטוח בריאות: ${hi}`);
      return lines.join('\n');
    }

    case 'vacation_days': {
      const days = ctx.vacationDays;
      if (days == null) return 'אין לי נתוני ימי חופשה מהתלוש האחרון.';
      return `לפי תלוש השכר האחרון, יתרת ימי החופשה שלך היא ${days} ימים.`;
    }

    case 'sick_days': {
      const days = ctx.sickDays;
      if (days == null) return 'אין לי נתוני ימי מחלה מהתלוש האחרון.';
      return `לפי תלוש השכר האחרון, יתרת ימי המחלה שלך היא ${days} ימים.`;
    }

    case 'employer_info': {
      const name = ctx.employerName;
      if (!name) return 'אין לי מידע על שם המעסיק מהתלוש האחרון.';
      return `לפי תלוש השכר האחרון, שם המעסיק הוא ${name}.`;
    }

    case 'mandatory_deductions': {
      const total = formatAmount(ctx.mandatoryDeductionsTotal);
      if (!total) return 'אין לי נתוני ניכויי חובה מהתלוש האחרון.';
      const parts = [`סה"כ ניכויי חובה: ${total}`];
      const tax = formatAmount(ctx.tax);
      const ni = formatAmount(ctx.nationalInsurance);
      const hi = formatAmount(ctx.healthInsurance);
      if (tax) parts.push(`• מס הכנסה: ${tax}`);
      if (ni) parts.push(`• ביטוח לאומי: ${ni}`);
      if (hi) parts.push(`• מס בריאות: ${hi}`);
      return `לפי תלוש השכר האחרון:\n${parts.join('\n')}`;
    }

    case 'my_recommendations': {
      const recs = ctx.recommendations || [];
      if (!recs.length) return 'אין כרגע המלצות ביטוח פעילות. השלם/י את ה-onboarding או העלה תלוש לקבלת המלצות.';
      const lines = recs.map(r => `• ${r.title} (${r.importance})`);
      return `ההמלצות הפעילות שלך:\n${lines.join('\n')}\n\nלפרטים מלאים: עמוד הביטוחים.`;
    }

    case 'my_notifications': {
      return 'לצפייה בהתראות, לחץ/י על הפעמון בראש הדף או עבור/י לעמוד ההתראות.';
    }

    case 'profile_insurance': {
      const ins = ctx.profile?.insurance || {};
      const labels = {
        hasLifeInsurance: 'ביטוח חיים',
        hasHealthInsurance: 'ביטוח בריאות',
        hasDisabilityInsurance: 'אובדן כושר',
        hasApartmentInsurance: 'ביטוח דירה',
        hasCarInsurance: 'ביטוח רכב',
      };
      const lines = Object.entries(labels).map(([k, label]) => {
        const val = ins[k];
        if (val == null) return `• ${label}: לא ידוע`;
        return `• ${label}: ${val ? 'כן' : 'לא'}`;
      });
      return `לפי הפרופיל שלך:\n${lines.join('\n')}`;
    }

    case 'what_changed': {
      const insight = (ctx.insights || []).find(i =>
        ['salary_drop', 'salary_growth', 'unusual_deduction'].includes(i.kind),
      );
      if (insight) return `${insight.title}: ${insight.description}`;
      const hist = ctx.payslipHistory?.[0];
      if (hist && ctx.grossSalary != null && hist.grossSalary != null) {
        const diff = ctx.grossSalary - hist.grossSalary;
        if (diff !== 0) {
          return `הברוטו ${diff > 0 ? 'עלה' : 'ירד'} ב-${formatAmount(Math.abs(diff))} לעומת התלוש הקודם.`;
        }
        return 'לא זוהו שינויים משמעותיים בברוטו לעומת התלוש הקודם.';
      }
      return 'אין מספיק תלושים להשוואה. העלה/י לפחות שני תלושים.';
    }

    case 'salary_why_down': {
      const drop = (ctx.insights || []).find(i => i.kind === 'salary_drop');
      if (drop) return drop.description;
      return 'לא זוהתה ירידת שכר בתלושים האחרונים. ייתכן שהשינוי קטן או שחסר תלוש להשוואה.';
    }

    case 'pension_total': {
      const emp = formatAmount(ctx.pensionEmployee);
      const empl = formatAmount(ctx.pensionEmployer);
      if (!emp && !empl) return 'לא מצאתי נתוני פנסיה בתלוש האחרון.';
      const lines = [];
      if (emp) lines.push(`הפרשת עובד: ${emp}`);
      if (empl) lines.push(`הפרשת מעסיק: ${empl}`);
      return `לפי התלוש האחרון:\n${lines.join('\n')}`;
    }

    default:
      return null; // use LLM
  }
}

// ── main handler ──────────────────────────────────────────────────────────────

async function saveChatMessage(userId, conversationId, role, content, metadata) {
  return ChatMessage.create({
    user: userId,
    conversationId,
    role,
    content,
    metadata: metadata || {},
  });
}

async function getChatHistory(userId, conversationId, limit = 10) {
  return ChatMessage.find({ user: userId, conversationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .then(msgs => msgs.reverse());
}

async function chatWithAI(req, res) {
  const { message, history, conversationId: clientConversationId } = req.body;
  const pageContext = sanitizePageContext(req.body.pageContext);

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, message: 'message is required (string)' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ success: false, message: 'message too long (max 2000 chars)' });
  }

  const conversationId = clientConversationId && mongoose.Types.ObjectId.isValid(clientConversationId)
    ? new mongoose.Types.ObjectId(clientConversationId)
    : new mongoose.Types.ObjectId();

  const userContext = await buildUserContext(req.user._id);
  const intent = detectIntent(message);

  let finalAnswer;
  let source;
  let model = null;
  let tokensUsed = null;
  const contextUsed = [];

  if (userContext.profile) contextUsed.push('profile');
  if (userContext.documents?.length) contextUsed.push(`${userContext.documents.length} documents`);
  if (userContext.insights?.length) contextUsed.push(`${userContext.insights.length} insights`);
  if (userContext.recommendations?.length) contextUsed.push(`${userContext.recommendations.length} recommendations`);

  const dbHistory = await getChatHistory(req.user._id, conversationId);
  const mergedHistory = dbHistory.length
    ? dbHistory.map(m => ({ role: m.role, content: m.content }))
    : (Array.isArray(history) ? history : []);

  if (intent === 'whatif') {
    const change = parseWhatIfChange(normalizeMessage(message));
    if (!change || userContext.grossSalary == null || userContext.netSalary == null) {
      finalAnswer = 'אין לי מספיק נתונים לחשב סימולציה. יש לוודא שתלוש שכר נותח ולציין אחוז או סכום, למשל: "מה יקרה אם אקבל העלאה של 10%?"';
    } else {
      try {
        const sim = simulateWhatIf({
          gross: userContext.grossSalary,
          net: userContext.netSalary,
          change,
          creditPoints: userContext.taxCreditPoints || undefined,
        });
        const label = change.type === 'gross_percent'
          ? `העלאה של ${change.value * 100}%`
          : `תוספת של ${formatAmount(change.value)}`;
        finalAnswer =
          `לפי הסימולציה, ${label} תביא לברוטו של ${formatAmount(sim.scenario.gross)} ` +
          `ולנטו משוער של ${formatAmount(sim.scenario.net)} ` +
          `(עלייה של כ-${formatAmount(sim.delta.net)} בנטו).\n` +
          `החישוב מבוסס על מדרגות מס 2026 וניכויי חובה. הסכום בפועל עשוי להשתנות מעט.`;
      } catch {
        finalAnswer = 'לא הצלחתי לחשב את הסימולציה. בדוק שהנתונים בתלוש תקינים.';
      }
    }
    source = 'rule';
  } else if (intent === 'hello') {
    finalAnswer = buildRuleBasedAnswer(intent, userContext);
    source = 'rule';
  } else {
    const ruleAnswer = buildRuleBasedAnswer(intent, userContext);
    if (ruleAnswer === null) {
      const chatResult = await claudeChat(message, {
        userContext,
        profile: userContext.profile,
        insights: userContext.insights,
        recommendations: userContext.recommendations,
        history: mergedHistory,
        pageContext,
      });
      finalAnswer = chatResult.answer || 'השירות אינו זמין כרגע. אנא נסה שנית בקרוב, או שאל שאלה ספציפית כמו "כמה נטו?", "כמה פנסיה?".';
      source = chatResult.source;
      model = chatResult.model;
      tokensUsed = chatResult.tokensUsed;
    } else {
      finalAnswer = ruleAnswer;
      source = 'rule';
    }
  }

  // Safety net: should never reach here, but guard against undefined
  if (!finalAnswer) {
    finalAnswer = 'לא הצלחתי לענות כרגע. נסה שוב או שאל שאלה ספציפית.';
    source = 'rule';
  }

  await saveChatMessage(req.user._id, conversationId, 'user', message, { intent });
  await saveChatMessage(req.user._id, conversationId, 'assistant', finalAnswer, {
    intent,
    contextUsed,
    model,
    tokensUsed,
  });

  return res.json({
    success: true,
    answer: `${RLM}${finalAnswer}`,
    intent,
    source,
    conversationId: conversationId.toString(),
    contextUsed,
  });
}

async function getChatHistoryHandler(req, res) {
  const conversationId = req.query.conversationId;
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    return res.status(400).json({ success: false, message: 'conversationId required' });
  }

  const messages = await ChatMessage.find({
    user: req.user._id,
    conversationId,
    role: { $in: ['user', 'assistant'] },
  })
    .sort({ createdAt: 1 })
    .limit(50)
    .lean();

  return res.json({ success: true, data: messages, conversationId });
}

async function listConversations(req, res) {
  const conversations = await ChatMessage.aggregate([
    { $match: { user: req.user._id, role: 'user' } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$conversationId',
        lastMessage: { $first: '$content' },
        updatedAt: { $first: '$createdAt' },
      },
    },
    { $sort: { updatedAt: -1 } },
    { $limit: 20 },
  ]);

  return res.json({
    success: true,
    data: conversations.map(c => ({
      conversationId: c._id.toString(),
      preview: c.lastMessage,
      updatedAt: c.updatedAt,
    })),
  });
}

// ── streaming handler ─────────────────────────────────────────────────────────

async function chatWithAIStream(req, res) {
  const { message, history, conversationId: clientConversationId } = req.body;
  const pageContext = sanitizePageContext(req.body.pageContext);

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, message: 'message is required (string)' });
  }
  if (message.length > 2000) {
    return res.status(400).json({ success: false, message: 'message too long (max 2000 chars)' });
  }

  const conversationId = clientConversationId && mongoose.Types.ObjectId.isValid(clientConversationId)
    ? new mongoose.Types.ObjectId(clientConversationId)
    : new mongoose.Types.ObjectId();

  const userContext = await buildUserContext(req.user._id);
  const intent = detectIntent(message);

  const dbHistory = await getChatHistory(req.user._id, conversationId);
  const mergedHistory = dbHistory.length
    ? dbHistory.map(m => ({ role: m.role, content: m.content }))
    : (Array.isArray(history) ? history : []);

  // Rule-based intents: resolve immediately without streaming
  let ruleAnswer = null;
  if (intent === 'whatif') {
    const change = parseWhatIfChange(normalizeMessage(message));
    if (!change || userContext.grossSalary == null || userContext.netSalary == null) {
      ruleAnswer = 'אין לי מספיק נתונים לחשב סימולציה. יש לוודא שתלוש שכר נותח ולציין אחוז או סכום, למשל: "מה יקרה אם אקבל העלאה של 10%?"';
    } else {
      try {
        const sim = simulateWhatIf({
          gross: userContext.grossSalary,
          net: userContext.netSalary,
          change,
          creditPoints: userContext.taxCreditPoints || undefined,
        });
        const label = change.type === 'gross_percent'
          ? `העלאה של ${change.value * 100}%`
          : `תוספת של ${formatAmount(change.value)}`;
        ruleAnswer =
          `לפי הסימולציה, ${label} תביא לברוטו של ${formatAmount(sim.scenario.gross)} ` +
          `ולנטו משוער של ${formatAmount(sim.scenario.net)} ` +
          `(עלייה של כ-${formatAmount(sim.delta.net)} בנטו).\n` +
          `החישוב מבוסס על מדרגות מס 2026 וניכויי חובה. הסכום בפועל עשוי להשתנות מעט.`;
      } catch {
        ruleAnswer = 'לא הצלחתי לחשב את הסימולציה. בדוק שהנתונים בתלוש תקינים.';
      }
    }
  } else if (intent !== 'fallback') {
    ruleAnswer = buildRuleBasedAnswer(intent, userContext);
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send conversationId immediately so frontend can track it
  sendEvent({ type: 'meta', conversationId: conversationId.toString(), intent });

  await saveChatMessage(req.user._id, conversationId, 'user', message, { intent });

  if (ruleAnswer !== null) {
    // Rule-based: send as a single token then done
    sendEvent({ type: 'token', token: `${RLM}${ruleAnswer}` });
    sendEvent({ type: 'done', source: 'rule' });
    await saveChatMessage(req.user._id, conversationId, 'assistant', ruleAnswer, {
      intent, contextUsed: [], model: null, tokensUsed: null,
    });
    res.end();
    return;
  }

  // LLM streaming
  let fullAnswer = '';
  try {
    await claudeStreamChat(
      message,
      {
        userContext,
        profile: userContext.profile,
        insights: userContext.insights,
        recommendations: userContext.recommendations,
        history: mergedHistory,
        pageContext,
      },
      (token) => {
        fullAnswer += token;
        sendEvent({ type: 'token', token });
      },
      async (full, tokensUsed, meta = {}) => {
        const source = meta.source || 'claude';
        const model = meta.model || null;
        sendEvent({ type: 'done', source, tokensUsed });
        await saveChatMessage(req.user._id, conversationId, 'assistant', full, {
          intent, contextUsed: [], model, tokensUsed,
        });
        res.end();
      },
    );
  } catch {
    sendEvent({ type: 'error', message: 'שגיאה בעיבוד התשובה.' });
    res.end();
  }
}

// ── AI financial tips for dashboard ──────────────────────────────────────────

async function getFinancialTips(req, res) {
  try {
    const userContext = await buildUserContext(req.user._id);
    const tips = buildPersonalizedTips(userContext);

    // If Claude is available, enhance tips with LLM
    if (process.env.ANTHROPIC_API_KEY) {
      const systemPrompt = [
        'אתה יועץ פיננסי של FinGuide. על בסיס נתוני המשתמש, תן 3 טיפים פיננסיים קצרים, ממוקדים ואקשנבל.',
        'פורמט: JSON מערך של { tip: string, category: string, priority: "high"|"medium"|"low" }.',
        'קטגוריות אפשריות: pension, tax, savings, insurance, documents.',
        'ענה רק ב-JSON, ללא טקסט נוסף.',
        '',
        'נתוני משתמש:',
        buildUserContextSummary(userContext),
      ].join('\n');

      try {
        const result = await askClaude('תן לי 3 טיפים פיננסיים אישיים', systemPrompt, []);
        if (result?.answer) {
          const jsonMatch = result.answer.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const llmTips = JSON.parse(jsonMatch[0]);
            if (Array.isArray(llmTips) && llmTips.length > 0) {
              return res.json({ success: true, data: { tips: llmTips, source: 'claude', staticTips: tips } });
            }
          }
        }
      } catch {
        // Fall through to rule-based tips
      }
    }

    return res.json({ success: true, data: { tips, source: 'rule' } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'שגיאה בטעינת טיפים', error: err.message });
  }
}

function buildUserContextSummary(ctx) {
  const lines = [];
  if (ctx.grossSalary) lines.push(`ברוטו: ₪${ctx.grossSalary}`);
  if (ctx.netSalary) lines.push(`נטו: ₪${ctx.netSalary}`);
  if (ctx.pensionEmployee) lines.push(`פנסיה עובד: ₪${ctx.pensionEmployee}`);
  if (ctx.trainingFundEmployee) lines.push(`קרן השתלמות: ₪${ctx.trainingFundEmployee}`);
  if (ctx.tax) lines.push(`מס הכנסה: ₪${ctx.tax}`);
  if (ctx.marginalTaxRate) lines.push(`שיעור מס שולי: ${ctx.marginalTaxRate}%`);
  if (ctx.documents?.length) lines.push(`מסמכים: ${ctx.documents.length}`);
  if (ctx.insights?.length) lines.push(`תובנות: ${ctx.insights.slice(0,3).map(i => i.title).join(', ')}`);
  if (ctx.pensionAnalysis?.healthScore != null) {
    lines.push(`ציון בריאות פנסיונית: ${ctx.pensionAnalysis.healthScore}/100`);
  }
  if (ctx.pensionAnalysis?.totalPotentialSavings > 0) {
    lines.push(`חיסכון פוטנציאלי עד פרישה: ₪${Math.round(ctx.pensionAnalysis.totalPotentialSavings).toLocaleString('he-IL')}`);
  }
  if (ctx.pensionAnalysis?.topRecs?.length) {
    lines.push(`המלצות פנסיה: ${ctx.pensionAnalysis.topRecs.join(', ')}`);
  }
  if (ctx.insuranceAnalysis?.healthScore != null) {
    lines.push(`ציון בריאות ביטוח: ${ctx.insuranceAnalysis.healthScore}/100`);
  }
  if (ctx.insuranceAnalysis?.duplicateCount > 0) {
    lines.push(`כפילויות ביטוח: ${ctx.insuranceAnalysis.duplicateCount}`);
  }
  return lines.join('\n') || 'אין עדיין נתונים';
}

function buildPersonalizedTips(ctx) {
  const tips = [];

  // Check pension contribution rate
  if (ctx.grossSalary && ctx.pensionEmployee) {
    const rate = ctx.pensionEmployee / ctx.grossSalary;
    if (rate < 0.06) {
      tips.push({
        tip: `שיעור הפרשת הפנסיה שלך (${Math.round(rate * 100)}%) נמוך מהמינימום המומלץ (6%). כדאי לבדוק עם המעסיק.`,
        category: 'pension',
        priority: 'high',
      });
    }
  }

  // Check training fund
  if (ctx.grossSalary && !ctx.trainingFundEmployee) {
    tips.push({
      tip: 'לא זוהתה הפרשה לקרן השתלמות בתלוש. קרן השתלמות היא הטבת מס משמעותית — כדאי לבדוק.',
      category: 'savings',
      priority: 'high',
    });
  }

  // Anomaly detection
  if (ctx.grossSalary && ctx.netSalary) {
    const { hasAnomalies } = detectSalaryAnomalies({
      grossSalary: ctx.grossSalary,
      netSalary: ctx.netSalary,
    });
    if (hasAnomalies) {
      tips.push({
        tip: 'זוהו חריגות אפשריות בתלוש השכר האחרון שלך. מומלץ לבדוק את פרטי הניכויים.',
        category: 'documents',
        priority: 'high',
      });
    }
  }

  // Tax rate tip
  if (ctx.marginalTaxRate && ctx.marginalTaxRate >= 35) {
    tips.push({
      tip: `שיעור המס השולי שלך הוא ${ctx.marginalTaxRate}%. ייתכן שניתן לחסוך מס על ידי הגדלת ההפרשה לפנסיה או קרן השתלמות.`,
      category: 'tax',
      priority: 'medium',
    });
  }

  // Vacation days
  if (ctx.vacationDays != null && ctx.vacationDays > 20) {
    tips.push({
      tip: `יש לך ${ctx.vacationDays} ימי חופשה שצבורים. שים לב לא לאבד ימים בסוף שנה.`,
      category: 'documents',
      priority: 'medium',
    });
  }

  // Documents tip
  const failedDocs = (ctx.documents || []).filter(d => d.status === 'failed');
  if (failedDocs.length) {
    tips.push({
      tip: `${failedDocs.length} מסמכים נכשלו בניתוח. העלה אותם מחדש לקבלת תובנות מלאות.`,
      category: 'documents',
      priority: 'high',
    });
  }

  // Default tip if nothing specific
  if (tips.length === 0) {
    tips.push(
      { tip: 'העלה תלושי שכר נוספים כדי לאפשר ניתוח מגמות ותובנות חכמות.', category: 'documents', priority: 'medium' },
      { tip: 'השלם את פרופיל הביטוחים שלך לקבלת המלצות ביטוח מותאמות אישית.', category: 'insurance', priority: 'low' },
    );
  }

  return tips.slice(0, 4);
}

module.exports = { chatWithAI, chatWithAIStream, getChatHistoryHandler, listConversations, getFinancialTips, detectIntent };
