/**
 * Insurance & Benefits Recommendation Agent.
 *
 * Responsibilities:
 * - Suggest relevant insurance products based on salary/profile
 * - Explain insurance types and costs
 * - Compare options
 * - Flag missing coverage
 *
 * DISCLAIMER: This is educational guidance only, not licensed financial advice.
 */

const { BaseAgent } = require('./baseAgent');

const SYSTEM_PROMPT = `אתה סוכן המלצות ביטוח ושירותים פיננסיים של FinGuide.

תפקידך: להמליץ על סוגי ביטוח ומוצרים פיננסיים שהמשתמש צריך לבדוק — בהתבסס על נתוני השכר והפרופיל.

יכולות:
1. **המלצות ביטוח** — אכ"ע, חיים, בריאות, דירה — לפי מצב המשתמש
2. **הסבר מוצרים** — מה כל ביטוח מכסה, כמה עולה, למי מתאים
3. **השוואה** — יתרונות/חסרונות של אפשרויות שונות
4. **התרעות** — כיסוי חסר שחשוב לטפל בו

כללים:
- המלץ בהתבסס על שכר, גיל ומצב משפחתי
- תן טווחי מחירים מעודכנים לשוק הישראלי
- הסבר למה ההמלצה רלוונטית ספציפית למשתמש
- דרג: "חיוני" / "מומלץ" / "שווה לבדוק"
- ענה בעברית בפורמט מובנה

⚠️ חובה לציין: "המידע ניתן לצורכי לימוד והתמצאות בלבד. לפני רכישת ביטוח, יש להתייעץ עם סוכן ביטוח/יועץ פנסיוני מורשה."`;

class InsuranceAgent extends BaseAgent {
  constructor() {
    super({
      name: 'insurance_benefits',
      description: 'יועץ ביטוח — המלצות, השוואות, כיסויים',
      systemPrompt: SYSTEM_PROMPT,
      ragCategory: 'insurance',
    });
  }

  formatUserContext(ctx) {
    if (!ctx) return 'אין נתונים.';
    const lines = ['**פרופיל פיננסי:**'];

    if (ctx.grossSalary) lines.push(`שכר ברוטו: ${ctx.grossSalary} ₪`);
    if (ctx.netSalary) lines.push(`שכר נטו: ${ctx.netSalary} ₪`);
    if (ctx.pensionEmployee) lines.push(`הפרשת פנסיה: כן (${ctx.pensionEmployee} ₪)`);
    else lines.push('הפרשת פנסיה: לא ידוע');

    if (ctx.profile) {
      const p = ctx.profile.personal || {};
      if (p.age) lines.push(`גיל: ${p.age}`);
      if (p.maritalStatus) lines.push(`מצב משפחתי: ${p.maritalStatus}`);
      if (p.childrenCount != null) lines.push(`ילדים: ${p.childrenCount}`);
      const a = ctx.profile.assets || {};
      if (a.hasMortgage) lines.push('יש משכנתא: כן');
      if (a.ownsCar) lines.push('רכב: כן');
    }

    return lines.join('\n');
  }
}

module.exports = new InsuranceAgent();
