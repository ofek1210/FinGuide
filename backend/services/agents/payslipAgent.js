/**
 * Payslip Analysis Agent — OCR extraction analysis and explanation.
 *
 * Responsibilities:
 * - Explain extracted salary slip fields in simple language
 * - Identify unusual values or missing fields
 * - Compare current payslip with previous months
 * - Summarize the payslip in plain Hebrew
 */

const { BaseAgent } = require('./baseAgent');

const SYSTEM_PROMPT = `אתה סוכן ניתוח תלוש שכר של FinGuide.

תפקידך: לנתח תלושי שכר ישראליים ולהסביר למשתמש את הנתונים בשפה פשוטה וברורה.

יכולות:
1. **הסבר שדות** — הסבר כל רכיב בתלוש (ברוטו, נטו, ניכויים, הפרשות) בשפה פשוטה
2. **זיהוי חריגות** — שכר חריג, ניכויים חסרים, הפרשות לא תקינות
3. **השוואת חודשים** — זיהוי שינויים מחודש לחודש
4. **סיכום** — תמצית של התלוש ב-3-4 משפטים

כללים:
- ענה תמיד בעברית
- אם חסר נתון — אמור "לא מופיע בתלוש" ואל תנחש
- ציין ערכים מספריים ספציפיים מהנתונים
- השווה לממוצע שוק כשרלוונטי
- הסבר מונחים מקצועיים בשפה יומיומית`;

class PayslipAgent extends BaseAgent {
  constructor() {
    super({
      name: 'payslip_analysis',
      description: 'מנתח תלושי שכר ומסביר את הנתונים',
      systemPrompt: SYSTEM_PROMPT,
      ragCategory: 'payslip',
    });
  }

  formatUserContext(ctx) {
    if (!ctx) return 'אין נתוני תלוש.';
    const lines = ['**תלוש שכר אחרון:**'];

    if (ctx.payslipDate) lines.push(`תאריך: ${ctx.payslipDate}`);
    if (ctx.employeeName) lines.push(`עובד: ${ctx.employeeName}`);
    if (ctx.employerName) lines.push(`מעסיק: ${ctx.employerName}`);
    if (ctx.jobPercentage) lines.push(`אחוז משרה: ${ctx.jobPercentage}%`);

    lines.push('', '**הכנסה:**');
    if (ctx.grossSalary) lines.push(`ברוטו: ${ctx.grossSalary} ₪`);
    if (ctx.baseSalary) lines.push(`שכר בסיס: ${ctx.baseSalary} ₪`);
    if (ctx.netSalary) lines.push(`נטו: ${ctx.netSalary} ₪`);

    if (Array.isArray(ctx.salaryComponents) && ctx.salaryComponents.length > 0) {
      lines.push('', '**רכיבי שכר:**');
      ctx.salaryComponents.forEach(c => lines.push(`- ${c.type}: ${c.amount} ₪`));
    }

    lines.push('', '**ניכויים:**');
    if (ctx.tax) lines.push(`מס הכנסה: ${ctx.tax} ₪`);
    if (ctx.nationalInsurance) lines.push(`ביטוח לאומי: ${ctx.nationalInsurance} ₪`);
    if (ctx.healthInsurance) lines.push(`מס בריאות: ${ctx.healthInsurance} ₪`);

    lines.push('', '**הפרשות:**');
    if (ctx.pensionEmployee) lines.push(`פנסיה עובד: ${ctx.pensionEmployee} ₪`);
    if (ctx.pensionEmployer) lines.push(`פנסיה מעסיק: ${ctx.pensionEmployer} ₪`);
    if (ctx.trainingFundEmployee) lines.push(`קרן השתלמות עובד: ${ctx.trainingFundEmployee} ₪`);
    if (ctx.trainingFundEmployer) lines.push(`קרן השתלמות מעסיק: ${ctx.trainingFundEmployer} ₪`);

    if (ctx.vacationDays != null) lines.push(`\nימי חופשה: ${ctx.vacationDays}`);
    if (ctx.sickDays != null) lines.push(`ימי מחלה: ${ctx.sickDays}`);

    if (ctx.payslipHistory?.length > 0) {
      lines.push('', '**חודשים קודמים:**');
      ctx.payslipHistory.forEach(p => {
        const parts = [];
        if (p.grossSalary) parts.push(`ברוטו: ${p.grossSalary} ₪`);
        if (p.netSalary) parts.push(`נטו: ${p.netSalary} ₪`);
        lines.push(`${p.date || 'קודם'}: ${parts.join(' | ')}`);
      });
    }

    return lines.join('\n');
  }
}

module.exports = new PayslipAgent();
