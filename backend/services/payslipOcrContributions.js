const {
  bestAmountByExpected,
  isCumulativeLine,
  isLikelyTaxBaseNoiseLine,
  normalizeHebrewLine,
  pickReasonableAmount,
} = require('./payslipOcrShared');
const {
  extractAllNumericTokens,
  extractPercentTokens,
} = require('./payslipOcrNumbers');
const { pushCandidate, resolveBestNumericCandidate } = require('./payslipOcrResolver');
const { buildContributionDetection } = require('../utils/detectFundWithoutDeposit');
const {
  IDF_CONTRIBUTION_COLUMNS,
  detectIdfPayslip,
  findIdfColumnForLine,
  pickIdfColumnAmount,
} = require('./idfPayslipProfile');

const STUDY_CONTEXT_REGEX = /קרן\s*השתלמות|קרן\s*ה+שתלמ/i;
const STUDY_BASE_REGEX = /שכר\s*לקרן\s*השתלמות|שכר\s*לקרן\s*ה+שתלמ/i;
const PENSION_CONTEXT_REGEX =
  /(תגמול|תגמולים|פיצוי|פיצויים|פנסי|ביטוח\s*מנהלים|קופ["״]?ג|גמל|קרן\s*פנסיה|קרן\s*ה+פנסיה|הפנסיה)/i;
const PENSION_BASE_REGEX = /שכר\s*לקצבה/i;
const SEVERANCE_ROLE_REGEX = /פיצוי|פיצויים/i;
const IDENTITY_NOISE_REGEX = /(?:שם\s+עובד|שם\s+מעסיק|ת\.?\s*ז\.?|מספר\s+זהות)/i;

function contributionLineText(raw) {
  return normalizeHebrewLine(raw);
}

function matchesContributionLabel(raw, pattern) {
  const normalized = contributionLineText(raw);
  return pattern.test(normalized) || pattern.test(String(raw || ''));
}

// Standard payslip labels (Michpal, Malam, etc.) — keep explicit variants.
const PENSION_EMPLOYEE_DEDUCTION_LABEL =
  /ניכוי\s+(?:ל\s*)?(?:קרן\s*)?פנסיה|ניכוי\s+עובד\s+(?:ל\s*)?(?:קרן\s*)?פנסיה|ניכוי\s+(?:ל\s*)?(?:קרן\s*)?גמל|ניכוי\s+(?:ל\s*)?קופ["״']?ג/i;
const STUDY_EMPLOYEE_DEDUCTION_LABEL =
  /ניכוי\s+(?:ל\s*)?(?:קרן\s*)?השתלמות|ניכוי\s+עובד\s+(?:ל\s*)?(?:קרן\s*)?השתלמות/i;
const PENSION_EMPLOYER_CONTRIBUTION_LABEL =
  /הפרש(?:ה|ת)\s+(?:מעסיק|מעביד)\s+(?:ל\s*)?(?:קרן\s*)?פנסיה|הפקד(?:ה|ת)\s+(?:מעסיק|מעביד)\s+(?:ל\s*)?(?:קרן\s*)?פנסיה/i;
const STUDY_EMPLOYER_CONTRIBUTION_LABEL =
  /הפרש(?:ה|ת)\s+(?:מעסיק|מעביד)\s+(?:ל\s*)?(?:קרן\s*)?השתלמות|הפקד(?:ה|ת)\s+(?:מעסיק|מעביד)\s+(?:ל\s*)?(?:קרן\s*)?השתלמות/i;

// IDF extensions — הפנסיה / ההשתלמו / השתתפות totals (underscores handled by normalizeHebrewLine).
const PENSION_EMPLOYEE_DEDUCTION_LABEL_IDF =
  /ניכוי\s+(?:ל\s*)?(?:קרן\s*)?ה+פנסיה/i;
const STUDY_EMPLOYEE_DEDUCTION_LABEL_IDF =
  /ניכוי\s+(?:ל\s*)?(?:קרן\s*)?ה+שתלמ/i;
const PENSION_PARTICIPATION_LABEL =
  /השתתפות\s+(?:ב\s*)?(?:קרן\s*)?ה*פנסיה/i;
const STUDY_PARTICIPATION_LABEL =
  /השתתפות\s+(?:ב\s*)?(?:קרן\s*)?ה*שתלמ/i;

function isPensionEmployeeDeductionLabel(raw) {
  return (
    matchesContributionLabel(raw, PENSION_EMPLOYEE_DEDUCTION_LABEL) ||
    matchesContributionLabel(raw, PENSION_EMPLOYEE_DEDUCTION_LABEL_IDF)
  );
}

function isStudyEmployeeDeductionLabel(raw) {
  return (
    matchesContributionLabel(raw, STUDY_EMPLOYEE_DEDUCTION_LABEL) ||
    matchesContributionLabel(raw, STUDY_EMPLOYEE_DEDUCTION_LABEL_IDF)
  );
}

function isPensionParticipationLabel(raw) {
  return matchesContributionLabel(raw, PENSION_PARTICIPATION_LABEL);
}

function isStudyParticipationLabel(raw) {
  return matchesContributionLabel(raw, STUDY_PARTICIPATION_LABEL);
}

function isPensionEmployerContributionLabel(raw) {
  return matchesContributionLabel(raw, PENSION_EMPLOYER_CONTRIBUTION_LABEL);
}

function isStudyEmployerContributionLabel(raw) {
  return matchesContributionLabel(raw, STUDY_EMPLOYER_CONTRIBUTION_LABEL);
}

function isExplicitContributionLabelLine(raw) {
  return (
    isPensionEmployeeDeductionLabel(raw) ||
    isStudyEmployeeDeductionLabel(raw) ||
    isPensionParticipationLabel(raw) ||
    isStudyParticipationLabel(raw) ||
    isPensionEmployerContributionLabel(raw) ||
    isStudyEmployerContributionLabel(raw)
  );
}

function isAmountOnlyContributionNeighbor(raw) {
  const text = contributionLineText(raw);
  if (!text || !/\d/.test(text)) {
    return false;
  }
  const withoutNumbers = text.replace(/[\d,.\s₪%-]/g, '').trim();
  return withoutNumbers.length <= 2;
}

const EMPLOYEE_ROLE_REGEX =
  /(עובד|תגמולי\s+עובד|ניכוי\s+עובד|ניכוי\s+(?:ל\s*)?(?:קרן\s*)?פנסיה|ניכוי\s+(?:ל\s*)?(?:קרן\s*)?השתלמות)/i;
const EMPLOYER_ROLE_REGEX =
  /(מעביד|מעסיק|תגמולי\s+מעביד|הפרשת\s+מעסיק|הפרשת\s+מעביד|הפרשה\s+מעסיק|הפרשה\s+מעביד|הפקדת\s+מעסיק|הפקדת\s+מעביד)/i;

function singleAmountMatchesRates(amount, base, rates, tolerance) {
  if (amount === undefined) {
    return false;
  }
  if (base === undefined || !rates.length) {
    return true;
  }

  return rates.some(rate => {
    const expectedAmount = +(base * (rate / 100)).toFixed(2);
    return Math.abs(amount - expectedAmount) <= tolerance;
  });
}

function normalizeContributionEntries(input) {
  const source = Array.isArray(input) ? input : input?.lines;
  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((entry, index) => {
      if (typeof entry === 'string') {
        return {
          raw: String(entry).trim(),
          index,
          sectionHints: [],
          primarySection: null,
        };
      }

      return {
        raw: String(entry?.raw || entry?.text || '').trim(),
        index: Number.isInteger(entry?.index) ? entry.index : index,
        sectionHints: Array.isArray(entry?.sectionHints) ? entry.sectionHints : [],
        primarySection: entry?.primarySection || null,
      };
    })
    .filter(entry => entry.raw);
}

function isContributionNoiseEntry(entry) {
  return (
    !entry ||
    !entry.raw ||
    isCumulativeLine(entry.raw) ||
    isLikelyTaxBaseNoiseLine(entry.raw) ||
    IDENTITY_NOISE_REGEX.test(entry.raw)
  );
}

function determineContributionKind(entry, activeKind) {
  if (!entry || isContributionNoiseEntry(entry)) {
    return activeKind;
  }

  if (STUDY_BASE_REGEX.test(contributionLineText(entry.raw)) || STUDY_CONTEXT_REGEX.test(contributionLineText(entry.raw))) {
    return 'study';
  }

  if (
    isStudyEmployeeDeductionLabel(entry.raw) ||
    isStudyEmployerContributionLabel(entry.raw) ||
    isStudyParticipationLabel(entry.raw)
  ) {
    return 'study';
  }

  if (PENSION_BASE_REGEX.test(contributionLineText(entry.raw)) || PENSION_CONTEXT_REGEX.test(contributionLineText(entry.raw))) {
    return 'pension';
  }

  if (
    isPensionEmployeeDeductionLabel(entry.raw) ||
    isPensionEmployerContributionLabel(entry.raw) ||
    isPensionParticipationLabel(entry.raw)
  ) {
    return 'pension';
  }

  if (
    (matchesContributionLabel(entry.raw, EMPLOYEE_ROLE_REGEX) ||
      matchesContributionLabel(entry.raw, EMPLOYER_ROLE_REGEX)) &&
    activeKind
  ) {
    return activeKind;
  }

  return activeKind;
}

function pickContributionDeductionAmount(raw, nums, { min = 50, max = 60000 } = {}) {
  const amounts = nums.filter(value => value >= min && value <= max);
  if (!amounts.length) {
    return undefined;
  }

  const rates = extractPercentTokens(raw);
  const nonRateAmounts = amounts.filter(
    value => !rates.some(rate => Math.abs(value - rate) < 0.5),
  );

  if (nonRateAmounts.length === 1) {
    return nonRateAmounts[0];
  }
  if (nonRateAmounts.length > 1) {
    return Math.max(...nonRateAmounts);
  }
  return amounts[amounts.length - 1];
}

function pickAmountForContributionEntry(entry, entries) {
  const ownAmount = pickContributionDeductionAmount(entry.raw, extractAllNumericTokens(entry.raw));
  if (ownAmount !== undefined) {
    return { amount: ownAmount, lineIndex: entry.index, adjacent: false };
  }

  for (let offset = 1; offset <= 3; offset += 1) {
    for (const sign of [1, -1]) {
      const neighbor = entries[entry.index + sign * offset];
      if (!neighbor || isContributionNoiseEntry(neighbor)) {
        continue;
      }
      if (isExplicitContributionLabelLine(neighbor.raw)) {
        continue;
      }

      const neighborTokens = extractAllNumericTokens(neighbor.raw);
      const minAmount = isAmountOnlyContributionNeighbor(neighbor.raw) ? 1 : 50;
      const neighborAmount = pickContributionDeductionAmount(neighbor.raw, neighborTokens, {
        min: minAmount,
      });
      if (neighborAmount !== undefined) {
        return {
          amount: neighborAmount,
          lineIndex: neighbor.index,
          adjacent: true,
        };
      }
    }
  }

  return null;
}

function extractExplicitContributionDeductions(entries, store) {
  entries.forEach(entry => {
    if (isContributionNoiseEntry(entry)) {
      return;
    }

    if (!isExplicitContributionLabelLine(entry.raw)) {
      return;
    }

    const resolvedAmount = pickAmountForContributionEntry(entry, entries);
    if (!resolvedAmount) {
      return;
    }

    const { amount, lineIndex, adjacent } = resolvedAmount;
    const pushExplicit = (field, reason) => {
      pushCandidate(store, field, amount, {
        source: adjacent ? 'contribution_explicit_deduction_adjacent' : 'contribution_explicit_deduction',
        lineIndex,
        score: adjacent ? 0.9 : 0.93,
        reason: adjacent ? `${reason} Amount taken from an adjacent line.` : reason,
        section: 'contributions',
        evidenceCategory: adjacent ? 'adjacent_line' : 'explicit_deduction_label',
      });
    };

    if (isPensionEmployeeDeductionLabel(entry.raw)) {
      pushExplicit('pension_employee', 'Matched explicit pension employee deduction label.');
    }
    if (isStudyEmployeeDeductionLabel(entry.raw)) {
      pushExplicit('study_employee', 'Matched explicit study-fund employee deduction label.');
    }
    if (isPensionParticipationLabel(entry.raw)) {
      pushExplicit('pension_participation_total', 'Matched total pension fund participation for the month.');
    }
    if (isStudyParticipationLabel(entry.raw)) {
      pushExplicit('study_participation_total', 'Matched total study-fund participation for the month.');
    }
    if (isPensionEmployerContributionLabel(entry.raw)) {
      pushExplicit('pension_employer', 'Matched explicit pension employer contribution label.');
    }
    if (isStudyEmployerContributionLabel(entry.raw)) {
      pushExplicit('study_employer', 'Matched explicit study-fund employer contribution label.');
    }
  });
}

function extractIdfContributionColumns(entries, store) {
  entries.forEach(entry => {
    if (isContributionNoiseEntry(entry)) {
      return;
    }

    const column = findIdfColumnForLine(entry.raw);
    if (!column) {
      return;
    }

    const resolvedAmount = pickIdfColumnAmount(entry, entries, column);
    if (!resolvedAmount) {
      return;
    }

    const { amount, lineIndex, adjacent } = resolvedAmount;
    pushCandidate(store, column.field, amount, {
      source: adjacent ? 'idf_column_profile_adjacent' : 'idf_column_profile',
      lineIndex,
      score: adjacent ? 0.98 : 0.99,
      reason: `תלוש צה"ל — ${column.descriptionHe}`,
      section: 'contributions',
      evidenceCategory: 'idf_column',
    });
  });
}

function idfFundColumnDetected(store, fund) {
  return IDF_CONTRIBUTION_COLUMNS.some(
    column => column.fund === fund && Array.isArray(store[column.field]) && store[column.field].length > 0,
  );
}

function collectContributionLines(entries) {
  const studyLines = [];
  const pensionLines = [];
  let activeKind = null;

  entries.forEach(entry => {
    if (isContributionNoiseEntry(entry)) {
      return;
    }

    activeKind = determineContributionKind(entry, activeKind);

    if (activeKind === 'study') {
      const studyLine = contributionLineText(entry.raw);
      if (
        STUDY_CONTEXT_REGEX.test(studyLine) ||
        STUDY_BASE_REGEX.test(studyLine) ||
        isStudyEmployeeDeductionLabel(entry.raw) ||
        isStudyEmployerContributionLabel(entry.raw) ||
        isStudyParticipationLabel(entry.raw) ||
        matchesContributionLabel(entry.raw, EMPLOYEE_ROLE_REGEX) ||
        matchesContributionLabel(entry.raw, EMPLOYER_ROLE_REGEX)
      ) {
        studyLines.push(entry);
      }
      return;
    }

    if (activeKind === 'pension') {
      const pensionLine = contributionLineText(entry.raw);
      if (
        PENSION_CONTEXT_REGEX.test(pensionLine) ||
        PENSION_BASE_REGEX.test(pensionLine) ||
        isPensionEmployeeDeductionLabel(entry.raw) ||
        isPensionEmployerContributionLabel(entry.raw) ||
        isPensionParticipationLabel(entry.raw) ||
        matchesContributionLabel(entry.raw, EMPLOYEE_ROLE_REGEX) ||
        matchesContributionLabel(entry.raw, EMPLOYER_ROLE_REGEX) ||
        SEVERANCE_ROLE_REGEX.test(entry.raw)
      ) {
        pensionLines.push(entry);
      }
    }
  });

  return { studyLines, pensionLines };
}

function getAdjacentSupportEntry(entries, index) {
  for (let offset = 1; offset <= 2; offset += 1) {
    const neighbor = entries[index + offset];
    if (!neighbor) {
      break;
    }

    if (isContributionNoiseEntry(neighbor)) {
      continue;
    }

    if (
      neighbor.sectionHints.includes('identity') ||
      neighbor.sectionHints.includes('summary') ||
      neighbor.sectionHints.includes('tax_base')
    ) {
      break;
    }

    if (STUDY_BASE_REGEX.test(neighbor.raw) || PENSION_BASE_REGEX.test(neighbor.raw)) {
      break;
    }

    const hasAmounts = extractAllNumericTokens(neighbor.raw).length > 0;
    const hasRates = extractPercentTokens(neighbor.raw).length > 0;
    if (hasAmounts || hasRates) {
      return neighbor;
    }

    if (STUDY_CONTEXT_REGEX.test(neighbor.raw) || PENSION_CONTEXT_REGEX.test(neighbor.raw)) {
      break;
    }
  }

  return null;
}

function extractContributionLineStats(entry, entries, { maxAmount, tolerance }) {
  const ownNums = extractAllNumericTokens(entry.raw);
  const ownRates = extractPercentTokens(entry.raw);
  const ownBase = pickReasonableAmount(ownNums, { min: 5000, max: 200000 });
  const ownAmounts = ownNums.filter(
    value => value >= 50 && value <= maxAmount && !(ownBase && Math.abs(value - ownBase) < 5),
  );
  const shouldUseAdjacentSupport = ownAmounts.length === 0 && ownRates.length === 0;
  const supportEntry = shouldUseAdjacentSupport ? getAdjacentSupportEntry(entries, entry.index) : null;
  const combinedRaw = supportEntry ? `${entry.raw} ${supportEntry.raw}` : entry.raw;
  const nums = supportEntry ? extractAllNumericTokens(combinedRaw) : ownNums;
  const rates = supportEntry ? extractPercentTokens(combinedRaw) : ownRates;
  const lineBase = ownBase ?? (supportEntry
    ? pickReasonableAmount(nums, { min: 5000, max: 200000 })
    : undefined);
  const amounts = nums.filter(
    value => value >= 50 && value <= maxAmount && !(lineBase && Math.abs(value - lineBase) < 5),
  );

  return {
    combinedRaw,
    supportEntry,
    lineBase,
    rates,
    amounts,
    hasAdjacentSupport: Boolean(supportEntry),
    tolerance,
  };
}

function pushContributionAmountCandidate(store, field, amount, entry, stats, {
  source,
  score,
  reason,
}) {
  pushCandidate(store, field, amount, {
    source,
    lineIndex: entry.index,
    score: stats.hasAdjacentSupport ? Math.max(0.52, score - 0.06) : score,
    reason,
    section: 'contributions',
    evidenceCategory: stats.hasAdjacentSupport ? 'adjacent_line' : undefined,
  });
}

function rememberRateHint(rateHints, key, rate) {
  if (!rateHints || rate == null || !Number.isFinite(rate)) {
    return;
  }
  if (rateHints[key] == null) {
    rateHints[key] = rate;
  }
}

function parseTableContributionRates(raw, { base, employee, employer, severance }, tolerance = 25) {
  if (!raw) {
    return {};
  }

  const nums = extractAllNumericTokens(raw);
  const rates = extractPercentTokens(raw);
  const lineBase = base ?? pickReasonableAmount(nums, { min: 5000, max: 200000 });
  const amounts = nums.filter(
    value => value >= 50 && value <= 60000 && !(lineBase && Math.abs(value - lineBase) < 5),
  );

  const result = {};

  const assignRateForAmount = (targetAmount, roleKey) => {
    if (targetAmount == null || !Number.isFinite(targetAmount)) {
      return;
    }

    amounts.forEach((amount, index) => {
      if (Math.abs(amount - targetAmount) > tolerance) {
        return;
      }
      if (rates[index] != null) {
        result[roleKey] = rates[index];
        return;
      }
      rates.forEach(rate => {
        if (lineBase && Math.abs((lineBase * rate) / 100 - targetAmount) <= tolerance) {
          result[roleKey] = rate;
        }
      });
    });
  };

  assignRateForAmount(employee, 'employeeRate');
  assignRateForAmount(employer, 'employerRate');
  assignRateForAmount(severance, 'severanceRate');

  if (
    result.employeeRate == null &&
    result.employerRate == null &&
    rates.length >= 2 &&
    amounts.length >= 2 &&
    employee != null &&
    employer != null
  ) {
    if (Math.abs(amounts[0] - employee) <= tolerance) {
      result.employeeRate = rates[0];
    }
    if (Math.abs(amounts[1] - employer) <= tolerance) {
      result.employerRate = rates[1];
    }
  }

  if (
    result.severanceRate == null &&
    severance != null &&
    rates.length >= 3 &&
    amounts.length >= 3
  ) {
    const severanceIndex = amounts.findIndex(amount => Math.abs(amount - severance) <= tolerance);
    if (severanceIndex >= 0 && rates[severanceIndex] != null) {
      result.severanceRate = rates[severanceIndex];
    }
  }

  return result;
}

function resolveStatedRates({ base, employee, employer, severance }, stats, rateHints, fundPrefix) {
  const fromHints = {
    employeeRate: rateHints[`${fundPrefix}_employee`],
    employerRate: rateHints[`${fundPrefix}_employer`],
    severanceRate: rateHints[`${fundPrefix}_severance`],
  };

  const lines =
    fundPrefix === 'study'
      ? [stats.studyDebugLine].filter(Boolean)
      : (stats.pensionDebugLines || []).filter(Boolean);

  const fromTable = {};
  lines.forEach(line => {
    const parsed = parseTableContributionRates(
      line,
      { base, employee, employer, severance },
      fundPrefix === 'study' ? 20 : 25,
    );
    Object.entries(parsed).forEach(([key, value]) => {
      if (fromTable[key] == null && value != null) {
        fromTable[key] = value;
      }
    });
  });

  return {
    employeeRate: fromHints.employeeRate ?? fromTable.employeeRate ?? undefined,
    employerRate: fromHints.employerRate ?? fromTable.employerRate ?? undefined,
    severanceRate: fromHints.severanceRate ?? fromTable.severanceRate ?? undefined,
  };
}

function collectContributionCandidates(input) {
  const store = {};
  const rateHints = {};
  const entries = normalizeContributionEntries(input);
  const fullText =
    (typeof input === 'object' && input?.fullText) ||
    entries.map(entry => entry.raw).join('\n');
  const idfPayslip = detectIdfPayslip(entries, fullText);

  if (idfPayslip) {
    extractIdfContributionColumns(entries, store);
  } else {
    extractExplicitContributionDeductions(entries, store);
  }

  const { studyLines, pensionLines } = idfPayslip
    ? { studyLines: [], pensionLines: [] }
    : collectContributionLines(entries);

  const studyBaseLine = entries.find(entry => STUDY_BASE_REGEX.test(entry.raw) && !isContributionNoiseEntry(entry));
  const pensionBaseLine = entries.find(entry => PENSION_BASE_REGEX.test(entry.raw) && !isContributionNoiseEntry(entry));

  const studyBase = studyBaseLine
    ? pickReasonableAmount(extractAllNumericTokens(studyBaseLine.raw), { min: 5000, max: 200000 })
    : undefined;
  const pensionBase = pensionBaseLine
    ? pickReasonableAmount(extractAllNumericTokens(pensionBaseLine.raw), { min: 5000, max: 200000 })
    : undefined;

  if (studyBase !== undefined) {
    pushCandidate(store, 'study_base', studyBase, {
      source: 'contribution_base_line',
      score: 0.9,
      reason: 'Matched study-fund base salary from an explicit base line.',
      section: 'contributions',
      evidenceCategory: 'base_line',
    });
  }

  if (pensionBase !== undefined) {
    pushCandidate(store, 'pension_base', pensionBase, {
      source: 'contribution_base_line',
      score: 0.9,
      reason: 'Matched pension base salary from an explicit base line.',
      section: 'contributions',
      evidenceCategory: 'base_line',
    });
  }

  for (const entry of studyLines) {
    const stats = extractContributionLineStats(entry, entries, {
      maxAmount: 30000,
      tolerance: 20,
    });
    const effectiveBase = studyBase ?? stats.lineBase;
    const isEmployeeLine = matchesContributionLabel(entry.raw, EMPLOYEE_ROLE_REGEX);
    const isEmployerLine = matchesContributionLabel(entry.raw, EMPLOYER_ROLE_REGEX);

    if (stats.lineBase !== undefined) {
      pushCandidate(store, 'study_base', stats.lineBase, {
        source: stats.hasAdjacentSupport ? 'contribution_adjacent_base' : 'contribution_inline_base',
        lineIndex: entry.index,
        score: stats.hasAdjacentSupport ? 0.66 : 0.72,
        reason: 'Matched study-fund base salary from the contribution block.',
        section: 'contributions',
        evidenceCategory: stats.hasAdjacentSupport ? 'adjacent_line' : 'inline_base',
      });
    }

    if (isEmployeeLine === isEmployerLine) {
      continue;
    }

    if (effectiveBase !== undefined && stats.rates.length) {
      for (const rate of stats.rates) {
        const expectedAmount = +(effectiveBase * (rate / 100)).toFixed(2);
        const matchedAmount = bestAmountByExpected(stats.amounts, expectedAmount, stats.tolerance);
        if (matchedAmount === undefined) {
          continue;
        }

        if (isEmployeeLine) {
          rememberRateHint(rateHints, 'study_employee', rate);
          pushContributionAmountCandidate(store, 'study_employee', matchedAmount, entry, stats, {
            source: stats.hasAdjacentSupport ? 'contribution_adjacent_rate_match' : 'contribution_rate_match',
            score: 0.88,
            reason: 'Matched study-fund employee amount from role + base + rate.',
          });
        }

        if (isEmployerLine) {
          rememberRateHint(rateHints, 'study_employer', rate);
          pushContributionAmountCandidate(store, 'study_employer', matchedAmount, entry, stats, {
            source: stats.hasAdjacentSupport ? 'contribution_adjacent_rate_match' : 'contribution_rate_match',
            score: 0.88,
            reason: 'Matched study-fund employer amount from role + base + rate.',
          });
        }
      }
    }

    if (stats.amounts.length === 1 && singleAmountMatchesRates(stats.amounts[0], effectiveBase, stats.rates, stats.tolerance)) {
      if (isEmployeeLine) {
        pushContributionAmountCandidate(store, 'study_employee', stats.amounts[0], entry, stats, {
          source: stats.hasAdjacentSupport ? 'contribution_adjacent_single_amount' : 'contribution_single_amount',
          score: 0.68,
          reason: 'Matched study-fund employee amount from a role-tagged amount line.',
        });
      }

      if (isEmployerLine) {
        pushContributionAmountCandidate(store, 'study_employer', stats.amounts[0], entry, stats, {
          source: stats.hasAdjacentSupport ? 'contribution_adjacent_single_amount' : 'contribution_single_amount',
          score: 0.68,
          reason: 'Matched study-fund employer amount from a role-tagged amount line.',
        });
      }
    }
  }

  for (const entry of pensionLines) {
    const stats = extractContributionLineStats(entry, entries, {
      maxAmount: 60000,
      tolerance: 25,
    });
    const effectiveBase = stats.lineBase ?? pensionBase;
    const isEmployeeLine = matchesContributionLabel(entry.raw, EMPLOYEE_ROLE_REGEX);
    const isEmployerLine = matchesContributionLabel(entry.raw, EMPLOYER_ROLE_REGEX);
    const isSeveranceLine = SEVERANCE_ROLE_REGEX.test(entry.raw);
    const roleCount = [isEmployeeLine, isEmployerLine, isSeveranceLine].filter(Boolean).length;

    if (stats.lineBase !== undefined) {
      pushCandidate(store, 'pension_base', stats.lineBase, {
        source: stats.hasAdjacentSupport ? 'contribution_adjacent_base' : 'contribution_inline_base',
        lineIndex: entry.index,
        score: stats.hasAdjacentSupport ? 0.66 : 0.72,
        reason: 'Matched pension base salary from the contribution block.',
        section: 'contributions',
        evidenceCategory: stats.hasAdjacentSupport ? 'adjacent_line' : 'inline_base',
      });
    }

    if (roleCount !== 1) {
      continue;
    }

    if (effectiveBase !== undefined && stats.rates.length) {
      for (const rate of stats.rates) {
        const expectedAmount = +(effectiveBase * (rate / 100)).toFixed(2);
        const amount = bestAmountByExpected(stats.amounts, expectedAmount, stats.tolerance);
        if (amount === undefined) continue;

        if (isSeveranceLine) {
          rememberRateHint(rateHints, 'pension_severance', rate);
          pushContributionAmountCandidate(store, 'pension_severance', amount, entry, stats, {
            source: stats.hasAdjacentSupport ? 'contribution_adjacent_rate_match' : 'contribution_rate_match',
            score: 0.88,
            reason: 'Matched severance amount from role + base + rate.',
          });
        } else if (isEmployeeLine) {
          rememberRateHint(rateHints, 'pension_employee', rate);
          pushContributionAmountCandidate(store, 'pension_employee', amount, entry, stats, {
            source: stats.hasAdjacentSupport ? 'contribution_adjacent_rate_match' : 'contribution_rate_match',
            score: 0.88,
            reason: 'Matched pension employee amount from role + base + rate.',
          });
        } else if (isEmployerLine) {
          rememberRateHint(rateHints, 'pension_employer', rate);
          pushContributionAmountCandidate(store, 'pension_employer', amount, entry, stats, {
            source: stats.hasAdjacentSupport ? 'contribution_adjacent_rate_match' : 'contribution_rate_match',
            score: 0.88,
            reason: 'Matched pension employer amount from role + base + rate.',
          });
        }
      }
    }

    if (stats.amounts.length === 1 && singleAmountMatchesRates(stats.amounts[0], effectiveBase, stats.rates, stats.tolerance)) {
      if (isEmployeeLine) {
        pushContributionAmountCandidate(store, 'pension_employee', stats.amounts[0], entry, stats, {
          source: stats.hasAdjacentSupport ? 'contribution_adjacent_single_amount' : 'contribution_single_amount',
          score: 0.68,
          reason: 'Matched pension employee amount from a role-tagged amount line.',
        });
      }

      if (isEmployerLine) {
        pushContributionAmountCandidate(store, 'pension_employer', stats.amounts[0], entry, stats, {
          source: stats.hasAdjacentSupport ? 'contribution_adjacent_single_amount' : 'contribution_single_amount',
          score: 0.68,
          reason: 'Matched pension employer amount from a role-tagged amount line.',
        });
      }

      if (isSeveranceLine) {
        pushContributionAmountCandidate(store, 'pension_severance', stats.amounts[0], entry, stats, {
          source: stats.hasAdjacentSupport ? 'contribution_adjacent_single_amount' : 'contribution_single_amount',
          score: 0.68,
          reason: 'Matched severance amount from a role-tagged amount line.',
        });
      }
    }
  }

  return {
    store,
    stats: {
      idfProfileDetected: idfPayslip,
      studyLinesFound: idfPayslip ? idfFundColumnDetected(store, 'study') : studyLines.length > 0,
      pensionLinesFound: idfPayslip ? idfFundColumnDetected(store, 'pension') : pensionLines.length > 0,
      studyDebugLine: studyLines[0]?.raw,
      pensionDebugLines: pensionLines.slice(0, 8).map(entry => entry.raw),
      rateHints,
    },
  };
}

function deriveEmployerFromParticipation(employee, employer, participation, field, { idfProfile = false } = {}) {
  if (participation?.value == null || employee?.value == null) {
    return employer;
  }

  const derived = +(participation.value - employee.value).toFixed(2);
  if (!Number.isFinite(derived) || derived < 0) {
    return employer;
  }

  const limits = { pension_employer: 60000, study_employer: 30000 };
  const max = limits[field] ?? 60000;
  if (derived > max) {
    return employer;
  }

  if (idfProfile) {
    return {
      value: derived,
      score: 0.99,
      source: 'idf_participation_derived',
      reason: 'IDF payslip: employer share = השתתפות total minus employee ניכוי.',
      section: 'contributions',
      evidenceCategory: 'idf_participation_derived',
    };
  }

  if (employer?.value != null) {
    return employer;
  }

  return {
    value: derived,
    score: 0.86,
    source: 'contribution_participation_derived',
    reason: 'Derived employer contribution from total participation minus employee deduction.',
    section: 'contributions',
    evidenceCategory: 'participation_derived',
  };
}

function resolveContributionCandidates(store, stats, warnings) {
  const studyBase = resolveBestNumericCandidate('study_base', store.study_base, { minScore: 0.45 });
  const studyEmployee = resolveBestNumericCandidate('study_employee', store.study_employee, { minScore: 0.5 });
  const studyParticipation = resolveBestNumericCandidate(
    'study_participation_total',
    store.study_participation_total,
    { minScore: 0.5 },
  );
  let studyEmployer = resolveBestNumericCandidate('study_employer', store.study_employer, { minScore: 0.5 });
  studyEmployer = deriveEmployerFromParticipation(
    studyEmployee,
    studyEmployer,
    studyParticipation,
    'study_employer',
    { idfProfile: stats.idfProfileDetected },
  );

  const pensionBase = resolveBestNumericCandidate('pension_base', store.pension_base, { minScore: 0.45 });
  const pensionEmployee = resolveBestNumericCandidate('pension_employee', store.pension_employee, { minScore: 0.5 });
  const pensionParticipation = resolveBestNumericCandidate(
    'pension_participation_total',
    store.pension_participation_total,
    { minScore: 0.5 },
  );
  let pensionEmployer = resolveBestNumericCandidate('pension_employer', store.pension_employer, { minScore: 0.5 });
  pensionEmployer = deriveEmployerFromParticipation(
    pensionEmployee,
    pensionEmployer,
    pensionParticipation,
    'pension_employer',
    { idfProfile: stats.idfProfileDetected },
  );
  const pensionSeverance = resolveBestNumericCandidate('pension_severance', store.pension_severance, { minScore: 0.5 });

  if (!stats.studyLinesFound) {
    warnings.push('Study fund line not found (קרן השתלמות).');
  } else if (!studyEmployee || !studyEmployer) {
    warnings.push('Study fund amounts found but employee/employer roles were ambiguous.');
  }

  if (!stats.pensionLinesFound) {
    warnings.push('Pension lines not found (פנסיה/תגמולים/פיצויים).');
  } else if (!pensionEmployee || !pensionEmployer) {
    warnings.push('Pension contribution lines found but employee/employer roles were ambiguous.');
  }

  const studyRates = resolveStatedRates(
    {
      base: studyBase?.value,
      employee: studyEmployee?.value,
      employer: studyEmployer?.value,
    },
    stats,
    stats.rateHints || {},
    'study',
  );

  const pensionRates = resolveStatedRates(
    {
      base: pensionBase?.value,
      employee: pensionEmployee?.value,
      employer: pensionEmployer?.value,
      severance: pensionSeverance?.value,
    },
    stats,
    stats.rateHints || {},
    'pension',
  );

  return {
    study: {
      base: studyBase?.value,
      employee: studyEmployee?.value,
      employer: studyEmployer?.value,
      participation_total: studyParticipation?.value,
      employeeRate: studyRates.employeeRate,
      employerRate: studyRates.employerRate,
      debug_line: stats.studyDebugLine,
      detection: buildContributionDetection({
        sectionDetected: stats.studyLinesFound,
        employee: studyEmployee?.value,
        employer: studyEmployer?.value,
      }),
      quality: {
        base: studyBase || null,
        employee: studyEmployee || null,
        employer: studyEmployer || null,
      },
    },
    pension: {
      base: pensionBase?.value,
      employee: pensionEmployee?.value,
      employer: pensionEmployer?.value,
      participation_total: pensionParticipation?.value,
      severance: pensionSeverance?.value,
      base_for_severance: pensionBase?.value,
      employeeRate: pensionRates.employeeRate,
      employerRate: pensionRates.employerRate,
      severanceRate: pensionRates.severanceRate,
      debug_lines: stats.pensionDebugLines,
      detection: buildContributionDetection({
        sectionDetected: stats.pensionLinesFound,
        employee: pensionEmployee?.value,
        employer: pensionEmployer?.value,
        severance: pensionSeverance?.value,
      }),
      quality: {
        base: pensionBase || null,
        employee: pensionEmployee || null,
        employer: pensionEmployer || null,
        severance: pensionSeverance || null,
      },
    },
  };
}

function extractStudyFund(lines, warnings) {
  const collected = collectContributionCandidates(lines);
  return resolveContributionCandidates(collected.store, collected.stats, warnings).study;
}

function extractPension(lines, warnings) {
  const collected = collectContributionCandidates(lines);
  return resolveContributionCandidates(collected.store, collected.stats, warnings).pension;
}

module.exports = {
  collectContributionCandidates,
  extractPension,
  extractStudyFund,
  parseTableContributionRates,
  resolveContributionCandidates,
};
