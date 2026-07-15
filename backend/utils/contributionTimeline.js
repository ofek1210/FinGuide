const { detectFundContributionStatus } = require('./detectFundWithoutDeposit');
const { normalizeAmount } = require('./numeric');
const {
  resolvePayslipPeriod,
  monthKey,
  compareYearMonth,
  selectLatestDoc,
} = require('./payslipPeriod');
const { getDepositContinuityConfig } = require('../config/depositContinuityConfig');

const isPayslipDocument = doc =>
  (doc?.status === 'completed' || doc?.status === 'needs_review') &&
  doc?.analysisData &&
  typeof doc.analysisData === 'object' &&
  (doc.metadata?.category === 'payslip' || !doc.metadata?.category);

const toAmount = value => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  try {
    return normalizeAmount(value);
  } catch {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
};

const severanceOnlyDeposit = (analysisData, fundType) => {
  if (fundType !== 'pension') {
    return false;
  }
  const block = analysisData?.contributions?.pension || {};
  const emp = toAmount(block.employee) ?? 0;
  const empl = toAmount(block.employer) ?? 0;
  const sev = toAmount(block.severance) ?? 0;
  return sev > 0 && emp === 0 && empl === 0;
};

const classifyTimelineEntry = (status, analysisData, fundType, continuityConfig) => {
  if (status.missingLine || status.ambiguousRoles) {
    return 'uncertain';
  }
  if (!status.fundSectionDetected) {
    return 'noFund';
  }
  if (!status.noDeposit && status.depositTotal > 0) {
    return 'hasDeposit';
  }
  if (
    continuityConfig?.countSeveranceAsDeposit &&
    severanceOnlyDeposit(analysisData, fundType)
  ) {
    return 'hasDeposit';
  }
  if (status.applies || (status.fundSectionDetected && status.noDeposit)) {
    return 'noDepositOnPayslip';
  }
  return 'uncertain';
};

const buildFundTimeline = (documents, fundType, options = {}) => {
  const continuityConfig = options.continuityConfig || getDepositContinuityConfig();
  const payslips = (documents || []).filter(isPayslipDocument);
  const byMonth = new Map();

  for (const doc of payslips) {
    const period = resolvePayslipPeriod(doc);
    if (period.incompletePeriod) {
      continue;
    }
    const key = monthKey(period.year, period.month);
    const existing = byMonth.get(key);
    if (existing) {
      const chosen = selectLatestDoc(existing.doc, doc);
      if (chosen !== doc) {
        continue;
      }
    }
    const status = detectFundContributionStatus(doc.analysisData, fundType);
    const periodKey = key;
    const documentId = doc._id?.toString?.() || doc._id || null;
    byMonth.set(key, {
      doc,
      documentId,
      year: period.year,
      month: period.month,
      key,
      periodKey,
      status,
      classification: classifyTimelineEntry(
        status,
        doc.analysisData,
        fundType,
        continuityConfig,
      ),
    });
  }

  const entries = [...byMonth.values()].sort((a, b) => compareYearMonth(a, b));
  return { byMonth, entries };
};

module.exports = {
  isPayslipDocument,
  classifyTimelineEntry,
  buildFundTimeline,
  severanceOnlyDeposit,
};
