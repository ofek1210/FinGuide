const {
  bestAmountByExpected,
  isLikelyTaxBaseNoiseLine,
  pickReasonableAmount,
} = require('./payslipOcrShared');
const {
  extractAllNumericTokens,
  extractPercentTokens,
} = require('./payslipOcrNumbers');
const { pushCandidate, resolveBestNumericCandidate } = require('./payslipOcrResolver');

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

function collectContributionCandidates(lines) {
  const store = {};
  const studyLines = [];
  const pensionLines = [];

  lines.forEach((line, index) => {
    if (/קרן\s*השתלמות/i.test(line) && !/נתוניס\s*מצטברים|מצטבר/i.test(line)) {
      studyLines.push({ line, index });
    }
    if (
      (
        /(תגמול|תגמולים|פיצוי|פיצויים|פנסי|ביטוח\s*מנהלים|קופ["״]?ג|גמל)/i.test(line) ||
        /(ניכוי\s*עובד|הפרשת\s*מעסיק)/i.test(line)
      ) &&
      !/נתוניס\s*מצטברים|מצטבר/i.test(line) &&
      !isLikelyTaxBaseNoiseLine(line)
    ) {
      pensionLines.push({ line, index });
    }
  });

  const studyBaseLine = lines.find(line => /שכר\s*לקרן\s*השתלמות/i.test(line));
  const pensionBaseLine = lines.find(line => /שכר\s*לקצבה/i.test(line));

  const studyBase = studyBaseLine
    ? pickReasonableAmount(extractAllNumericTokens(studyBaseLine), { min: 5000, max: 200000 })
    : undefined;
  const pensionBase = pensionBaseLine
    ? pickReasonableAmount(extractAllNumericTokens(pensionBaseLine), { min: 5000, max: 200000 })
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

  for (const { line, index } of studyLines) {
    const nums = extractAllNumericTokens(line);
    const lineBase = pickReasonableAmount(nums, { min: 5000, max: 200000 });
    const effectiveBase = studyBase ?? lineBase;
    const rates = extractPercentTokens(line).slice(0, 4);
    const moneyAmounts = nums.filter(
      value => value >= 50 && value <= 30000 && !(effectiveBase && Math.abs(value - effectiveBase) < 5),
    );
    const isEmployeeLine = /(עובד|ניכוי\s*עובד|תגמולי\s*עובד)/i.test(line);
    const isEmployerLine = /(מעביד|מעסיק|הפרשת\s*מעסיק|תגמולי\s*מעביד)/i.test(line);

    if (lineBase !== undefined) {
      pushCandidate(store, 'study_base', lineBase, {
        source: 'contribution_inline_base',
        lineIndex: index,
        score: 0.72,
        reason: 'Matched study-fund base salary from the contribution line.',
        section: 'contributions',
        evidenceCategory: 'inline_base',
      });
    }

    if (!isEmployeeLine && !isEmployerLine) {
      continue;
    }

    if (effectiveBase !== undefined && rates.length) {
      for (const rate of rates) {
        const expectedAmount = +(effectiveBase * (rate / 100)).toFixed(2);
        const matchedAmount = bestAmountByExpected(moneyAmounts, expectedAmount, 20);
        if (matchedAmount === undefined) {
          continue;
        }

        if (isEmployeeLine) {
          pushCandidate(store, 'study_employee', matchedAmount, {
            source: 'contribution_rate_match',
            lineIndex: index,
            score: 0.88,
            reason: 'Matched study-fund employee amount from role + base + rate.',
            section: 'contributions',
            evidenceCategory: 'base_rate_match',
          });
        }

        if (isEmployerLine) {
          pushCandidate(store, 'study_employer', matchedAmount, {
            source: 'contribution_rate_match',
            lineIndex: index,
            score: 0.88,
            reason: 'Matched study-fund employer amount from role + base + rate.',
            section: 'contributions',
            evidenceCategory: 'base_rate_match',
          });
        }
      }
    }

    if (moneyAmounts.length === 1 && singleAmountMatchesRates(moneyAmounts[0], effectiveBase, rates, 20)) {
      if (isEmployeeLine) {
        pushCandidate(store, 'study_employee', moneyAmounts[0], {
          source: 'contribution_single_amount',
          lineIndex: index,
          score: 0.68,
          reason: 'Matched study-fund employee amount from a role-tagged single amount line.',
          section: 'contributions',
          evidenceCategory: 'role_single_amount',
        });
      }

      if (isEmployerLine) {
        pushCandidate(store, 'study_employer', moneyAmounts[0], {
          source: 'contribution_single_amount',
          lineIndex: index,
          score: 0.68,
          reason: 'Matched study-fund employer amount from a role-tagged single amount line.',
          section: 'contributions',
          evidenceCategory: 'role_single_amount',
        });
      }
    }
  }

  for (const { line, index } of pensionLines) {
    const nums = extractAllNumericTokens(line);
    if (!nums.length) continue;

    const lineBase = pickReasonableAmount(nums, { min: 5000, max: 200000 });
    const effectiveBase = lineBase ?? pensionBase;
    const rates = extractPercentTokens(line);
    const amounts = nums.filter(
      value => value >= 50 && value <= 60000 && !(effectiveBase && Math.abs(value - effectiveBase) < 5),
    );
    const isEmployeeLine = /(עובד|תגמולי\s*עובד|ניכוי\s*עובד)/i.test(line);
    const isEmployerLine = /(מעביד|מעסיק|תגמולי\s*מעביד|הפרשת\s*מעסיק)/i.test(line);
    const isSeveranceLine = /פיצוי|פיצויים/i.test(line);

    if (lineBase !== undefined) {
      pushCandidate(store, 'pension_base', lineBase, {
        source: 'contribution_inline_base',
        lineIndex: index,
        score: 0.72,
        reason: 'Matched pension base salary from the contribution line.',
        section: 'contributions',
        evidenceCategory: 'inline_base',
      });
    }

    if (effectiveBase !== undefined && rates.length) {
      for (const rate of rates) {
        const expectedAmount = +(effectiveBase * (rate / 100)).toFixed(2);
        const amount = bestAmountByExpected(amounts, expectedAmount, 25);
        if (amount === undefined) continue;

        if (isSeveranceLine) {
          pushCandidate(store, 'pension_severance', amount, {
            source: 'contribution_rate_match',
            lineIndex: index,
            score: 0.88,
            reason: 'Matched severance amount from role + base + rate.',
            section: 'contributions',
            evidenceCategory: 'base_rate_match',
          });
        } else if (isEmployeeLine) {
          pushCandidate(store, 'pension_employee', amount, {
            source: 'contribution_rate_match',
            lineIndex: index,
            score: 0.88,
            reason: 'Matched pension employee amount from role + base + rate.',
            section: 'contributions',
            evidenceCategory: 'base_rate_match',
          });
        } else if (isEmployerLine) {
          pushCandidate(store, 'pension_employer', amount, {
            source: 'contribution_rate_match',
            lineIndex: index,
            score: 0.88,
            reason: 'Matched pension employer amount from role + base + rate.',
            section: 'contributions',
            evidenceCategory: 'base_rate_match',
          });
        }
      }
    }

    if (amounts.length === 1 && singleAmountMatchesRates(amounts[0], effectiveBase, rates, 25)) {
      if (isEmployeeLine) {
        pushCandidate(store, 'pension_employee', amounts[0], {
          source: 'contribution_single_amount',
          lineIndex: index,
          score: 0.68,
          reason: 'Matched pension employee amount from a role-tagged single amount line.',
          section: 'contributions',
          evidenceCategory: 'role_single_amount',
        });
      }

      if (isEmployerLine) {
        pushCandidate(store, 'pension_employer', amounts[0], {
          source: 'contribution_single_amount',
          lineIndex: index,
          score: 0.68,
          reason: 'Matched pension employer amount from a role-tagged single amount line.',
          section: 'contributions',
          evidenceCategory: 'role_single_amount',
        });
      }

      if (isSeveranceLine) {
        pushCandidate(store, 'pension_severance', amounts[0], {
          source: 'contribution_single_amount',
          lineIndex: index,
          score: 0.68,
          reason: 'Matched severance amount from a role-tagged single amount line.',
          section: 'contributions',
          evidenceCategory: 'role_single_amount',
        });
      }
    }
  }

  return {
    store,
    stats: {
      studyLinesFound: studyLines.length,
      pensionLinesFound: pensionLines.length,
      studyDebugLine: studyLines[0]?.line,
      pensionDebugLines: pensionLines.slice(0, 8).map(entry => entry.line),
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
