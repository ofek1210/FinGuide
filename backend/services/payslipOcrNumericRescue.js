/**
 * Fallback extraction when Hebrew labels are garbled but numeric layout is intact.
 * Common with PDFs whose embedded fonts map incorrectly (U+FFFD mojibake).
 */

const { parseMoney, linesOf, isLikelyBrokenHebrew } = require('./payslipOcrShared');

const LEFT_AMOUNT_RE = /^\s*([\d]{1,3}(?:,\d{3})*\.\d{2})(?:\s+|$)/;
const TRAILING_AMOUNT_RE = /([\d]{1,3}(?:,\d{3})*\.\d{2})\s*$/;

function collectLeftMarginAmounts(lines, maxLines = 35) {
  const amounts = [];
  for (let i = 0; i < Math.min(lines.length, maxLines); i += 1) {
    const line = lines[i];
    const m = line.match(LEFT_AMOUNT_RE);
    if (!m) continue;
    const value = parseMoney(m[1]);
    if (Number.isFinite(value) && value >= 500 && value <= 200000) {
      amounts.push({ value, lineIndex: i });
    }
  }
  return amounts;
}

function collectTrailingAmounts(lines) {
  const amounts = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(TRAILING_AMOUNT_RE);
    if (!m) continue;
    const value = parseMoney(m[1]);
    if (Number.isFinite(value) && value >= 500 && value <= 200000) {
      amounts.push({ value, lineIndex: i });
    }
  }
  return amounts;
}

function pickCluster(amounts) {
  if (amounts.length < 2) return null;

  // Header block: first consecutive left-margin run (e.g. gross, deductions..., net)
  let run = [amounts[0]];
  for (let i = 1; i < amounts.length; i += 1) {
    if (amounts[i].lineIndex - amounts[i - 1].lineIndex <= 4) {
      run.push(amounts[i]);
    } else if (run.length >= 2) {
      break;
    } else {
      run = [amounts[i]];
    }
  }

  if (run.length >= 2) return run.map(r => r.value);

  return amounts.slice(0, 4).map(r => r.value);
}

function assignFromCluster(cluster) {
  if (!cluster || cluster.length < 2) return null;

  const gross = Math.max(...cluster);
  const netCandidates = cluster.filter(v => v < gross * 0.98 && v >= gross * 0.3);
  const net = netCandidates.length
    ? netCandidates[netCandidates.length - 1]
    : Math.min(...cluster.filter(v => v !== gross));

  if (!Number.isFinite(gross) || !Number.isFinite(net) || net >= gross) return null;

  const middle = cluster.filter(v => v !== gross && v !== net);
  const gap = gross - net;
  const middleSum = middle.reduce((s, v) => s + v, 0);

  let income_tax = null;
  let national_insurance = null;
  let health_insurance = null;

  if (middle.length >= 1 && Math.abs(middleSum - gap) / gap < 0.08) {
    if (middle.length >= 1) income_tax = middle[0];
    if (middle.length >= 2) national_insurance = middle[1];
    if (middle.length >= 3) health_insurance = middle[2];
  } else if (middle.length === 1 && Math.abs(middle[0] - gap) / gap < 0.08) {
    income_tax = middle[0];
  }

  const mandatory_total = middle.length && Math.abs(middleSum - gap) / gap < 0.08
    ? Math.round(middleSum * 100) / 100
    : Math.round(gap * 100) / 100;

  return {
    gross_total: gross,
    net_payable: net,
    income_tax,
    national_insurance,
    health_insurance,
    mandatory_total,
    confidence: middle.length && Math.abs(middleSum - gap) / gap < 0.08 ? 0.72 : 0.55,
  };
}

/**
 * @param {string} fullText
 * @returns {object|null}
 */
function rescueFromLayoutText(fullText) {
  if (!fullText || typeof fullText !== 'string') return null;

  const lines = linesOf(fullText);
  const leftAmounts = collectLeftMarginAmounts(lines);
  let cluster = pickCluster(leftAmounts);

  if (!cluster || cluster.length < 2) {
    const trailing = collectTrailingAmounts(lines);
    const freq = new Map();
    for (const { value } of trailing) {
      freq.set(value, (freq.get(value) || 0) + 1);
    }
    const repeated = [...freq.entries()]
      .filter(([, count]) => count >= 2)
      .map(([value]) => value)
      .sort((a, b) => b - a);
    if (repeated.length >= 1) {
      const gross = repeated[0];
      const net = repeated.find(v => v < gross * 0.98 && v >= gross * 0.3);
      if (net) cluster = [gross, net];
    }
  }

  const assigned = assignFromCluster(cluster);
  if (!assigned) return null;

  return {
    ...assigned,
    method: 'numeric_rescue',
  };
}

/**
 * Explicit numeric rescue: fills gross/net/deductions from the numeric layout
 * ONLY when both conditions hold:
 * 1. Critical salary fields are missing after normal extraction, and
 * 2. The text's Hebrew labels are unusable (mojibake / broken encoding) —
 *    otherwise a rescue would silently mask label-extraction bugs.
 */
function applyNumericRescue(result, fullText) {
  const gross = result?.salary?.gross_total;
  const net = result?.salary?.net_payable;

  const needsRescue =
    !Number.isFinite(gross) || gross <= 0 || !Number.isFinite(net) || net <= 0;
  if (!needsRescue || !isLikelyBrokenHebrew(fullText)) return result;

  const rescued = rescueFromLayoutText(fullText);
  if (!rescued) return result;

  if (!Number.isFinite(result.salary?.gross_total) || result.salary.gross_total <= 0) {
    result.salary = result.salary || {};
    result.salary.gross_total = rescued.gross_total;
  }
  if (!Number.isFinite(result.salary?.net_payable) || result.salary.net_payable <= 0) {
    result.salary = result.salary || {};
    result.salary.net_payable = rescued.net_payable;
  }

  result.deductions = result.deductions || {};
  result.deductions.mandatory = result.deductions.mandatory || {};
  const mandatory = result.deductions.mandatory;

  if (!Number.isFinite(mandatory.total) || mandatory.total <= 0) {
    mandatory.total = rescued.mandatory_total;
    mandatory.total_is_derived = true;
  }
  if (!Number.isFinite(mandatory.income_tax) && rescued.income_tax) {
    mandatory.income_tax = rescued.income_tax;
  }
  if (!Number.isFinite(mandatory.national_insurance) && rescued.national_insurance) {
    mandatory.national_insurance = rescued.national_insurance;
  }
  if (!Number.isFinite(mandatory.health_insurance) && rescued.health_insurance) {
    mandatory.health_insurance = rescued.health_insurance;
  }

  result.quality = result.quality || {};
  result.quality.numeric_rescue = {
    applied: true,
    confidence: rescued.confidence,
    method: rescued.method,
  };

  return result;
}

module.exports = {
  rescueFromLayoutText,
  applyNumericRescue,
};
