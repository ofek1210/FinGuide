/**
 * Financial Analysis Agent — analyzes salary data and produces insights.
 *
 * Responsibilities:
 * - Detect unusual values or anomalies
 * - Explain salary components and what they mean
 * - Provide month-over-month analysis
 * - Give actionable financial observations
 */

const { BaseAgent } = require('./baseAgent');

const SYSTEM_PROMPT = `אתה סוכן ניתוח פיננסי של FinGuide.

תפקידך: לנתח את הנתונים הפיננסיים של המשתמש ולספק תובנות אקטיביות.

יכולות:
1. **זיהוי מגמות** — עלייה/ירידה בשכר, שינויים בניכויים
2. **התרעות** — ניכויים חריגים, שכר מתחת לממוצע, הפרשות חסרות
3. **הסברים** — למה הנטו השתנה, מה ההשפעה של שינוי מסוים
4. **בנצ'מרק** — השוואה לממוצעים בשוק הישראלי

כללים:
- התבסס רק על נתונים שקיבלת — אל תמציא
- ציין מספרים ספציפיים
- הצע פעולה קונקרטית לכל תובנה
- ענה בעברית, בפורמט מובנה (כותרת + פירוט)
- השתמש באמוג'י למיון: ✅ תקין, ⚠️ לתשומת לב, ❌ בעייתי`;

class FinancialAnalysisAgent extends BaseAgent {
  constructor() {
    super({
      name: 'financial_analysis',
      description: 'מנתח פיננסי — תובנות, מגמות, התרעות',
      systemPrompt: SYSTEM_PROMPT,
      ragCategory: 'tax',
    });
  }

  formatUserContext(ctx) {
    if (!ctx) return 'אין נתונים לניתוח.';
    const lines = ['**נתונים לניתוח:**'];

    if (ctx.grossSalary) lines.push(`ברוטו: ${ctx.grossSalary} ₪`);
    if (ctx.netSalary) lines.push(`נטו: ${ctx.netSalary} ₪`);
    if (ctx.grossSalary && ctx.netSalary) {
      const deductionRate = (((ctx.grossSalary - ctx.netSalary) / ctx.grossSalary) * 100).toFixed(1);
      lines.push(`שיעור ניכויים כולל: ${deductionRate}%`);
    }
    if (ctx.tax) lines.push(`מס הכנסה: ${ctx.tax} ₪`);
    if (ctx.marginalTaxRate) lines.push(`שיעור מס שולי: ${ctx.marginalTaxRate}%`);
    if (ctx.nationalInsurance) lines.push(`ביטוח לאומי: ${ctx.nationalInsurance} ₪`);
    if (ctx.mandatoryDeductionsTotal) lines.push(`סה"כ ניכויי חובה: ${ctx.mandatoryDeductionsTotal} ₪`);

    if (ctx.payslipHistory?.length > 0) {
      lines.push('', '**היסטוריה (לבדיקת מגמות):**');
      ctx.payslipHistory.forEach(p => {
        const parts = [];
        if (p.grossSalary) parts.push(`ברוטו: ${p.grossSalary}`);
        if (p.netSalary) parts.push(`נטו: ${p.netSalary}`);
        if (p.tax) parts.push(`מס: ${p.tax}`);
        lines.push(`${p.date || 'חודש קודם'}: ${parts.join(' | ')}`);
      });
    }

    return lines.join('\n');
  }
}

module.exports = new FinancialAnalysisAgent();
