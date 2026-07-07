/**
 * digestService — generates a short AI narrative after a payslip is processed.
 *
 * Uses claude-haiku (cheapest model, ~$0.001 per digest) to keep costs minimal.
 * Falls back silently if no API key is configured.
 *
 * Called from financialDocumentService.runPostUploadSideEffects (non-blocking).
 */

const Document = require('../models/Document');
const llmBudget = require('./llmBudget');

const HAIKU_MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 350;

let anthropicClient = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function extractSummary(doc) {
  const s = doc?.analysisData?.summary || {};
  const sal = doc?.analysisData?.salary || {};
  const ded = doc?.analysisData?.deductions?.mandatory || {};
  const con = doc?.analysisData?.contributions || {};

  const toN = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

  return {
    period: doc?.metadata?.periodMonth && doc?.metadata?.periodYear
      ? `${doc.metadata.periodMonth}/${doc.metadata.periodYear}`
      : null,
    gross: toN(s.grossSalary) ?? toN(sal.gross_total),
    net: toN(s.netSalary) ?? toN(sal.net_payable),
    tax: toN(s.tax) ?? toN(ded.income_tax),
    nationalInsurance: toN(s.nationalInsurance) ?? toN(ded.national_insurance),
    pensionEmployee: toN(s.pensionEmployee) ?? toN(con.pension?.employee_amount),
    pensionEmployer: toN(s.pensionEmployer) ?? toN(con.pension?.employer_amount),
    trainingFundEmployee: toN(s.trainingFundEmployee) ?? toN(con.training_fund?.employee_amount),
  };
}

function fmt(n) {
  if (n == null) return null;
  return `₪${Number(n).toLocaleString('he-IL')}`;
}

function pct(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev) * 100).toFixed(1);
}

function buildPrompt(current, previous) {
  const lines = [
    'אתה יועץ פיננסי ידידותי בעברית.',
    'כתוב סיכום קצר ומועיל של 3-5 משפטים על תלוש השכר הנוכחי.',
    'השתמש בנתונים בלבד — אל תמציא. סיים עם פעולה אחת מומלצת (אם יש).',
    '',
    `תלוש נוכחי (${current.period || 'לא ידוע'}):`,
    current.gross != null ? `ברוטו: ${fmt(current.gross)}` : null,
    current.net != null ? `נטו: ${fmt(current.net)}` : null,
    current.tax != null ? `מס הכנסה: ${fmt(current.tax)}` : null,
    current.nationalInsurance != null ? `ביטוח לאומי: ${fmt(current.nationalInsurance)}` : null,
    current.pensionEmployee != null ? `פנסיה עובד: ${fmt(current.pensionEmployee)}` : null,
    current.pensionEmployer != null ? `פנסיה מעסיק: ${fmt(current.pensionEmployer)}` : null,
    current.trainingFundEmployee != null ? `קרן השתלמות: ${fmt(current.trainingFundEmployee)}` : null,
  ].filter(Boolean).join('\n');

  if (!previous) return lines;

  const diffLines = [
    '',
    `תלוש קודם (${previous.period || 'לא ידוע'}):`,
    previous.gross != null ? `ברוטו: ${fmt(previous.gross)}` : null,
    previous.net != null ? `נטו: ${fmt(previous.net)}` : null,
  ].filter(Boolean);

  const changes = [];
  const grossPct = pct(current.gross, previous.gross);
  if (grossPct !== null) changes.push(`ברוטו ${Number(grossPct) >= 0 ? 'עלה' : 'ירד'} ב-${Math.abs(Number(grossPct))}%`);
  const taxPct = pct(current.tax, previous.tax);
  if (taxPct !== null) changes.push(`מס ${Number(taxPct) >= 0 ? 'עלה' : 'ירד'} ב-${Math.abs(Number(taxPct))}%`);

  return [lines, ...diffLines, changes.length ? `\nשינויים עיקריים: ${changes.join(', ')}` : ''].join('\n');
}

/**
 * Generate and persist an AI digest for a completed payslip document.
 * Non-blocking — errors are logged but not thrown.
 *
 * @param {string} userId
 * @param {object} document - Mongoose Document object (status=completed)
 */
async function generateAndSaveDigest(userId, document) {
  const client = getClient();
  if (!client) return; // no API key — skip silently
  if (!llmBudget.canSpend()) return; // budget guard — skip silently

  try {
    const current = extractSummary(document);
    if (current.gross == null && current.net == null) return; // not enough data

    // Fetch the most recent previous completed payslip for this user
    const previousDoc = await Document.findOne({
      user: userId,
      status: 'completed',
      _id: { $ne: document._id },
    })
      .sort({ 'metadata.periodYear': -1, 'metadata.periodMonth': -1, createdAt: -1 })
      .lean();

    const previous = previousDoc ? extractSummary(previousDoc) : null;
    const prompt = buildPrompt(current, previous);

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    llmBudget.record(response.usage);

    const text = response.content
      ?.filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    if (!text) return;

    await Document.findByIdAndUpdate(document._id, {
      $set: {
        'digest.text': text,
        'digest.generatedAt': new Date(),
        'digest.model': HAIKU_MODEL,
      },
    });
  } catch (err) {
    console.error('[digestService] failed to generate digest:', err?.message);
  }
}

module.exports = { generateAndSaveDigest };
