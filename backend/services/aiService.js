const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

function cleanAnswer(text) {
  if (!text) return '';
  return text.replace(/^["'"]+|["'"]+$/g, '').trim();
}

function buildFinancialSystemPrompt(userContext) {
  const lines = [
    'אתה יועץ פיננסי של אפליקציית FinGuide, המסייע לעובדים בישראל להבין את תלושי השכר שלהם ולנהל את הכספים.',
    'כללים:',
    '- ענה בעברית תקינה, קצרה וברורה.',
    '- השתמש בלשון פנייה ניטרלית מבחינת מגדר (למשל "שכרך" במקום "שכרך/שכרכי").',
    '- אל תמציא נתונים שאינם מופיעים בהקשר שניתן לך.',
    '- אם חסרים נתונים, אמור זאת בפשטות ואל תנחש.',
    '- אל תתן המלצות שלא נשאלת עליהן.',
    '- ענה במשפטים קצרים, ללא כותרות מיותרות.',
    '- כשנשאלת על מדרגות מס, נקודות זיכוי או חישובים, השתמש בנתונים שקיבלת בלבד.',
  ];

  const hasData = userContext?.grossSalary != null || userContext?.netSalary != null;

  if (hasData) {
    lines.push('', 'נתוני תלוש שכר אחרון של המשתמש:');
    if (userContext.employeeName) lines.push(`שם העובד: ${userContext.employeeName}`);
    if (userContext.employerName) lines.push(`שם המעסיק: ${userContext.employerName}`);
    if (userContext.payslipDate) lines.push(`תאריך תלוש: ${userContext.payslipDate}`);
    if (userContext.jobPercentage != null) lines.push(`אחוז משרה: ${userContext.jobPercentage}%`);

    // Income
    lines.push('', 'הכנסה:');
    if (userContext.grossSalary != null) lines.push(`  ברוטו: ${userContext.grossSalary} ₪`);
    if (userContext.baseSalary != null) lines.push(`  שכר בסיס: ${userContext.baseSalary} ₪`);
    if (userContext.netSalary != null) lines.push(`  נטו לתשלום: ${userContext.netSalary} ₪`);

    // Salary components
    if (Array.isArray(userContext.salaryComponents) && userContext.salaryComponents.length > 0) {
      const componentLabels = {
        base_salary: 'שכר בסיס',
        global_overtime: 'שעות נוספות גלובליות',
        travel_expenses: 'דמי נסיעה',
        bonus: 'בונוס',
        holiday_pay: 'דמי חגים',
        overtime_125: 'שעות נוספות 125%',
        overtime_150: 'שעות נוספות 150%',
        convalescence: 'דמי הבראה',
        clothing_allowance: 'ביגוד',
      };
      lines.push('  רכיבי שכר:');
      userContext.salaryComponents.forEach(c => {
        const label = componentLabels[c.type] || c.type;
        lines.push(`    ${label}: ${c.amount} ₪`);
      });
    }

    // Deductions
    lines.push('', 'ניכויי חובה:');
    if (userContext.tax != null) lines.push(`  מס הכנסה: ${userContext.tax} ₪`);
    if (userContext.nationalInsurance != null) lines.push(`  ביטוח לאומי: ${userContext.nationalInsurance} ₪`);
    if (userContext.healthInsurance != null) lines.push(`  מס בריאות: ${userContext.healthInsurance} ₪`);
    if (userContext.mandatoryDeductionsTotal != null) lines.push(`  סה"כ ניכויי חובה: ${userContext.mandatoryDeductionsTotal} ₪`);

    // Pension and savings
    const hasPension = userContext.pensionEmployee != null || userContext.pensionEmployer != null;
    const hasFund = userContext.trainingFundEmployee != null || userContext.trainingFundEmployer != null;
    if (hasPension || hasFund) {
      lines.push('', 'הפרשות פנסיוניות:');
      if (userContext.pensionEmployee != null) lines.push(`  פנסיה עובד: ${userContext.pensionEmployee} ₪`);
      if (userContext.pensionEmployer != null) lines.push(`  פנסיה מעסיק: ${userContext.pensionEmployer} ₪`);
      if (userContext.pensionSeverance != null) lines.push(`  פיצויים (מעסיק): ${userContext.pensionSeverance} ₪`);
      if (userContext.trainingFundEmployee != null) {
        const pct = userContext.trainingFundEmployeePercent != null ? ` (${userContext.trainingFundEmployeePercent}%)` : '';
        lines.push(`  קרן השתלמות עובד: ${userContext.trainingFundEmployee} ₪${pct}`);
      }
      if (userContext.trainingFundEmployer != null) {
        const pct = userContext.trainingFundEmployerPercent != null ? ` (${userContext.trainingFundEmployerPercent}%)` : '';
        lines.push(`  קרן השתלמות מעסיק: ${userContext.trainingFundEmployer} ₪${pct}`);
      }
    }

    // Tax info
    if (userContext.marginalTaxRate != null || userContext.taxCreditPoints != null) {
      lines.push('', 'מידע מס:');
      if (userContext.marginalTaxRate != null) lines.push(`  שיעור מס שולי: ${userContext.marginalTaxRate}%`);
      if (userContext.taxCreditPoints != null) lines.push(`  נקודות זיכוי: ${userContext.taxCreditPoints}`);
    }

    // Work and leave
    const hasWorkData = userContext.workingDays != null || userContext.vacationDays != null;
    if (hasWorkData) {
      lines.push('', 'נתוני עבודה וחופשה:');
      if (userContext.workingDays != null) lines.push(`  ימי עבודה בחודש: ${userContext.workingDays}`);
      if (userContext.workingHours != null) lines.push(`  שעות עבודה בחודש: ${userContext.workingHours}`);
      if (userContext.vacationDays != null) lines.push(`  יתרת ימי חופשה: ${userContext.vacationDays}`);
      if (userContext.sickDays != null) lines.push(`  יתרת ימי מחלה: ${userContext.sickDays}`);
    }
  } else {
    lines.push('', 'אין עדיין נתוני תלוש שכר מנותחים עבור המשתמש.');
  }

  if (userContext?.documents?.length) {
    lines.push('', `סה"כ מסמכים במערכת: ${userContext.documents.length}`);
  }

  // Include prior payslips for month-over-month trend questions
  if (Array.isArray(userContext?.payslipHistory) && userContext.payslipHistory.length > 0) {
    lines.push('', 'תלושים קודמים (לבדיקת מגמות):');
    userContext.payslipHistory.forEach(p => {
      const label = p.date || 'תלוש קודם';
      const parts = [];
      if (p.grossSalary != null) parts.push(`ברוטו: ${p.grossSalary} ₪`);
      if (p.netSalary != null) parts.push(`נטו: ${p.netSalary} ₪`);
      if (p.tax != null) parts.push(`מס: ${p.tax} ₪`);
      if (p.pensionEmployee != null) parts.push(`פנסיה עובד: ${p.pensionEmployee} ₪`);
      if (parts.length > 0) lines.push(`  ${label}: ${parts.join(' | ')}`);
    });
  }

  return lines.join('\n');
}

async function callOllamaChat(messages, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);

  try {
    const payload = {
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.2,
        top_p: 0.9,
        num_predict: options.maxTokens || 200,
      },
    };

    const resp = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    return cleanAnswer(data.message?.content || '') || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function polishHebrewAnswer(baseText) {
  const result = await callOllamaChat(
    [
      {
        role: 'system',
        content: 'נסח מחדש את המשפט שתקבל בעברית פשוטה, טבעית וקצרה. אל תוסיף נתונים. החזר רק את המשפט הסופי.',
      },
      { role: 'user', content: baseText },
    ],
    { temperature: 0.1, maxTokens: 120, timeoutMs: 20000 },
  );
  return result || baseText;
}

async function askLLM(userMessage, userContext, history = []) {
  const systemPrompt = buildFinancialSystemPrompt(userContext);
  const fallback =
    'לא הצלחתי לענות על זה כרגע. אפשר לשאול שאלה ספציפית כמו: "כמה נטו?", "כמה פנסיה?" או "תסכם מסמכים".';

  // Include last N turns so the LLM has conversation context
  const historyMessages = Array.isArray(history)
    ? history.slice(-6).map(m => ({ role: m.role, content: m.content }))
    : [];

  const result = await callOllamaChat(
    [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessage },
    ],
    { temperature: 0.2, maxTokens: 250, timeoutMs: 30000 },
  );

  return result || fallback;
}

module.exports = { polishHebrewAnswer, askLLM };
