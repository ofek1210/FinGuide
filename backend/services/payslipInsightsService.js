/**
 * Payslip Insights Service
 *
 * Combines onboarding/profile + last 3 payslips → insights, money-flow breakdown, AI narrative.
 */

const Document = require('../models/Document');
const UserProfile = require('../models/UserProfile');
const { analyzeWithAI } = require('./aiProviderService');
const { enrichSummary, buildMoneyFlow, avgField } = require('../utils/payslipEnrichment');
const { selectRecentPayslipDocuments } = require('../utils/selectRecentPayslipDocuments');

const MIN_PENSION_EMPLOYEE_RATE = 0.075;
const MIN_PENSION_EMPLOYER_RATE = 0.065;
const MAX_DEDUCTION_RATIO = 0.40;

function getSummary(doc) {
  const e = enrichSummary(doc);
  const meta = doc?.metadata || {};
  return {
    gross: e.grossSalary,
    net: e.netSalary,
    tax: e.tax,
    nationalIns: e.nationalInsurance,
    healthIns: e.healthInsurance,
    pensionEmployee: e.pensionEmployee,
    pensionEmployer: e.pensionEmployer,
    trainingFundEmployee: e.studyFundEmployee,
    trainingFundEmployer: e.studyFundEmployer,
    vacationDays: e.vacationDays,
    sickDays: e.sickDays,
    period: meta.periodMonth && meta.periodYear
      ? `${String(meta.periodMonth).padStart(2, '0')}/${meta.periodYear}`
      : null,
  };
}

function buildMoneyFlowNarrative(moneyFlow) {
  if (!moneyFlow) return '';
  const lines = [
    `ברוטו ממוצע: ₪${moneyFlow.avgGross.toLocaleString('he-IL')} → נטו ממוצע: ₪${moneyFlow.avgNet.toLocaleString('he-IL')}`,
    `סה"כ ניכוי מהברוטו: ₪${moneyFlow.totalWithheld.toLocaleString('he-IL')} (${Math.round((moneyFlow.totalWithheld / moneyFlow.avgGross) * 100)}%)`,
    '',
    'פירוט לאן הולך הכסף (ממוצע חודשי):',
  ];
  moneyFlow.items.forEach((item) => {
    lines.push(`• ${item.label}: ₪${item.avgAmount.toLocaleString('he-IL')} (${item.pctOfGross}% מהברוטו, ${item.pctOfGap}% מההפרש)`);
  });
  return lines.join('\n');
}

function buildFallbackNarrative(insights, moneyFlow) {
  if (!moneyFlow) return 'לא נמצאו נתוני שכר מספיקים לניתוח. ודא שהתלושים הועלו ועובדו בהצלחה.';

  const lines = [
    buildMoneyFlowNarrative(moneyFlow),
    '',
    'מסקנה:',
    `מכל ₪${moneyFlow.avgGross.toLocaleString('he-IL')} ברוטו, את/ה מקבל/ת ₪${moneyFlow.avgNet.toLocaleString('he-IL')} ליד — ${moneyFlow.items.length} סוגי ניכוי עיקריים.`,
  ];
  if (insights.length) {
    lines.push('', 'תובנות נוספות:');
    insights.slice(0, 4).forEach(i => lines.push(`• ${i.title}: ${i.recommendation}`));
  }
  return lines.join('\n');
}

function buildInsights(profile, enrichedList, moneyFlow) {
  const insights = [];
  const p = profile || {};
  const personal = p.personal || {};
  const employment = p.employment || {};

  const avgGross = moneyFlow?.avgGross ?? avgField(enrichedList, 'grossSalary');
  const avgNet = moneyFlow?.avgNet ?? avgField(enrichedList, 'netSalary');
  const avgTax = avgField(enrichedList, 'tax');
  const avgPension = avgField(enrichedList, 'pensionEmployee');
  const avgNI = avgField(enrichedList, 'nationalInsurance');

  // ── Money flow headline insight ─────────────────────────────────────
  if (moneyFlow && moneyFlow.totalWithheld > 0) {
    const top = moneyFlow.items[0];
    insights.push({
      id: 'gross_to_net_breakdown',
      severity: 'info',
      category: 'payslip',
      title: `מ-₪${moneyFlow.avgGross.toLocaleString('he-IL')} ברוטו ל-₪${moneyFlow.avgNet.toLocaleString('he-IL')} נטו`,
      description: `₪${moneyFlow.totalWithheld.toLocaleString('he-IL')} ניכויים בחודש בממוצע. ${top ? `הגורם הגדול: ${top.label} (₪${top.avgAmount.toLocaleString('he-IL')}).` : ''}`,
      recommendation: 'ראה את הפירוט המלא למטה — וודא שכל ניכוי תואם את תנאי ההעסקה שלך.',
      financialImpact: moneyFlow.totalWithheld,
      financialImpactLabel: `₪${moneyFlow.totalWithheld.toLocaleString('he-IL')}/חודש ניכויים`,
    });
  }

  // ── Pension employee rate (average) ─────────────────────────────────
  if (avgGross && avgPension != null) {
    const rate = avgPension / avgGross;
    if (rate < MIN_PENSION_EMPLOYEE_RATE) {
      const missing = Math.round((MIN_PENSION_EMPLOYEE_RATE - rate) * avgGross);
      insights.push({
        id: 'pension_rate_low',
        severity: 'warning',
        category: 'payslip',
        title: 'הפרשת פנסיה מתחת למינימום החוקי',
        description: `שיעור הפרשתך לפנסיה הוא ${(rate * 100).toFixed(1)}% (ממוצע 3 חודשים) בעוד המינימום הוא 7.5%.`,
        recommendation: `פנה למעסיקך — ייתכן שמגיע לך ₪${missing.toLocaleString('he-IL')} נוספים לחודש.`,
        financialImpact: missing,
        financialImpactLabel: `₪${missing.toLocaleString('he-IL')}/חודש`,
      });
    }
  }

  // ── Pension employer rate ───────────────────────────────────────────
  const avgPensionEmployer = avgField(enrichedList, 'pensionEmployer');
  if (avgGross && avgPensionEmployer != null) {
    const rate = avgPensionEmployer / avgGross;
    if (rate < MIN_PENSION_EMPLOYER_RATE) {
      insights.push({
        id: 'pension_employer_low',
        severity: 'error',
        category: 'payslip',
        title: 'הפרשת מעסיק לפנסיה נמוכה מהחוק',
        description: `מעסיקך מפריש ${(rate * 100).toFixed(1)}% בממוצע (מינימום: 6.5%).`,
        recommendation: 'זהו הפרה פוטנציאלית של חוק פנסיה חובה — מומלץ לפנות לייעוץ משפטי או ממונה שכר.',
        financialImpact: Math.round((MIN_PENSION_EMPLOYER_RATE - rate) * avgGross),
        financialImpactLabel: `₪${Math.round((MIN_PENSION_EMPLOYER_RATE - rate) * avgGross).toLocaleString('he-IL')}/חודש`,
      });
    }
  }

  // ── Training fund ───────────────────────────────────────────────────
  const avgStudy = avgField(enrichedList, 'studyFundEmployee');
  const avgStudyEmployer = avgField(enrichedList, 'studyFundEmployer');
  if (avgGross) {
    const employerRate = avgStudyEmployer ? (avgStudyEmployer / avgGross) * 100 : null;
    const maxEmployerRate = 7.5;

    if (employerRate != null && employerRate < maxEmployerRate) {
      const gap = ((maxEmployerRate - employerRate) / 100) * avgGross;
      insights.push({
        id: 'study_fund_underutilized',
        severity: 'info',
        category: 'payslip',
        title: 'קרן השתלמות לא ממוצה עד המקסימום',
        description: `מעסיקך מפריש ${employerRate.toFixed(1)}% לקרן ההשתלמות. ניתן להגדיל עד 7.5%.`,
        recommendation: `פנה למעסיקך — חיסכון מס שנתי משוער: ~₪${Math.round(gap * 12).toLocaleString('he-IL')}`,
        financialImpact: Math.round(gap * 12),
        financialImpactLabel: `₪${Math.round(gap * 12).toLocaleString('he-IL')}/שנה`,
      });
    } else if (!avgStudy && !employerRate) {
      insights.push({
        id: 'study_fund_missing',
        severity: 'warning',
        category: 'payslip',
        title: 'אין קרן השתלמות בתלושים',
        description: 'לא נמצאה הפרשה לקרן השתלמות ב-3 התלושים האחרונים.',
        recommendation: 'בדוק מול המעסיק האם קיימת קרן השתלמות ואת תנאי ההפרשה.',
        financialImpact: 14400,
        financialImpactLabel: '₪14,400/שנה פוטנציאל',
      });
    }
  }

  // ── Deduction ratio ─────────────────────────────────────────────────
  if (avgGross && avgTax != null && avgNI != null) {
    const ratio = ((avgTax || 0) + (avgNI || 0)) / avgGross;
    if (ratio > MAX_DEDUCTION_RATIO) {
      insights.push({
        id: 'deduction_ratio_high',
        severity: 'warning',
        category: 'payslip',
        title: 'ניכויי חובה גבוהים',
        description: `${(ratio * 100).toFixed(0)}% מהברוטו מנוכה בממוצע — ייתכן שמגיע לך תיאום מס או נקודות זיכוי.`,
        recommendation: employment.hasMultipleEmployers
          ? 'עם ריבוי מעסיקים — חובה לבצע תיאום מס (טופס 116).'
          : 'בדוק זכאות לנקודות זיכוי: ילדים, תואר, מגורים בפריפריה, תרומות.',
        financialImpact: null,
        financialImpactLabel: null,
      });
    }
  }

  // ── Multiple employers ──────────────────────────────────────────────
  if (employment.hasMultipleEmployers === true) {
    insights.push({
      id: 'multi_employer_tax',
      severity: 'info',
      category: 'payslip',
      title: 'ריבוי מעסיקים — נדרש תיאום מס',
      description: 'עם יותר ממעסיק אחד, כל מעסיק מנכה מס כאילו הוא המעסיק היחיד.',
      recommendation: 'הגש בקשה לתיאום מס בנציבות מס הכנסה. ייתכן שתקבל החזר מס מהותי.',
      financialImpact: null,
      financialImpactLabel: 'פוטנציאל החזר מס',
    });
  }

  // ── Salary trend ────────────────────────────────────────────────────
  const grossSeries = enrichedList.map(e => e.grossSalary).filter(Number.isFinite);
  if (grossSeries.length >= 2) {
    const first = grossSeries[grossSeries.length - 1];
    const last = grossSeries[0];
    const change = (last - first) / first;
    if (Math.abs(change) > 0.1) {
      insights.push({
        id: 'salary_trend',
        severity: change > 0 ? 'info' : 'warning',
        category: 'payslip',
        title: change > 0 ? 'עלייה בשכר בתקופה האחרונה' : 'ירידה בשכר בתקופה האחרונה',
        description: `שכרך ${change > 0 ? 'עלה' : 'ירד'} ב-${Math.abs(change * 100).toFixed(0)}% ב-${grossSeries.length} החודשים האחרונים.`,
        recommendation: change < 0
          ? 'בדוק אם השינוי נובע מעבודה חלקית, בונוס שהסתיים, או שינוי תנאים.'
          : 'עדכן את הפרשות הפנסיה/קרן ההשתלמות בהתאם.',
        financialImpact: Math.abs(Math.round(last - first)),
        financialImpactLabel: `₪${Math.abs(Math.round(last - first)).toLocaleString('he-IL')} שינוי חודשי`,
      });
    }
  }

  // ── Young worker tax refund ─────────────────────────────────────────
  if (personal.age && personal.age < 30) {
    insights.push({
      id: 'young_tax_refund',
      severity: 'info',
      category: 'payslip',
      title: 'זכאות פוטנציאלית להחזר מס',
      description: 'בגיל מתחת ל-30 ישנה לעיתים זכאות להחזר מס (לימודים, נסיעות, ריבוי מעסיקים).',
      recommendation: 'בדוק זכאות דרך מייצג מס או הגשה עצמאית דרך אתר רשות המסים.',
      financialImpact: null,
      financialImpactLabel: 'פוטנציאל החזר',
    });
  }

  return insights;
}

function buildPayslipContextForLLM(profile, payslips, enrichedList, moneyFlow) {
  const lines = [];
  const p = profile || {};
  const personal = p.personal || {};
  const employment = p.employment || {};
  const assets = p.assets || {};

  lines.push('=== פרופיל המשתמש ===');
  if (personal.age) lines.push(`גיל: ${personal.age}`);
  if (personal.maritalStatus) {
    const statusMap = { single: 'רווק/ה', married: 'נשוי/ה', divorced: 'גרוש/ה', widowed: 'אלמן/ה' };
    lines.push(`מצב משפחתי: ${statusMap[personal.maritalStatus] || personal.maritalStatus}`);
  }
  if (personal.childrenCount != null) lines.push(`ילדים: ${personal.childrenCount}`);
  if (personal.isSmoker != null) lines.push(`מעשן/ת: ${personal.isSmoker ? 'כן' : 'לא'}`);
  if (assets.ownsApartment != null) lines.push(`דירה בבעלות: ${assets.ownsApartment ? 'כן' : 'לא, שוכר/ת'}`);
  if (employment.hasMultipleEmployers) lines.push('מספר מעסיקים: כן');
  if (employment.expectedMonthlyGross) {
    lines.push(`שכר חודשי משוער (פרופיל): ₪${employment.expectedMonthlyGross.toLocaleString('he-IL')}`);
  }

  lines.push('', '=== 3 תלושים אחרונים (פרטני) ===');
  payslips.slice(0, 3).forEach((doc, i) => {
    const e = enrichedList[i];
    const s = getSummary(doc);
    const label = s.period || `תלוש ${i + 1}`;
    const parts = [];
    if (e.grossSalary) parts.push(`ברוטו: ₪${e.grossSalary.toLocaleString('he-IL')}`);
    if (e.netSalary) parts.push(`נטו: ₪${e.netSalary.toLocaleString('he-IL')}`);
    if (e.tax) parts.push(`מס: ₪${e.tax.toLocaleString('he-IL')}`);
    if (e.nationalInsurance) parts.push(`ביטוח לאומי: ₪${e.nationalInsurance.toLocaleString('he-IL')}`);
    if (e.pensionEmployee) parts.push(`פנסיה עובד: ₪${e.pensionEmployee.toLocaleString('he-IL')}`);
    if (e.studyFundEmployee) parts.push(`קה"ש: ₪${e.studyFundEmployee.toLocaleString('he-IL')}`);
    lines.push(`${label}: ${parts.join(' | ')}`);
  });

  if (moneyFlow) {
    lines.push('', buildMoneyFlowNarrative(moneyFlow));
  }

  return lines.join('\n');
}

async function generateNarrative(profile, payslips, enrichedList, moneyFlow, insights) {
  const context = buildPayslipContextForLLM(profile, payslips, enrichedList, moneyFlow);
  const insightSummary = insights
    .map(i => `- ${i.title}: ${i.recommendation}`)
    .join('\n');

  const systemPrompt = `אתה יועץ שכר, מס ופנסיה ישראלי מומחה של FinGuide.
משימתך: מחקר מעמיק ("deep dive") על תלושי השכר — במיוחד לענות: "מאיפה נעלם ההפרש בין ברוטו לנטו?"

הניתוח חייב לכלול:
1. פתיחה ברורה: "ברוטו ממוצע X ₪ → נטו ממוצע Y ₪ — הפרש Z ₪ (W%)"
2. פירוט שורה-שורה: לאן הולך כל שקל — מס הכנסה, ביטוח לאומי, מס בריאות, פנסיה, קרן השתלמות — עם סכומים ואחוזים מהברוטו
3. השוואה: האם הניכויים סבירים לפרופיל (גיל, מצב משפחתי, שכר) בישראל 2024-2025?
4. תובנות: החזרי מס אפשריים, חיסכון פנסיוני, קרן השתלמות, חריגות
5. מסקנה והמלצה מעשית — מה לעשות עכשיו

כתוב בעברית, 5-7 פסקאות, ישיר ("שכרך", "ההפרשה שלך"). ציין מספרים מדויקים מהנתונים.`;

  const userPrompt = `${context}\n\n=== תובנות שהתגלו ===\n${insightSummary || 'לא התגלו חריגות מיוחדות.'}\n\nכתוב ניתוח מחקר מעמיק — התמקד בשאלה: לאן הולכים הכספים מהברוטו לנטו?`;

  const result = await analyzeWithAI(systemPrompt, userPrompt, { maxTokens: 1200, temperature: 0.35 });
  return result || buildFallbackNarrative(insights, moneyFlow);
}

async function getPayslipInsights(userId) {
  const [allDocs, profile] = await Promise.all([
    Document.find({
      user: userId,
      status: { $in: ['completed', 'needs_review'] },
      analysisData: { $exists: true, $ne: null },
    })
      .sort({ uploadedAt: -1 })
      .limit(50)
      .lean(),
    UserProfile.findOne({ user: userId }).lean(),
  ]);

  const payslips = selectRecentPayslipDocuments(allDocs, 3);

  if (!payslips.length) {
    return {
      insights: [],
      narrative: 'לא נמצאו תלושי שכר מנותחים. העלה תלושים כדי לקבל תובנות.',
      moneyFlow: null,
      meta: { payslipCount: 0 },
    };
  }

  const enrichedList = payslips.map(enrichSummary);
  const moneyFlow = buildMoneyFlow(enrichedList);
  const insights = buildInsights(profile, enrichedList, moneyFlow);
  const narrative = await generateNarrative(profile, payslips, enrichedList, moneyFlow, insights);

  return {
    insights,
    narrative,
    moneyFlow,
    meta: {
      payslipCount: payslips.length,
      latestGross: enrichedList[0]?.grossSalary,
      latestNet: enrichedList[0]?.netSalary,
      avgGross: moneyFlow?.avgGross ?? avgField(enrichedList, 'grossSalary'),
      avgNet: moneyFlow?.avgNet ?? avgField(enrichedList, 'netSalary'),
      avgTax: avgField(enrichedList, 'tax'),
      profileAge: profile?.personal?.age,
    },
  };
}

module.exports = { getPayslipInsights };
