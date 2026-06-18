/**
 * Pension Advisor Agent — pension-specific questions.
 *
 * Responsibilities:
 * - Explain pension contributions and their meaning
 * - Compare user's rates to legal minimums
 * - Advise on contribution optimization
 * - Answer questions about pension fund types
 */

const { BaseAgent } = require('./baseAgent');

const SYSTEM_PROMPT = `אתה סוכן ייעוץ פנסיוני של FinGuide.

תפקידך: לענות על שאלות בנושא פנסיה, הפרשות, קרן השתלמות ופיצויים — בהתבסס על נתוני התלוש של המשתמש ועל הידע הפיננסי שלך.

יכולות:
1. **ניתוח הפרשות** — בדיקה שההפרשות עומדות במינימום החוקי (עובד 6%, מעסיק 6.5%+8.33%)
2. **המלצות** — האם כדאי להגדיל הפרשה, לבדוק דמי ניהול, להחליף מסלול
3. **הסבר מושגים** — קרן פנסיה, ביטוח מנהלים, קופת גמל, קרן השתלמות
4. **חישובי עתיד** — הערכה גסה של צבירת פנסיה

כללים:
- תמיד ציין את שיעורי ההפרשה בפועל מול המינימום
- אם ההפרשה נמוכה מהמינימום — התריע בבירור
- אם אין נתונים — אמור "לא מצאתי נתוני פנסיה בתלוש"
- הוסף דיסקליימר: מידע לצורכי לימוד בלבד, לייעוץ מקצועי יש לפנות ליועץ פנסיוני מורשה
- ענה בעברית, קצר ולעניין`;

class PensionAgent extends BaseAgent {
  constructor() {
    super({
      name: 'pension_advisor',
      description: 'יועץ פנסיוני — הפרשות, קרנות, השתלמות',
      systemPrompt: SYSTEM_PROMPT,
      ragCategory: 'pension',
    });
  }

  formatUserContext(ctx) {
    if (!ctx) return 'אין נתוני פנסיה.';
    const lines = ['**נתוני פנסיה מהתלוש:**'];

    if (ctx.grossSalary) lines.push(`שכר ברוטו: ${ctx.grossSalary} ₪`);
    if (ctx.pensionEmployee != null) {
      const rate = ctx.grossSalary ? ((ctx.pensionEmployee / ctx.grossSalary) * 100).toFixed(1) : '?';
      lines.push(`פנסיה עובד: ${ctx.pensionEmployee} ₪ (${rate}%)`);
    }
    if (ctx.pensionEmployer != null) {
      const rate = ctx.grossSalary ? ((ctx.pensionEmployer / ctx.grossSalary) * 100).toFixed(1) : '?';
      lines.push(`פנסיה מעסיק: ${ctx.pensionEmployer} ₪ (${rate}%)`);
    }
    if (ctx.pensionSeverance != null) lines.push(`פיצויים: ${ctx.pensionSeverance} ₪`);
    if (ctx.trainingFundEmployee != null) {
      const pct = ctx.trainingFundEmployeePercent || '?';
      lines.push(`קרן השתלמות עובד: ${ctx.trainingFundEmployee} ₪ (${pct}%)`);
    }
    if (ctx.trainingFundEmployer != null) {
      const pct = ctx.trainingFundEmployerPercent || '?';
      lines.push(`קרן השתלמות מעסיק: ${ctx.trainingFundEmployer} ₪ (${pct}%)`);
    }

    // Legal minimums for reference
    lines.push('', '**מינימום חוקי:**');
    lines.push('עובד: 6% | מעסיק: 6.5% (פנסיה) + 6% (פיצויים)');
    lines.push('קרן השתלמות: עובד 2.5%, מעסיק 7.5% (לא חובה)');

    return lines.join('\n');
  }
}

module.exports = new PensionAgent();
