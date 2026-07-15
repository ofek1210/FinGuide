/**
 * Gemel Advisor Agent — provident & study fund questions (קופות גמל וקרנות השתלמות).
 *
 * Responsibilities:
 * - Explain study fund contributions, tax exemption and the 6-year liquidity rule
 * - Compare user's study-fund rates to the market standard (2.5% / 7.5%)
 * - Advise on management fees and fund transfers (ניוד)
 * - Answer questions about provident fund types (גמל, גמל להשקעה)
 */

const { BaseAgent } = require('./baseAgent');

const SYSTEM_PROMPT = `אתה סוכן קופות הגמל של FinGuide.

תפקידך: לענות על שאלות בנושא קופות גמל וקרנות השתלמות — בהתבסס על נתוני התלוש של המשתמש ועל הידע הפיננסי שלך.

יכולות:
1. **ניתוח הפקדות** — בדיקת שיעורי ההפקדה לקרן השתלמות מול המקובל (עובד 2.5%, מעסיק 7.5%)
2. **הטבות מס** — קרן השתלמות פטורה ממס רווחי הון עד תקרת ההפקדה השנתית (~20,520 ₪ לשכיר); מעל תקרת השכר (15,712 ₪/חודש) ההפקדות חייבות במס
3. **נזילות** — קרן השתלמות נזילה אחרי 6 שנים; ניוד בין קופות אינו אירוע מס ולא מאפס ותק
4. **השוואת שוק** — דמי ניהול ותשואות מול נתוני גמל-נט הרשמיים (data.gov.il)
5. **הסבר מושגים** — קופת גמל, גמל להשקעה, קרן השתלמות, מסלולי השקעה

כללים:
- תמיד ציין את שיעורי ההפקדה בפועל מהתלוש מול המקובל במשק
- אם אין קרן השתלמות — הסבר את שווי ההטבה שהמשתמש מפסיד
- אם אין נתונים — אמור "לא מצאתי נתוני גמל או השתלמות בתלוש"
- הוסף דיסקליימר: מידע לצורכי לימוד בלבד, לייעוץ מקצועי יש לפנות ליועץ פנסיוני מורשה
- ענה בעברית, קצר ולעניין`;

class GemelAgent extends BaseAgent {
  constructor() {
    super({
      name: 'gemel_advisor',
      description: 'סוכן קופות גמל — השתלמות, גמל להשקעה, דמי ניהול',
      systemPrompt: SYSTEM_PROMPT,
      ragCategory: 'pension',
    });
  }

  formatUserContext(ctx) {
    if (!ctx) return 'אין נתוני גמל או השתלמות.';
    const lines = ['**נתוני גמל והשתלמות מהתלוש:**'];

    if (ctx.grossSalary) lines.push(`שכר ברוטו: ${ctx.grossSalary} ₪`);
    if (ctx.trainingFundEmployee != null) {
      const pct = ctx.trainingFundEmployeePercent || '?';
      lines.push(`קרן השתלמות עובד: ${ctx.trainingFundEmployee} ₪ (${pct}%)`);
    }
    if (ctx.trainingFundEmployer != null) {
      const pct = ctx.trainingFundEmployerPercent || '?';
      lines.push(`קרן השתלמות מעסיק: ${ctx.trainingFundEmployer} ₪ (${pct}%)`);
    }
    if (ctx.trainingFundEmployee == null && ctx.trainingFundEmployer == null) {
      lines.push('לא זוהתה הפקדה לקרן השתלמות בתלוש האחרון.');
    }

    // Market standards for reference
    lines.push('', '**מקובל במשק:**');
    lines.push('קרן השתלמות: עובד 2.5%, מעסיק 7.5% (לא חובה, עד תקרת שכר 15,712 ₪/חודש)');
    lines.push('נזילות: 6 שנים | פטור ממס רווחי הון עד ~20,520 ₪/שנה');

    return lines.join('\n');
  }
}

module.exports = new GemelAgent();
