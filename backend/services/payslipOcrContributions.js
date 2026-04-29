const {
  bestAmountByExpected,
  isCumulativeLine,
  isLikelyTaxBaseNoiseLine,
  pickReasonableAmount,
} = require('./payslipOcrShared');
const {
  extractAllNumericTokens,
  extractPercentTokens,
} = require('./payslipOcrNumbers');
const { pushCandidate, resolveBestNumericCandidate } = require('./payslipOcrResolver');

const STUDY_CONTEXT_REGEX = /קרן\s*השתלמות/i;
const STUDY_BASE_REGEX = /שכר\s*לקרן\s*השתלמות/i;
const PENSION_CONTEXT_REGEX =
  /(תגמול|תגמולים|פיצוי|פיצויים|פנסי|ביטוח\s*מנהלים|קופ["״]?ג|גמל)/i;
const PENSION_BASE_REGEX = /שכר\s*לקצבה/i;
const EMPLOYEE_ROLE_REGEX = /(עובד|תגמולי\s*עובד|ניכוי\s*עובד)/i;
const EMPLOYER_ROLE_REGEX = /(מעביד|מעסיק|תגמולי\s*מעביד|הפרשת\s*מעסיק)/i;
const SEVERANCE_ROLE_REGEX = /פיצוי|פיצויים/i;
const IDENTITY_NOISE_REGEX = /(?:שם\s+עובד|שם\s+מעסיק|ת\.?\s*ז\.?|מספר\s+זהות)/i;

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

  if (STUDY_BASE_REGEX.test(entry.raw) || STUDY_CONTEXT_REGEX.test(entry.raw)) {
    return 'study';
  }

  if (PENSION_BASE_REGEX.test(entry.raw) || PENSION_CONTEXT_REGEX.test(entry.raw)) {
    return 'pension';
  }

  if ((EMPLOYEE_ROLE_REGEX.test(entry.raw) || EMPLOYER_ROLE_REGEX.test(entry.raw)) && activeKind) {
    return activeKind;
  }

  return activeKind;
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
      if (
        STUDY_CONTEXT_REGEX.test(entry.raw) ||
        STUDY_BASE_REGEX.test(entry.raw) ||
        EMPLOYEE_ROLE_REGEX.test(entry.raw) ||
        EMPLOYER_ROLE_REGEX.test(entry.raw)
      ) {
        studyLines.push(entry);
      }
      return;
    }

    if (activeKind === 'pension') {
      if (
        PENSION_CONTEXT_REGEX.test(entry.raw) ||
        PENSION_BASE_REGEX.test(entry.raw) ||
        EMPLOYEE_ROLE_REGEX.test(entry.raw) ||
        EMPLOYER_ROLE_REGEX.test(entry.raw) ||
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

function collectContributionCandidates(input) {
  const store = {};
  const entries = normalizeContributionEntries(input);
  const { studyLines, pensionLines } = collectContributionLines(entries);

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
    const isEmployeeLine = EMPLOYEE_ROLE_REGEX.test(entry.raw);
    const isEmployerLine = EMPLOYER_ROLE_REGEX.test(entry.raw);

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
          pushContributionAmountCandidate(store, 'study_employee', matchedAmount, entry, stats, {
            source: stats.hasAdjacentSupport ? 'contribution_adjacent_rate_match' : 'contribution_rate_match',
            score: 0.88,
            reason: 'Matched study-fund employee amount from role + base + rate.',
          });
        }

        if (isEmployerLine) {
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
    const isEmployeeLine = EMPLOYEE_ROLE_REGEX.test(entry.raw);
    const isEmployerLine = EMPLOYER_ROLE_REGEX.test(entry.raw);
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
          pushContributionAmountCandidate(store, 'pension_severance', amount, entry, stats, {
            source: stats.hasAdjacentSupport ? 'contribution_adjacent_rate_match' : 'contribution_rate_match',
            score: 0.88,
            reason: 'Matched severance amount from role + base + rate.',
          });
        } else if (isEmployeeLine) {
          pushContributionAmountCandidate(store, 'pension_employee', amount, entry, stats, {
            source: stats.hasAdjacentSupport ? 'contribution_adjacent_rate_match' : 'contribution_rate_match',
            score: 0.88,
            reason: 'Matched pension employee amount from role + base + rate.',
          });
        } else if (isEmployerLine) {
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
      studyLinesFound: studyLines.length,
      pensionLinesFound: pensionLines.length,
      studyDebugLine: studyLines[0]?.raw,
      pensionDebugLines: pensionLines.slice(0, 8).map(entry => entry.raw),
    },
  };
}

function resolveContributionCandidates(store, stats, warnings) {
  const studyBase = resolveBestNumericCandidate('study_base', store.study_base, { minScore: 0.45 });
  const studyEmployee = resolveBestNumericCandidate('study_employee', store.study_employee, { minScore: 0.5 });
  const studyEmployer = resolveBestNumericCandidate('study_employer', store.study_employer, { minScore: 0.5 });

  const pensionBase = resolveBestNumericCandidate('pension_base', store.pension_base, { minScore: 0.45 });
  const pensionEmployee = resolveBestNumericCandidate('pension_employee', store.pension_employee, { minScore: 0.5 });
  const pensionEmployer = resolveBestNumericCandidate('pension_employer', store.pension_employer, { minScore: 0.5 });
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

  return {
    study: {
      base: studyBase?.value,
      employee: studyEmployee?.value,
      employer: studyEmployer?.value,
      employeeRate: undefined,
      employerRate: undefined,
      debug_line: stats.studyDebugLine,
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
      severance: pensionSeverance?.value,
      base_for_severance: pensionBase?.value,
      debug_lines: stats.pensionDebugLines,
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
  resolveContributionCandidates,
};
