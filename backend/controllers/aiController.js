const Document = require('../models/Document');
const { polishHebrewAnswer, askLLM } = require('../services/aiService');
const { detectSalaryAnomalies } = require('../utils/detectSalaryAnomalies');

const RLM = '\u200F';

// ── helpers ──────────────────────────────────────────────────────────────────

function normalizeMessage(message) {
  return String(message || '').trim().toLowerCase();
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

// ── intent detection ──────────────────────────────────────────────────────────

function detectIntent(message) {
  const msg = normalizeMessage(message);

  if (msg.includes('שלום')) return 'hello';

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
    msg.includes('מומלץ לבצע')
  ) {
    return 'recommended_action';
  }

  if (msg.includes('חריג')) {
    return 'anomaly_check';
  }

  if (msg.includes('פנסיה')) {
    if (msg.includes('מעסיק')) return 'pension_employer';
    return 'pension_employee';
  }

  if (msg.includes('קרן השתלמות')) {
    return 'training_fund';
  }

  if (msg.includes('נטו')) {
    return 'net_salary';
  }

  if (msg.includes('ברוטו')) {
    return 'gross_salary';
  }

  if (msg.includes('מס הכנסה') || msg.includes('מס שולי')) {
    return 'tax_info';
  }

  if (msg.includes('ביטוח לאומי') || msg.includes('ב.ל')) {
    return 'national_insurance';
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
  const documents = await Document.find({ user: userId })
    .select('status uploadedAt metadata analysisData')
    .sort({ uploadedAt: -1 })
    .lean();

  // Most recent successfully analyzed payslip
  const latestPayslip = documents.find(
    d =>
      d.status === 'completed' &&
      d.metadata?.category === 'payslip' &&
      d.analysisData?.summary,
  );

  const fullAnalysis = latestPayslip?.analysisData || {};
  const summary = fullAnalysis.summary || {};

  return {
    documents: documents.map(d => ({
      status: d.status,
      type: d.metadata?.category || 'unknown',
      uploadedAt: d.uploadedAt,
    })),
    // Salary amounts from OCR summary
    grossSalary: summary.grossSalary ?? null,
    netSalary: summary.netSalary ?? null,
    tax: summary.tax ?? null,
    nationalInsurance: summary.nationalInsurance ?? null,
    healthInsurance: summary.healthInsurance ?? null,
    pensionEmployee: summary.pensionEmployee ?? null,
    pensionEmployer: summary.pensionEmployer ?? null,
    trainingFundEmployee: summary.trainingFundEmployee ?? null,
    trainingFundEmployer: summary.trainingFundEmployer ?? null,
    jobPercentage: summary.jobPercentage ?? null,
    employeeName: summary.employeeName ?? null,
    payslipDate: summary.date ?? null,
    // Rates/percents where OCR extracts them
    trainingFundEmployeePercent: fullAnalysis.contributions?.study_fund?.employee_rate_percent ?? null,
    trainingFundEmployerPercent: fullAnalysis.contributions?.study_fund?.employer_rate_percent ?? null,
    marginalTaxRate: fullAnalysis.tax?.marginal_tax_rate_percent ?? null,
    taxCreditPoints: fullAnalysis.tax?.tax_credit_points ?? null,
  };
}

// ── rule-based answers ────────────────────────────────────────────────────────
// Returns a string, or null to signal "use LLM"

function buildRuleBasedAnswer(intent, ctx) {
  const docs = ctx.documents || [];

  switch (intent) {
    case 'hello':
      return 'שלום! אני העוזר הפיננסי של FinGuide. אפשר לשאול אותי על תלוש השכר, הפנסיה, קרן ההשתלמות או מצב המסמכים שלך.';

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

    default:
      return null; // use LLM
  }
}

// ── main handler ──────────────────────────────────────────────────────────────

async function chatWithAI(req, res) {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ success: false, message: 'message is required (string)' });
  }

  // Server-side RAG: always fetch from DB, never trust client userData
  const userContext = await buildUserContext(req.user._id);
  const intent = detectIntent(message);
  const ruleAnswer = buildRuleBasedAnswer(intent, userContext);

  let finalAnswer;
  let source;

  if (intent === 'hello') {
    // Light polish for the greeting
    finalAnswer = await polishHebrewAnswer(ruleAnswer);
    source = 'rule+polish';
  } else if (ruleAnswer === null) {
    // Fallback: open-ended question → LLM with full financial context
    finalAnswer = await askLLM(message, userContext);
    source = 'llm';
  } else {
    // Deterministic rule answer — never touches LLM, no chance of hallucination
    finalAnswer = ruleAnswer;
    source = 'rule';
  }

  return res.json({
    success: true,
    answer: `${RLM}${finalAnswer}`,
    intent,
    source,
  });
}

module.exports = { chatWithAI };
