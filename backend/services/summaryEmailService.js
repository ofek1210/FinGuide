/**
 * Summary Email Service
 *
 * Sends a personalized financial summary email to the authenticated user.
 * Only sends if the user has explicitly consented (consent flag required by caller).
 *
 * Partner / accountant CTA:
 *   רו"ח דניאל לוי | 050-1234567 | https://calendly.com/daniel-levi-cpa/consultation
 */

const { sendMail } = require('./mailService');
const { getPayslipInsights } = require('./payslipInsightsService');
const { getInsuranceInsights } = require('./insuranceProfileAnalyzer');
const { getPensionInsights } = require('./pensionRiskAdvisor');
const { buildUnifiedSummary } = require('./unifiedSummaryService');
const {
  formatDomainHealthLines,
  formatDomainHealthLinesHtml,
  formatDomainHealthLinesWhatsApp,
} = require('../utils/summaryFormatters');

const CPA_NAME = 'רו"ח דניאל לוי';
const CPA_PHONE = '050-1234567';
const CPA_CALENDLY = 'https://calendly.com/daniel-levi-cpa/consultation';
const CPA_EMAIL = 'daniel.levi.cpa@example.com';
const APP_NAME = 'FinGuide';
const APP_URL = process.env.CLIENT_URL || 'http://localhost:5173';

function severityColor(severity) {
  if (severity === 'error') return '#e53e3e';
  if (severity === 'warning') return '#d69e2e';
  return '#3182ce';
}

function buildInsightRow(i) {
  const color = severityColor(i.severity);
  const recHtml = i.recommendation ? `<div style="font-size:13px;color:#4a5568;margin-top:4px;">${i.recommendation}</div>` : '';
  const impactHtml = i.financialImpactLabel ? `<div style="font-size:12px;color:#2d7d46;font-weight:600;margin-top:4px;">${i.financialImpactLabel}</div>` : '';
  return `<div style="margin:10px 0;padding:12px 14px;border-right:3px solid ${color};background:#fafafa;border-radius:4px;direction:rtl;"><div style="font-weight:600;font-size:14px;color:#1a202c;">${i.title}</div>${recHtml}${impactHtml}</div>`;
}

function buildInsightRows(insights) {
  if (!insights || insights.length === 0) return '<p style="color:#666;font-size:14px;">לא זוהו תובנות משמעותיות.</p>';
  return insights.map(buildInsightRow).join('');
}

function buildEmailHtml({ userName, payslip, insurance, pension, unified }) {
  const now = new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' });

  const payslipInsightRows = buildInsightRows(payslip?.insights || []);
  const insuranceInsightRows = buildInsightRows(insurance?.insights || []);
  const pensionInsightRows = buildInsightRows(pension?.insights || []);

  const allInsights = [
    ...(payslip?.insights || []),
    ...(insurance?.insights || []),
    ...(pension?.insights || []),
  ];
  const totalSavings = allInsights.reduce((sum, i) => sum + (i.financialImpact || 0), 0);
  const totalInsights = allInsights.length;

  const savingsLine = totalSavings > 0 ? `פוטנציאל חיסכון: ₪${totalSavings.toLocaleString('he-IL')}\n` : '';
  const waText = encodeURIComponent(
    `הסיכום הפיננסי שלי מ-FinGuide מוכן!\nתלושים: ${payslip?.insights?.length || 0} תובנות\nביטוח: ${insurance?.insights?.length || 0} תובנות\nפנסיה: ${pension?.insights?.length || 0} תובנות\n${savingsLine}לקביעת פגישה: ${CPA_CALENDLY}`
  );

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>סיכום פיננסי אישי — ${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f9;font-family:'Segoe UI',Arial,sans-serif;direction:rtl;">
  <div style="max-width:640px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#7c3aed,#9d5af0);padding:32px 28px;text-align:center;">
      <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">${APP_NAME}</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:6px;">סיכום ניתוח פיננסי אישי</div>
    </div>

    <div style="padding:24px 28px 0;direction:rtl;">
      <p style="font-size:16px;color:#1a202c;">שלום ${userName},</p>
      <p style="font-size:14px;color:#4a5568;">
        ניתוח FinGuide שלך מוכן. זיהינו <strong>${totalInsights} תובנות</strong>
        ${totalSavings > 0 ? `עם פוטנציאל חיסכון שנתי של <strong style="color:#2d7d46;">₪${totalSavings.toLocaleString('he-IL')}</strong>` : ''}.
      </p>
      ${formatDomainHealthLinesHtml(unified)}
      <p style="font-size:12px;color:#a0aec0;">${now}</p>
    </div>

    <div style="padding:8px 28px;"><div style="height:1px;background:#e2e8f0;"></div></div>

    <div style="padding:20px 28px;">
      <h2 style="font-size:16px;font-weight:700;color:#1a202c;margin:0 0 4px;">📄 תלושים ומסמכים</h2>
      ${payslip?.meta?.latestGross ? `<p style="font-size:13px;color:#718096;margin:0 0 12px;">שכר ברוטו אחרון: ₪${payslip.meta.latestGross.toLocaleString('he-IL')} | נטו: ₪${(payslip.meta.latestNet || 0).toLocaleString('he-IL')}</p>` : ''}
      ${payslipInsightRows}
      ${payslip?.narrative ? `<div style="margin-top:12px;padding:12px;background:#f0f4ff;border-radius:6px;font-size:13px;color:#4a5568;line-height:1.6;">${payslip.narrative.replace(/\n/g, '<br/>')}</div>` : ''}
    </div>

    <div style="padding:0 28px;"><div style="height:1px;background:#e2e8f0;"></div></div>

    <div style="padding:20px 28px;">
      <h2 style="font-size:16px;font-weight:700;color:#1a202c;margin:0 0 4px;">🛡️ ביטוח ופוליסות</h2>
      ${insurance?.meta?.totalMonthlyPremium ? `<p style="font-size:13px;color:#718096;margin:0 0 12px;">סה"כ פרמיה חודשית: ₪${insurance.meta.totalMonthlyPremium.toLocaleString('he-IL')} | שנתית: ₪${insurance.meta.totalAnnualPremium.toLocaleString('he-IL')}</p>` : ''}
      ${insuranceInsightRows}
    </div>

    <div style="padding:0 28px;"><div style="height:1px;background:#e2e8f0;"></div></div>

    <div style="padding:20px 28px;">
      <h2 style="font-size:16px;font-weight:700;color:#1a202c;margin:0 0 4px;">🏦 פנסיה וחיסכון</h2>
      ${pension?.meta?.totalBalance ? `<p style="font-size:13px;color:#718096;margin:0 0 12px;">צבירה נוכחית: ₪${pension.meta.totalBalance.toLocaleString('he-IL')}${pension.meta.projectedBalance ? ` | תחזית פרישה: ₪${pension.meta.projectedBalance.toLocaleString('he-IL')}` : ''}</p>` : ''}
      ${pensionInsightRows}
      <p style="font-size:11px;color:#a0aec0;margin-top:12px;">⚠️ אינו מהווה ייעוץ פנסיוני מקצועי.</p>
    </div>

    <div style="padding:0 28px;"><div style="height:1px;background:#e2e8f0;"></div></div>

    <div style="padding:28px;background:#faf5ff;direction:rtl;">
      <h2 style="font-size:16px;font-weight:700;color:#1a202c;margin:0 0 8px;">👨‍💼 קבע פגישה עם יועץ פיננסי מוסמך</h2>
      <p style="font-size:14px;color:#4a5568;margin:0 0 14px;">
        ${CPA_NAME} | <a href="tel:${CPA_PHONE}" style="color:#7c3aed;">${CPA_PHONE}</a> | <a href="mailto:${CPA_EMAIL}" style="color:#7c3aed;">${CPA_EMAIL}</a>
      </p>
      <a href="${CPA_CALENDLY}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
        קבע פגישת ייעוץ ←
      </a>
      <div style="margin-top:16px;">
        <a href="https://wa.me/?text=${waText}" style="display:inline-block;background:#25d366;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-left:10px;">
          שתף ב-WhatsApp
        </a>
        <a href="${APP_URL}/hub" style="display:inline-block;background:#fff;color:#7c3aed;border:1.5px solid #7c3aed;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          חזור לאפליקציה
        </a>
      </div>
    </div>

    <div style="padding:16px 28px;background:#f7f7f9;border-top:1px solid #e2e8f0;direction:rtl;">
      <p style="font-size:11px;color:#a0aec0;margin:0;line-height:1.5;">
        ⚠️ הסיכום הנ"ל מיועד למידע כללי בלבד ואינו מהווה ייעוץ פיננסי, משפטי, ביטוחי או פנסיוני.
        לפני ביצוע כל שינוי — יש להתייעץ עם בעל מקצוע מורשה.
        <br/>מייל זה נשלח כי ביקשת לקבל סיכום מ-FinGuide.
        <a href="${APP_URL}/hub" style="color:#a0aec0;">ניהול הגדרות</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildPlainText({ userName, payslip, insurance, pension, unified }) {
  const allInsights = [
    ...(payslip?.insights || []).map(i => `[תלושים] ${i.title}: ${i.recommendation}`),
    ...(insurance?.insights || []).map(i => `[ביטוח] ${i.title}: ${i.recommendation}`),
    ...(pension?.insights || []).map(i => `[פנסיה] ${i.title}: ${i.recommendation}`),
  ];

  const healthLines = formatDomainHealthLines(unified).filter(Boolean);
  return [
    `סיכום פיננסי אישי — ${APP_NAME}`,
    `שלום ${userName},`,
    '',
    `תלושים: ${payslip?.insights?.length || 0} תובנות`,
    `ביטוח: ${insurance?.insights?.length || 0} תובנות`,
    `פנסיה: ${pension?.insights?.length || 0} תובנות`,
    ...healthLines,
    '',
    ...allInsights,
    '',
    `לקביעת פגישה עם יועץ: ${CPA_CALENDLY}`,
    `${CPA_NAME} | ${CPA_PHONE}`,
    '',
    '--- המידע לצרכי מידע בלבד. לא מהווה ייעוץ מקצועי. ---',
  ].join('\n');
}

/**
 * Send the summary email.
 * @param {{ _id, name, email }} user
 * @param {boolean} userConsent — must be true or this throws
 */
async function sendSummaryEmail(user, userConsent) {
  if (!userConsent) {
    throw new Error('נדרש אישור מפורש של המשתמש לשליחת מייל סיכום');
  }

  const [payslip, insurance, pension, unified] = await Promise.allSettled([
    getPayslipInsights(user._id),
    getInsuranceInsights(user._id),
    getPensionInsights(user._id),
    buildUnifiedSummary(user._id),
  ]).then(results => results.map(r => (r.status === 'fulfilled' ? r.value : null)));

  const payload = {
    userName: user.name || 'משתמש',
    payslip,
    insurance,
    pension,
    unified,
  };

  await sendMail({
    to: user.email,
    subject: `הסיכום הפיננסי שלך מ-${APP_NAME} מוכן`,
    html: buildEmailHtml(payload),
    text: buildPlainText(payload),
  });

  return {
    sentTo: user.email,
    payslipInsights: payslip?.insights?.length || 0,
    insuranceInsights: insurance?.insights?.length || 0,
    pensionInsights: pension?.insights?.length || 0,
  };
}

/**
 * Build a WhatsApp share URL with pre-filled text summary.
 */
function buildWhatsAppShareUrl(payslip, insurance, pension, unified) {
  const totalSavings = [
    ...(payslip?.insights || []),
    ...(insurance?.insights || []),
    ...(pension?.insights || []),
  ].reduce((sum, i) => sum + (i.financialImpact || 0), 0);

  const lines = [
    `📊 הסיכום הפיננסי שלי מ-FinGuide מוכן!`,
    '',
    `📄 תלושים: ${payslip?.insights?.length || 0} תובנות`,
    `🛡️ ביטוח: ${insurance?.insights?.length || 0} תובנות`,
    `🏦 פנסיה: ${pension?.insights?.length || 0} תובנות`,
    ...formatDomainHealthLinesWhatsApp(unified),
  ];
  if (totalSavings > 0) lines.push(`💰 פוטנציאל חיסכון: ₪${totalSavings.toLocaleString('he-IL')}`);
  lines.push('', `לקביעת פגישת ייעוץ: ${CPA_CALENDLY}`);

  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
}

module.exports = { sendSummaryEmail, buildWhatsAppShareUrl };
