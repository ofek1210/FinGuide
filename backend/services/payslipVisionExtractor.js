'use strict';

const crypto = require('crypto');
const { PAYSLIP_VISION_RESPONSE_SCHEMA } = require('../schemas/payslipVisionSchema');
const { buildPayslipVisionPrompt } = require('./payslipVisionPrompt');
const visionCache = require('./payslipVisionCache');
const llmBudget = require('./llmBudget');
const { canonicalPeriodMonth } = require('../utils/payslipPeriod');
const {
  VISION_MODEL,
  VISION_MAX_TOKENS,
  VISION_CONFIDENCE_THRESHOLD,
  VISION_DUAL_CROP,
} = require('../config/payslipExtractionConfig');

let AnthropicCtor;
let cachedClient;

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (cachedClient) return cachedClient;
  if (!AnthropicCtor) {
    // eslint-disable-next-line global-require
    AnthropicCtor = require('@anthropic-ai/sdk');
  }
  const ClientClass = AnthropicCtor.default || AnthropicCtor;
  cachedClient = new ClientClass();
  return cachedClient;
}

function _setAnthropicClientForTests(client) {
  cachedClient = client;
}

function clearCache() {
  visionCache.clear();
  cachedClient = null;
}

function toFiniteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function toStringOrNull(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

/**
 * Map flat vision model output → schema_version 1.9 analysisData shape.
 */
function normalizeVisionExtraction(raw, { imageSha256, model, audit } = {}) {
  const conf = raw?.confidence || {};
  const pensionEmployee = toFiniteOrNull(raw.pension_employee);
  const pensionEmployer = toFiniteOrNull(raw.pension_employer);
  const studyEmployee = toFiniteOrNull(raw.study_employee);
  const studyEmployer = toFiniteOrNull(raw.study_employer);

  let pensionTotal = toFiniteOrNull(raw.pension_participation_total);
  if (pensionTotal === null && pensionEmployee !== null && pensionEmployer !== null) {
    pensionTotal = +(pensionEmployee + pensionEmployer).toFixed(2);
  }

  let studyTotal = toFiniteOrNull(raw.study_participation_total);
  if (studyTotal === null && studyEmployee !== null && studyEmployer !== null) {
    studyTotal = +(studyEmployee + studyEmployer).toFixed(2);
  }

  const gross = toFiniteOrNull(raw.gross_total);
  const net = toFiniteOrNull(raw.net_payable);
  const incomeTax = toFiniteOrNull(raw.income_tax);
  const nationalInsurance = toFiniteOrNull(raw.national_insurance);
  const healthInsurance = toFiniteOrNull(raw.health_insurance);

  let mandatory = toFiniteOrNull(raw.mandatory_total);
  let mandatoryDerived = false;
  if (mandatory === null) {
    const parts = [incomeTax, nationalInsurance, healthInsurance].filter(Number.isFinite);
    if (parts.length > 0) {
      mandatory = +parts.reduce((sum, value) => sum + value, 0).toFixed(2);
      mandatoryDerived = true;
    }
  }
  const grossMinusMandatory =
    Number.isFinite(gross) && Number.isFinite(mandatory)
      ? +(gross - mandatory).toFixed(2)
      : undefined;

  const groupScores = Object.values(conf).filter(Number.isFinite);
  const avgConfidence = groupScores.length
    ? groupScores.reduce((s, v) => s + v, 0) / groupScores.length
    : 0;

  const qualityConfidence =
    avgConfidence >= 0.85 ? 'high' : avgConfidence >= VISION_CONFIDENCE_THRESHOLD ? 'medium' : 'low';

  const periodMonth = canonicalPeriodMonth(raw.period_month);

  const buildFieldMeta = (value, groupConf, fieldName) => ({
    confidence: Number.isFinite(groupConf) ? +groupConf.toFixed(2) : 0,
    source: 'vision_llm',
    evidence_category: 'vision_extraction',
    section: fieldName,
    reason: null,
    abstained: value === null || value === undefined,
  });

  const fields = {
    period_month: buildFieldMeta(periodMonth, conf.period, 'period'),
    gross_total: buildFieldMeta(gross, conf.salary, 'salary'),
    net_payable: buildFieldMeta(net, conf.salary, 'salary'),
    mandatory_total: buildFieldMeta(mandatory, conf.deductions, 'deductions'),
    income_tax: buildFieldMeta(incomeTax, conf.deductions, 'deductions'),
    national_insurance: buildFieldMeta(nationalInsurance, conf.deductions, 'deductions'),
    health_insurance: buildFieldMeta(healthInsurance, conf.deductions, 'deductions'),
    pension_employee: buildFieldMeta(pensionEmployee, conf.contributions, 'contributions'),
    pension_employer: buildFieldMeta(pensionEmployer, conf.contributions, 'contributions'),
    study_employee: buildFieldMeta(studyEmployee, conf.contributions, 'contributions'),
    study_employer: buildFieldMeta(studyEmployer, conf.contributions, 'contributions'),
    employee_name: buildFieldMeta(raw.employee_name, conf.parties, 'parties'),
    employee_id: buildFieldMeta(raw.employee_id, conf.parties, 'parties'),
    employer_name: buildFieldMeta(raw.employer_name, conf.parties, 'parties'),
  };

  return {
    schema_version: '1.9',
    period: periodMonth ? { month: periodMonth } : {},
    salary: {
      gross_total: gross ?? undefined,
      net_payable: net ?? undefined,
      gross_minus_mandatory_deductions: grossMinusMandatory,
      components: [],
    },
    deductions: {
      mandatory: {
        total: mandatory ?? undefined,
        total_is_derived: mandatoryDerived,
        income_tax: incomeTax ?? undefined,
        national_insurance: nationalInsurance ?? undefined,
        health_insurance: healthInsurance ?? undefined,
      },
      voluntary: {},
      voluntary_total: toFiniteOrNull(raw.voluntary_total) ?? undefined,
    },
    contributions: {
      pension: {
        base_salary_for_pension: toFiniteOrNull(raw.pension_base) ?? undefined,
        employee: pensionEmployee ?? undefined,
        employer: pensionEmployer ?? undefined,
        participation_total: pensionTotal ?? undefined,
        severance: toFiniteOrNull(raw.pension_severance) ?? undefined,
        employee_rate_percent: toFiniteOrNull(raw.pension_employee_rate_percent) ?? undefined,
        employer_rate_percent: toFiniteOrNull(raw.pension_employer_rate_percent) ?? undefined,
        severance_rate_percent: toFiniteOrNull(raw.pension_severance_rate_percent) ?? undefined,
        detection: {
          sectionDetected: pensionEmployee !== null || pensionEmployer !== null,
          noDeposit: pensionEmployee === null && pensionEmployer === null,
        },
      },
      study_fund: {
        base_salary_for_study_fund: toFiniteOrNull(raw.study_base) ?? undefined,
        employee: studyEmployee ?? undefined,
        employer: studyEmployer ?? undefined,
        participation_total: studyTotal ?? undefined,
        employee_rate_percent: toFiniteOrNull(raw.study_employee_rate_percent) ?? undefined,
        employer_rate_percent: toFiniteOrNull(raw.study_employer_rate_percent) ?? undefined,
        detection: {
          sectionDetected: studyEmployee !== null || studyEmployer !== null,
          noDeposit: studyEmployee === null && studyEmployer === null,
        },
      },
    },
    tax: {
      marginal_tax_rate_percent: toFiniteOrNull(raw.marginal_tax_rate_percent) ?? undefined,
      tax_credit_points: toFiniteOrNull(raw.tax_credit_points) ?? undefined,
    },
    employment: {
      employment_start_date: toStringOrNull(raw.employment_start_date) ?? undefined,
      job_percent: toFiniteOrNull(raw.job_percent) ?? undefined,
    },
    parties: {
      employer_name: toStringOrNull(raw.employer_name) ?? undefined,
      employee_name: toStringOrNull(raw.employee_name) ?? undefined,
      employee_id: toStringOrNull(raw.employee_id) ?? undefined,
    },
    insurances: {
      hmo: toStringOrNull(raw.hmo) ?? undefined,
    },
    quality: {
      score: +avgConfidence.toFixed(2),
      confidence: qualityConfidence,
      warnings: raw.notes ? [raw.notes] : [],
      fields,
      flaggedInconsistencies: [],
      extraction_audit: audit || null,
      debug: {
        source_type: 'vision_llm',
        model,
        image_sha256: imageSha256,
        confidence_groups: conf,
      },
    },
    raw: {
      ocr_engine: 'claude-vision',
      ocr_lang: 'heb+eng',
      text_sha256: imageSha256 || crypto.createHash('sha256').update('vision').digest('hex'),
      rawText: '',
      ocr_text: '',
      extractionMethod: 'vision',
    },
    summary: {
      workingDays: toFiniteOrNull(raw.working_days),
      workingHours: toFiniteOrNull(raw.working_hours),
      vacationDays: toFiniteOrNull(raw.vacation_days),
      sickDays: toFiniteOrNull(raw.sick_days),
      taxCreditPoints: toFiniteOrNull(raw.tax_credit_points) ?? undefined,
    },
  };
}

function buildVisionMessageContent(imageBuffer, { mimeType, metadataCrop, paymentsCrop } = {}) {
  const useDualCrop =
    VISION_DUAL_CROP &&
    metadataCrop &&
    paymentsCrop &&
    metadataCrop.length > 0 &&
    paymentsCrop.length > 0;

  if (useDualCrop) {
    return [
      { type: 'text', text: 'IMAGE 1 — top/metadata section:' },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: metadataCrop.toString('base64'),
        },
      },
      { type: 'text', text: 'IMAGE 2 — bottom/payment tables section:' },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: paymentsCrop.toString('base64'),
        },
      },
      { type: 'text', text: buildPayslipVisionPrompt({ dualCrop: true }) },
    ];
  }

  return [
    {
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: imageBuffer.toString('base64') },
    },
    { type: 'text', text: buildPayslipVisionPrompt({ dualCrop: false }) },
  ];
}

function buildVisionCacheSha(imageBuffer, imageSha256, metadataCrop, paymentsCrop) {
  if (imageSha256) {
    return imageSha256;
  }
  if (VISION_DUAL_CROP && metadataCrop && paymentsCrop) {
    return crypto
      .createHash('sha256')
      .update(Buffer.concat([imageBuffer, metadataCrop, paymentsCrop]))
      .digest('hex');
  }
  return crypto.createHash('sha256').update(imageBuffer).digest('hex');
}

/**
 * Extract payslip from a single page image buffer via Claude vision.
 *
 * @returns {Promise<{ raw: object, normalized: object, audit: object, fromCache: boolean }>}
 */
async function extractPayslipFromImage(
  imageBuffer,
  {
    mimeType = 'image/png',
    imageSha256,
    pageIndex = 0,
    metadataCrop = null,
    paymentsCrop = null,
  } = {},
) {
  const model = VISION_MODEL;
  const sha = buildVisionCacheSha(imageBuffer, imageSha256, metadataCrop, paymentsCrop);

  const cached = visionCache.get(sha, model);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const client = getAnthropicClient();
  if (!client) {
    throw new Error('ANTHROPIC_API_KEY is required for vision payslip extraction (PAYSLIP_EXTRACTION_MODE=vision).');
  }

  if (!llmBudget.canSpend()) {
    throw new Error('Claude API budget exhausted — cannot run vision payslip extraction.');
  }

  const startedAt = Date.now();
  const messageContent = buildVisionMessageContent(imageBuffer, { mimeType, metadataCrop, paymentsCrop });
  const maxTokens = llmBudget.cap(VISION_MAX_TOKENS);
  const usedDualCrop = messageContent.length > 2;

  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature: 0,
      output_config: {
        format: { type: 'json_schema', schema: PAYSLIP_VISION_RESPONSE_SCHEMA },
      },
      messages: [{
        role: 'user',
        content: messageContent,
      }],
    });
    llmBudget.record(response.usage);
  } catch (error) {
    throw new Error(`Vision extraction API call failed: ${error.message}`);
  }

  const textBlock = (response.content || []).find(b => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('Vision extraction returned empty response.');
  }

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (error) {
    throw new Error(`Vision extraction returned non-JSON: ${error.message}`);
  }

  const latencyMs = Date.now() - startedAt;
  const usage = response.usage || {};
  const audit = {
    model,
    pageIndex,
    latencyMs,
    inputTokens: usage.input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    confidenceGroups: parsed.confidence || {},
    sanityPassed: null,
    imageSha256: sha,
    cached: false,
    dualCrop: usedDualCrop,
  };

  // eslint-disable-next-line no-console
  console.log('[payslipVision] page extracted', {
    model,
    pageIndex,
    fromCache: false,
    dualCrop: usedDualCrop,
    inputTokens: audit.inputTokens,
    outputTokens: audit.outputTokens,
    latencyMs,
  });

  const normalized = normalizeVisionExtraction(parsed, { imageSha256: sha, model, audit });

  const result = { raw: parsed, normalized, audit, fromCache: false };
  visionCache.set(sha, model, result);
  return result;
}

module.exports = {
  extractPayslipFromImage,
  normalizeVisionExtraction,
  getAnthropicClient,
  clearCache,
  _setAnthropicClientForTests,
};
