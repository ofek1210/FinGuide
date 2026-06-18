/**
 * Financial Planning Agent — personalized financial planning and recommendations.
 *
 * Responsibilities:
 * - Future projections based on income trends
 * - Savings recommendations
 * - Retirement planning basics
 * - Budget allocation suggestions
 */

const { BaseAgent } = require('./baseAgent');

const SYSTEM_PROMPT = `אתה סוכן תכנון פיננסי של FinGuide.

תפקידך: לעזור למשתמש לתכנן את העתיד הפיננסי שלו — חיסכון, השקעות, פרישה ותקציב.

יכולות:
1. **תקציב** — הצעת חלוקת הכנסה (50/30/20)
2. **חיסכון** — כמה לחסוך, לאן להפנות
3. **תחזיות** — הערכה של צבירה עתידית בפנסיה/השתלמות
4. **המלצות** — פעולות קונקרטיות לשיפור המצב הפיננסי
5. **תרחישים** — "מה יקרה אם" — סימולציות פשוטות

כללים:
- השתמש בנתוני השכר של המשתמש לחישובים
- תן מספרים ספציפיים (לא "חסוך יותר" אלא "חסוך ₪2,000/חודש")
- הצג תחזיות ברורות (1 שנה, 5 שנים, פרישה)
- הדגש: קרן חירום → ביטוח → חיסכון → השקעות (סדר עדיפויות)
- ענה בעברית, מובנה, עם פעולות לביצוע

⚠️ חשוב: ציין תמיד שמדובר בהערכות כלליות ולא בייעוץ השקעות מורשה.`;

class FinancialPlanningAgent extends BaseAgent {
  constructor() {
    super({
      name: 'financial_planning',
      description: 'מתכנן פיננסי — חיסכון, תקציב, תחזיות',
      systemPrompt: SYSTEM_PROMPT,
      ragCategory: 'planning',
    });
  }

  formatUserContext(ctx) {
    if (!ctx) return 'אין נתונים.';
    const lines = ['**מצב פיננסי נוכחי:**'];

    if (ctx.netSalary) lines.push(`הכנסה נטו: ${ctx.netSalary} ₪/חודש`);
    if (ctx.grossSalary) lines.push(`הכנסה ברוטו: ${ctx.grossSalary} ₪/חודש`);

    // Calculate total savings rate
    const pension = (ctx.pensionEmployee || 0) + (ctx.trainingFundEmployee || 0);
    if (pension > 0) {
      lines.push(`חיסכון חודשי (פנסיה+השתלמות עובד): ${pension} ₪`);
      if (ctx.netSalary) {
        const savingsRate = ((pension / ctx.netSalary) * 100).toFixed(1);
        lines.push(`שיעור חיסכון מהנטו: ${savingsRate}%`);
      }
    }

    const employerContrib = (ctx.pensionEmployer || 0) + (ctx.trainingFundEmployer || 0) + (ctx.pensionSeverance || 0);
    if (employerContrib > 0) {
      lines.push(`הפרשות מעסיק חודשיות: ${employerContrib} ₪`);
    }

    if (ctx.payslipHistory?.length > 0) {
      const salaries = [ctx.grossSalary, ...ctx.payslipHistory.map(p => p.grossSalary)].filter(Boolean);
      if (salaries.length >= 2) {
        const trend = salaries[0] - salaries[salaries.length - 1];
        lines.push(`מגמת שכר (${salaries.length} חודשים): ${trend > 0 ? '+' : ''}${trend} ₪`);
      }
    }

    return lines.join('\n');
  }
}

module.exports = new FinancialPlanningAgent();
