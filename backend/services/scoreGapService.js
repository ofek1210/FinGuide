const Document = require('../models/Document');
const { detectFundContributionStatus, FUND_CONFIG } = require('../utils/detectFundWithoutDeposit');
const { monthKey } = require('../utils/payslipPeriod');
const { buildFinancialHealthScore } = require('./financialHealthScoreService');
const { buildYearEntries, HEBREW_MONTHS } = require('./taxAssistantService');

// MVP scope: pension + study fund contribution amounts that are missing on an
// existing payslip. These are the gaps the agent can fill via a single question.
const AGENT_FUND_TYPES = Object.freeze(['pension', 'study_fund']);
const FUND_ROLES = Object.freeze(['employee', 'employer']);

const ROLE_LABEL = Object.freeze({
  employee: 'חלק העובד',
  employer: 'חלק המעסיק',
});

// Which score category each fund moves. Pension feeds the financial-health
// score directly (עקביות פנסיה); study fund only clears a finding today.
const FUND_IMPACT = Object.freeze({
  pension: { kind: 'score', label: 'עקביות פנסיה' },
  study_fund: { kind: 'finding', label: 'קרן השתלמות ללא הפקדה' },
});

// The agent only asks about funds whose answer actually moves the financial-health
// score. Study fund today only clears a finding, so it is excluded from questions.
const SCORE_FUND_TYPES = Object.freeze(
  AGENT_FUND_TYPES.filter(fundType => FUND_IMPACT[fundType].kind === 'score'),
);

const periodLabel = (year, month) => `${HEBREW_MONTHS[month] || month} ${year}`;

const buildQuestion = (fundType, role, year, month) => {
  const fund = FUND_CONFIG[fundType].labelHe;
  const role_ = ROLE_LABEL[role];
  return `כמה הופרש ל${fund} (${role_}) בתלוש של ${periodLabel(year, month)}?`;
};

// A role is genuinely "missing" only when its amount was not extracted at all
// (null/undefined). An explicit 0 is real data — a "no deposit" finding, not a gap —
// so we never ask the user to re-enter a confirmed zero.
const roleAmountMissing = amount => amount === null || amount === undefined;

const buildPayslipFieldGaps = entries => {
  const gaps = [];

  entries.forEach(({ doc, period }) => {
    const { year, month } = period;
    if (!year || !month) return;
    const key = monthKey(year, month);
    const documentId = doc._id?.toString?.() || String(doc._id);

    SCORE_FUND_TYPES.forEach(fundType => {
      const config = FUND_CONFIG[fundType];
      const status = detectFundContributionStatus(doc.analysisData, fundType);
      // Only ask when the fund section is genuinely itemized on THIS payslip.
      // Slips where the fund isn't present are skipped to avoid fabricated
      // questions; the per-role check below skips confirmed (non-null) amounts.
      if (!status.fundSectionDetected) return;

      const amounts = { employee: status.employeeAmount, employer: status.employerAmount };
      FUND_ROLES.forEach(role => {
        if (!roleAmountMissing(amounts[role])) return;
        gaps.push({
          id: `${fundType}.${role}.${key}`,
          kind: 'payslip_field',
          fundType,
          role,
          documentId,
          period: key,
          periodLabel: periodLabel(year, month),
          fieldLabel: `${config.labelHe} – ${ROLE_LABEL[role]}`,
          question: buildQuestion(fundType, role, year, month),
          inputType: 'currency',
          improves: FUND_IMPACT[fundType],
          // sort hints
          _sort: { fundOrder: fundType === 'pension' ? 0 : 1, roleOrder: role === 'employee' ? 0 : 1, year, month },
        });
      });
    });
  });

  gaps.sort((a, b) => {
    const sa = a._sort;
    const sb = b._sort;
    if (sa.year !== sb.year) return sa.year - sb.year;
    if (sa.month !== sb.month) return sa.month - sb.month;
    if (sa.fundOrder !== sb.fundOrder) return sa.fundOrder - sb.fundOrder;
    return sa.roleOrder - sb.roleOrder;
  });

  return gaps.map(({ _sort, ...gap }) => gap);
};

const buildMissingMonthGaps = (entries, year) => {
  const now = new Date();
  const lastMonth = year < now.getFullYear() ? 12 : now.getMonth() + 1;
  const present = new Set(entries.map(({ period }) => period.month).filter(Boolean));
  const gaps = [];
  for (let month = 1; month <= lastMonth; month += 1) {
    if (present.has(month)) continue;
    gaps.push({
      id: `missing_payslip.${monthKey(year, month)}`,
      kind: 'missing_document',
      period: monthKey(year, month),
      periodLabel: periodLabel(year, month),
      fieldLabel: 'תלוש חסר',
      question: `לא נמצא תלוש לחודש ${periodLabel(year, month)}. כדי להשלים את הציון, מומלץ להעלות אותו.`,
      actionUrl: '/documents',
      improves: { kind: 'score', label: 'שלמות מסמכים' },
    });
  }
  return gaps;
};

/**
 * Build the list of actionable gaps for the score agent, plus the current score.
 */
const buildScoreGaps = async (userId, yearInput) => {
  const year = Number(yearInput) || new Date().getFullYear();

  const [documents, scoreResult] = await Promise.all([
    Document.find({ user: userId }).sort('-uploadedAt').lean(),
    buildFinancialHealthScore(userId, year),
  ]);

  const { entries } = buildYearEntries(documents, year);

  const fillableGaps = buildPayslipFieldGaps(entries);
  const missingMonthGaps = buildMissingMonthGaps(entries, year);

  return {
    year,
    score: scoreResult.score,
    level: scoreResult.level,
    label: scoreResult.label,
    gaps: [...fillableGaps, ...missingMonthGaps],
    fillableCount: fillableGaps.length,
  };
};

// summary.* field name that the score + history aggregation read per fund/role
const SUMMARY_FIELD = Object.freeze({
  pension: { employee: 'pensionEmployee', employer: 'pensionEmployer' },
  study_fund: { employee: 'trainingFundEmployee', employer: 'trainingFundEmployer' },
});

/**
 * Parse a payslip_field gap id into its parts. Returns null if malformed.
 * Format: `${fundType}.${role}.${YYYY-MM}` e.g. "pension.employee.2023-01".
 */
const parseGapId = gapId => {
  if (typeof gapId !== 'string') return null;
  const parts = gapId.split('.');
  if (parts.length !== 3) return null;
  const [fundType, role, period] = parts;
  if (!AGENT_FUND_TYPES.includes(fundType)) return null;
  if (!FUND_ROLES.includes(role)) return null;
  if (!/^\d{4}-\d{2}$/.test(period)) return null;
  return { fundType, role, period };
};

/**
 * Write a user-provided contribution amount onto a payslip's analysisData so that
 * both the financial-health score and the findings detectors pick it up.
 * Mutates and marks the (non-lean) Mongoose doc; caller is responsible for save().
 */
const applyGapAnswer = (doc, { fundType, role }, value) => {
  const config = FUND_CONFIG[fundType];
  if (!config) throw new Error(`Unsupported fundType: ${fundType}`);
  if (!FUND_ROLES.includes(role)) throw new Error(`Unsupported role: ${role}`);

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('invalid amount');

  const analysis =
    doc.analysisData && typeof doc.analysisData === 'object' ? doc.analysisData : {};
  analysis.summary = analysis.summary || {};
  analysis.contributions = analysis.contributions || {};
  const block = analysis.contributions[config.contributionKey] || {};
  analysis.contributions[config.contributionKey] = block;

  // OCR-style canonical fields (read by the fund-without-deposit detector)
  block[role] = amount;
  block[`${role}_amount`] = amount;

  // summary field (read by the score + payslip history aggregation)
  analysis.summary[SUMMARY_FIELD[fundType][role]] = amount;

  // Clear a "missing line" warning so the section is treated as detected
  if (Array.isArray(analysis.quality?.warning_categories)) {
    analysis.quality.warning_categories = analysis.quality.warning_categories.filter(
      cat => cat !== config.missingLineCategory,
    );
  }

  const employee = Number(block.employee) || 0;
  const employer = Number(block.employer) || 0;
  const severance = Number(block.severance) || 0;
  block.detection = {
    ...(block.detection || {}),
    sectionDetected: true,
    noDeposit: employee + employer + severance === 0,
    source: 'manual',
    manualAt: new Date().toISOString(),
  };

  // Provenance log of user-entered values
  analysis.manualEntries = analysis.manualEntries || {};
  analysis.manualEntries[`${fundType}.${role}`] = {
    value: amount,
    enteredAt: new Date().toISOString(),
  };

  doc.analysisData = analysis;
  if (typeof doc.markModified === 'function') doc.markModified('analysisData');
  return doc;
};

module.exports = {
  buildScoreGaps,
  buildPayslipFieldGaps,
  parseGapId,
  applyGapAnswer,
  AGENT_FUND_TYPES,
  FUND_ROLES,
};
