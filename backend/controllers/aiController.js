const { polishHebrewAnswer } = require('../services/aiService');

const RLM = '\u200F';

function normalizeMessage(message) {
  return String(message || '').trim().toLowerCase();
}

function formatPercent(value) {
  if (value === undefined || value === null || value === '') return null;
  return `${value}%`;
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
    msg.includes('מה הכי חשוב')
  ) {
    return 'recommended_action';
  }

  if (msg.includes('פנסיה') && msg.includes('כמה')) {
    return 'pension_employee_percent';
  }

  if (msg.includes('מעסיק') && msg.includes('פנסיה')) {
    return 'pension_employer_percent';
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

  return 'fallback';
}

function summarizeDocuments(documents = []) {
  const total = documents.length;
  const analyzed = documents.filter(doc => doc.status === 'analyzed').length;
  const uploaded = documents.filter(doc => doc.status === 'uploaded').length;
  const failed = documents.filter(doc => doc.status === 'failed').length;

  const byType = {};
  documents.forEach(doc => {
    const type = doc.type || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
  });

  return { total, analyzed, uploaded, failed, byType };
}

function countDocumentsThisMonth(documents = []) {
  const now = new Date();

  return documents.filter(doc => {
    const uploadedAt = safeDate(doc.uploadedAt);
    return uploadedAt && isSameMonth(uploadedAt, now);
  }).length;
}

function getRecommendedAction(documents = []) {
  if (!documents.length) {
    return 'עדיין לא העלית מסמכים. הפעולה הכי חשובה כרגע היא להעלות מסמך ראשון כדי שאוכל לנתח אותו.';
  }

  const failedDocs = documents.filter(doc => doc.status === 'failed');
  if (failedDocs.length > 0) {
    return `יש לך ${failedDocs.length} מסמכים שנכשלו בניתוח, ולכן הפעולה הכי חשובה כרגע היא לבדוק או להעלות אותם מחדש.`;
  }

  const uploadedDocs = documents.filter(doc => doc.status === 'uploaded');
  if (uploadedDocs.length > 0) {
    return `יש לך ${uploadedDocs.length} מסמכים שהועלו אבל עדיין לא נותחו, ולכן כדאי להשלים את הניתוח שלהם קודם.`;
  }

  const hasPayslip = documents.some(doc => doc.type === 'payslip');
  if (!hasPayslip) {
    return 'כדאי להעלות תלוש שכר כדי שאוכל לתת לך תובנות אישיות על שכר, פנסיה והפרשות.';
  }

  return 'נראה שמצב המסמכים שלך תקין כרגע. השלב הבא שכדאי לעשות הוא לשאול שאלה ממוקדת על הנתונים שלך.';
}

function buildRuleBasedAnswer(intent, userData = {}) {
  const documents = Array.isArray(userData.documents) ? userData.documents : [];

  switch (intent) {
    case 'hello':
      return 'שלום 😊';

    case 'documents_count_month': {
      const count = countDocumentsThisMonth(documents);
      return `בחודש הנוכחי הועלו ${count} מסמכים.`;
    }

    case 'documents_summary': {
      if (!documents.length) {
        return 'כרגע אין לי מסמכים לסכם. כדי שאוכל לעזור, צריך להעלות לפחות מסמך אחד.';
      }

      const summary = summarizeDocuments(documents);
      const typeSummary = Object.entries(summary.byType)
        .map(([type, count]) => `${count} מסוג ${type}`)
        .join(', ');

      return `יש לך כרגע ${summary.total} מסמכים בסך הכול. מתוכם ${summary.analyzed} נותחו, ${summary.uploaded} ממתינים לניתוח${summary.failed ? ` ו-${summary.failed} נכשלו` : ''}. סוגי המסמכים הקיימים הם: ${typeSummary}.`;
    }

    case 'recommended_action': {
      return getRecommendedAction(documents);
    }

    case 'pension_employee_percent': {
      const value = formatPercent(userData.pensionEmployeePercent);
      if (!value) {
        return 'אני לא רואה כרגע בנתונים שלך את אחוז ההפרשה של העובד לפנסיה.';
      }
      return `לפי הנתונים שלך, את מפרישה ${value} לפנסיה.`;
    }

    case 'pension_employer_percent': {
      const value = formatPercent(userData.pensionEmployerPercent);
      if (!value) {
        return 'אני לא רואה כרגע בנתונים שלך את אחוז ההפרשה של המעסיק לפנסיה.';
      }
      return `לפי הנתונים שלך, המעסיק מפריש ${value} לפנסיה.`;
    }

    case 'training_fund': {
      const hasTrainingFund = userData.hasTrainingFund;
      const employeePercent = formatPercent(userData.trainingFundEmployeePercent);
      const employerPercent = formatPercent(userData.trainingFundEmployerPercent);

      if (hasTrainingFund === false) {
        return 'לפי הנתונים שלך, כרגע אין קרן השתלמות.';
      }

      if (employeePercent || employerPercent) {
        return `לפי הנתונים שלך, יש לך קרן השתלמות${employeePercent ? ` עם הפרשת עובד של ${employeePercent}` : ''}${employerPercent ? ` והפרשת מעסיק של ${employerPercent}` : ''}.`;
      }

      return 'אני רואה שיש התייחסות לקרן השתלמות, אבל חסרים לי אחוזי ההפרשה המדויקים.';
    }

    case 'net_salary': {
      const value = userData.netSalary;
      if (value === undefined || value === null) {
        return 'אני לא רואה כרגע בנתונים שלך את שכר הנטו.';
      }
      return `לפי הנתונים שלך, שכר הנטו שלך הוא ${value} ש״ח.`;
    }

    case 'gross_salary': {
      const value = userData.grossSalary;
      if (value === undefined || value === null) {
        return 'אני לא רואה כרגע בנתונים שלך את שכר הברוטו.';
      }
      return `לפי הנתונים שלך, שכר הברוטו שלך הוא ${value} ש״ח.`;
    }

    default:
      return 'עדיין לא הצלחתי להבין את השאלה בצורה מדויקת. אפשר לשאול על מסמכים, פנסיה, נטו, ברוטו או קרן השתלמות.';
  }
}

async function chatWithAI(req, res) {
  const { message, userData } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'message is required (string)',
    });
  }

  const intent = detectIntent(message);
  const baseAnswer = buildRuleBasedAnswer(intent, userData || {});

  const shouldPolish = ![
    'documents_count_month',
    'documents_summary',
    'recommended_action',
  ].includes(intent);

  const finalAnswer = shouldPolish
    ? await polishHebrewAnswer(baseAnswer)
    : baseAnswer;

  return res.json({
    success: true,
    answer: `${RLM}${finalAnswer}`,
    intent,
    source: shouldPolish ? 'rule+polish' : 'rule',
  });
}

module.exports = {
  chatWithAI,
};