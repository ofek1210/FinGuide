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

    const fin = ctx.profile?.financial;
    if (fin) {
      const breakdownLabels = {
        rent: 'שכר דירה',
        arnona: 'ארנונה',
        vaadBayit: 'ועד בית',
        clothing: 'ביגוד',
        food: 'מזון',
        restaurants: 'מסעדות',
        childcare: 'גנים/חינוך',
        tvInternet: 'טלוויזיה ואינטרנט',
        electricity: 'חשמל',
        water: 'מים',
      };

      const formatPeriodLabel = (period) => {
        const [year, month] = String(period).split('-').map(Number);
        if (!year || !month) return period;
        const names = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
        return `${names[month - 1] || month} ${year}`;
      };

      const byPeriod = fin.monthlyExpensesByPeriod;
      const periodKeys = byPeriod && typeof byPeriod === 'object'
        ? Object.keys(byPeriod).sort().reverse()
        : [];

      if (periodKeys.length > 0) {
        lines.push('**הוצאות שוטפות לפי חודש:**');
        for (const period of periodKeys.slice(0, 6)) {
          const entry = byPeriod[period];
          if (!entry) continue;
          const breakdown = entry.breakdown;
          let expenseTotal = Number(entry.total) > 0 ? Number(entry.total) : null;
          if (!expenseTotal && entry.otherEstimate) expenseTotal = entry.otherEstimate;

          lines.push(`--- ${formatPeriodLabel(period)} ---`);
          if (breakdown && typeof breakdown === 'object') {
            const entries = Object.entries(breakdown).filter(([, v]) => Number(v) > 0);
            if (entries.length > 0) {
              if (!expenseTotal) expenseTotal = entries.reduce((sum, [, v]) => sum + Number(v), 0);
              for (const [key, amount] of entries) {
                if (breakdownLabels[key]) lines.push(`${breakdownLabels[key]}: ${amount} ₪`);
              }
            }
          }
          if (!expenseTotal && entry.otherEstimate) {
            lines.push(`אחר / לא מפורט: ${entry.otherEstimate} ₪`);
            expenseTotal = entry.otherEstimate;
          }
          if (expenseTotal) lines.push(`סה"כ הוצאות: ${expenseTotal} ₪`);
          if (entry.monthlyDebts) lines.push(`החזרי חובות: ${entry.monthlyDebts} ₪`);

          const payslipForPeriod = ctx.payslipsByPeriod?.[period];
          const netForPeriod = payslipForPeriod?.netSalary ?? (period === periodKeys[0] ? ctx.netSalary : null);
          if (netForPeriod && expenseTotal != null) {
            const disposable = netForPeriod - expenseTotal - (entry.monthlyDebts || 0);
            lines.push(`נטו מתלוש (${formatPeriodLabel(period)}): ${netForPeriod} ₪`);
            lines.push(`הכנסה פנויה: ${disposable} ₪`);
          }
        }
      } else {
        const breakdown = fin.monthlyExpensesBreakdown;
        let expenseTotal = null;

        if (breakdown && typeof breakdown === 'object') {
          const entries = Object.entries(breakdown).filter(([, v]) => Number(v) > 0);
          if (entries.length > 0) {
            expenseTotal = entries.reduce((sum, [, v]) => sum + Number(v), 0);
            lines.push(`סה"כ הוצאות שוטפות חודשיות: ${expenseTotal} ₪`);
            lines.push('**פירוט הוצאות:**');
            for (const [key, amount] of entries) {
              if (breakdownLabels[key]) lines.push(`${breakdownLabels[key]}: ${amount} ₪`);
            }
          }
        }

        if (expenseTotal == null && fin.monthlyExpensesEstimate) {
          expenseTotal = fin.monthlyExpensesEstimate;
          lines.push(`הוצאות חודשיות (לא מפורט): ${expenseTotal} ₪`);
        }

        if (fin.monthlyDebts) {
          lines.push(`החזרי חובות חודשיים: ${fin.monthlyDebts} ₪`);
        }

        if (ctx.netSalary && expenseTotal != null) {
          const disposable = ctx.netSalary - expenseTotal - (fin.monthlyDebts || 0);
          lines.push(`הכנסה פנויה (נטו פחות הוצאות וחובות): ${disposable} ₪/חודש`);
        }
      }
    }

    return lines.join('\n');
  }
}

module.exports = new FinancialPlanningAgent();
