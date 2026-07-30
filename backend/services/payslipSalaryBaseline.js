'use strict';

/**
 * Cross-payslip salary baseline: median net/gross from the user's prior
 * completed payslips. Used to boost plausible candidates and penalize
 * outliers (e.g. agreement-year "2009" promoted to net_payable).
 *
 * Bands stay wide enough for convalescence / bonus months.
 */

const Document = require('../models/Document');

const NET_LOW_RATIO = 0.45;
const NET_HIGH_RATIO = 1.75;
const GROSS_LOW_RATIO = 0.4;
const GROSS_HIGH_RATIO = 2.25;
const MIN_PLAUSIBLE_NET = 3000;
const MIN_PLAUSIBLE_GROSS = 5000;

function median(nums) {
  if (!Array.isArray(nums) || !nums.length) {
    return null;
  }
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function looksLikeCalendarYear(value) {
  return (
    Number.isFinite(value) &&
    value >= 1990 &&
    value <= 2099 &&
    Math.abs(value - Math.round(value)) < 0.001
  );
}

/**
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {{ excludeDocumentId?: string }} [options]
 * @returns {Promise<object|null>}
 */
async function loadSalaryBaselineForUser(userId, { excludeDocumentId } = {}) {
  if (!userId) {
    return null;
  }

  const query = {
    user: userId,
    status: 'completed',
    'analysisData.salary.net_payable': { $type: 'number' },
  };
  if (excludeDocumentId) {
    query._id = { $ne: excludeDocumentId };
  }

  let docs;
  try {
    docs = await Document.find(query)
      .select('analysisData.salary')
      .sort({ uploadedAt: -1 })
      .limit(24)
      .lean();
  } catch {
    return null;
  }

  const nets = [];
  const grosses = [];
  for (const doc of docs || []) {
    const net = doc.analysisData?.salary?.net_payable;
    const gross = doc.analysisData?.salary?.gross_total;
    if (Number.isFinite(net) && net >= MIN_PLAUSIBLE_NET && !looksLikeCalendarYear(net)) {
      nets.push(net);
    }
    if (Number.isFinite(gross) && gross >= MIN_PLAUSIBLE_GROSS && !looksLikeCalendarYear(gross)) {
      grosses.push(gross);
    }
  }

  if (!nets.length && !grosses.length) {
    return null;
  }

  const medianNet = median(nets);
  const medianGross = median(grosses);

  return {
    sampleCount: Math.max(nets.length, grosses.length),
    medianNet,
    medianGross,
    netMin: Number.isFinite(medianNet) ? medianNet * NET_LOW_RATIO : null,
    netMax: Number.isFinite(medianNet) ? medianNet * NET_HIGH_RATIO : null,
    grossMin: Number.isFinite(medianGross) ? medianGross * GROSS_LOW_RATIO : null,
    grossMax: Number.isFinite(medianGross) ? medianGross * GROSS_HIGH_RATIO : null,
  };
}

/**
 * Adjust candidate scores in-place using historical salary bands.
 * @param {object} store
 * @param {object|null} baseline
 */
function applySalaryBaselineToCandidates(store, baseline) {
  if (!baseline || !store) {
    return;
  }

  for (const field of ['net_payable', 'gross_total']) {
    const candidates = store[field];
    if (!Array.isArray(candidates) || !candidates.length) {
      continue;
    }

    const min = field === 'net_payable' ? baseline.netMin : baseline.grossMin;
    const max = field === 'net_payable' ? baseline.netMax : baseline.grossMax;
    const medianVal = field === 'net_payable' ? baseline.medianNet : baseline.medianGross;
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(medianVal)) {
      continue;
    }

    for (const candidate of candidates) {
      if (!Number.isFinite(candidate?.value)) {
        continue;
      }

      if (looksLikeCalendarYear(candidate.value)) {
        candidate.score = 0;
        candidate.reason = [candidate.reason, 'baseline: calendar-year rejected'].filter(Boolean).join(' ');
        continue;
      }

      if (candidate.value >= min && candidate.value <= max) {
        const closeness = 1 - Math.abs(candidate.value - medianVal) / Math.max(medianVal, 1);
        candidate.score = Math.min(1, (candidate.score || 0) + 0.08 + Math.max(0, closeness) * 0.05);
        candidate.reason = [candidate.reason, 'baseline: in-band'].filter(Boolean).join(' ');
      } else if (candidate.value < min * 0.65 || candidate.value > max * 1.35) {
        candidate.score = Math.max(0, (candidate.score || 0) - 0.55);
        candidate.reason = [candidate.reason, 'baseline: far-outlier'].filter(Boolean).join(' ');
      } else {
        candidate.score = Math.max(0, (candidate.score || 0) - 0.18);
        candidate.reason = [candidate.reason, 'baseline: soft-outlier'].filter(Boolean).join(' ');
      }
    }
  }
}

/**
 * Drop / flag resolved salary if it is wildly inconsistent with prior payslips.
 * @returns {{ net: number|undefined, gross: number|undefined, warnings: string[] }}
 */
function sanitizeResolvedSalaryAgainstBaseline(gross, net, baseline) {
  const warnings = [];
  let nextGross = gross;
  let nextNet = net;

  if (looksLikeCalendarYear(nextNet)) {
    warnings.push('Rejected net_payable that looks like a calendar year (e.g. agreement label).');
    nextNet = undefined;
  }
  if (looksLikeCalendarYear(nextGross)) {
    warnings.push('Rejected gross_total that looks like a calendar year.');
    nextGross = undefined;
  }

  if (
    Number.isFinite(nextGross) &&
    Number.isFinite(nextNet) &&
    nextGross > 0 &&
    nextNet / nextGross < 0.2
  ) {
    warnings.push(
      `Rejected implausible net/gross ratio (${nextNet}/${nextGross}); net cleared for re-extraction.`,
    );
    nextNet = undefined;
  }

  if (baseline && Number.isFinite(baseline.medianNet) && Number.isFinite(nextNet)) {
    if (nextNet < baseline.netMin * 0.5 || nextNet > baseline.netMax * 1.5) {
      warnings.push(
        `net_payable ${nextNet} is far from prior median ${Math.round(baseline.medianNet)}; flagged low confidence.`,
      );
    }
  }

  return { gross: nextGross, net: nextNet, warnings };
}

module.exports = {
  loadSalaryBaselineForUser,
  applySalaryBaselineToCandidates,
  sanitizeResolvedSalaryAgainstBaseline,
  median,
  looksLikeCalendarYear,
};
