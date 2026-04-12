const {
  bestAmountByExpected,
  isLikelyTaxBaseNoiseLine,
  pickReasonableAmount,
} = require('./payslipOcrShared');
const {
  extractAllNumericTokens,
  extractPercentTokens,
} = require('./payslipOcrNumbers');

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

function extractStudyFund(lines, warnings) {
  const baseLine = lines.find(line => /שכר\s*לקרן\s*השתלמות/i.test(line));
  const baseFromBaseLine = baseLine
    ? pickReasonableAmount(extractAllNumericTokens(baseLine), { min: 5000, max: 200000 })
    : undefined;

  const contributionLines = lines.filter(
    line =>
      /קרן\s*השתלמות/i.test(line) &&
      !/נתוניס\s*מצטברים|מצטבר/i.test(line),
  );

  if (!contributionLines.length) {
    warnings.push('Study fund line not found (קרן השתלמות).');
    return { base: baseFromBaseLine };
  }

  let base = baseFromBaseLine;
  let employeeRate;
  let employerRate;
  let employee;
  let employer;

  for (const line of contributionLines) {
    const nums = extractAllNumericTokens(line);
    const lineBase = pickReasonableAmount(nums, { min: 5000, max: 200000 });
    const effectiveBase = base ?? lineBase;
    const rates = extractPercentTokens(line).slice(0, 4);
    const moneyAmounts = nums.filter(
      value => value >= 50 && value <= 30000 && !(effectiveBase && Math.abs(value - effectiveBase) < 5),
    );
    const isEmployeeLine = /(עובד|ניכוי\s*עובד|תגמולי\s*עובד)/i.test(line);
    const isEmployerLine = /(מעביד|מעסיק|הפרשת\s*מעסיק|תגמולי\s*מעביד)/i.test(line);

    if (effectiveBase !== undefined && base === undefined) {
      base = effectiveBase;
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

        if (isEmployeeLine && employee === undefined) {
          employee = matchedAmount;
          employeeRate = rate;
        }

        if (isEmployerLine && employer === undefined) {
          employer = matchedAmount;
          employerRate = rate;
        }
      }
    }

    if (isEmployeeLine && employee === undefined && moneyAmounts.length === 1) {
      if (singleAmountMatchesRates(moneyAmounts[0], effectiveBase, rates, 20)) {
        employee = moneyAmounts[0];
      }
    }

    if (isEmployerLine && employer === undefined && moneyAmounts.length === 1) {
      if (singleAmountMatchesRates(moneyAmounts[0], effectiveBase, rates, 20)) {
        employer = moneyAmounts[0];
      }
    }
  }

  if ((employee === undefined || employer === undefined) && contributionLines.length > 0) {
    warnings.push('Study fund amounts found but employee/employer roles were ambiguous.');
  }

  return {
    base,
    employee,
    employer,
    employeeRate,
    employerRate,
    debug_line: contributionLines[0],
  };
}

function extractPension(lines, warnings) {
  const baseLine = lines.find(line => /שכר\s*לקצבה/i.test(line));
  const base = baseLine
    ? pickReasonableAmount(extractAllNumericTokens(baseLine), { min: 5000, max: 200000 })
    : undefined;

  const pensionLines = lines.filter(
    line =>
      (
        /(תגמול|תגמולים|פיצוי|פיצויים|פנסי|ביטוח\s*מנהלים|קופ["״]?ג|גמל)/i.test(line) ||
        /(ניכוי\s*עובד|הפרשת\s*מעסיק)/i.test(line)
      ) &&
      !/נתוניס\s*מצטברים|מצטבר/i.test(line) &&
      !isLikelyTaxBaseNoiseLine(line),
  );

  let employee;
  let employer;
  let severance;
  let base_for_severance;

  for (const line of pensionLines) {
    const nums = extractAllNumericTokens(line);
    if (!nums.length) continue;

    const localBase = pickReasonableAmount(nums, { min: 5000, max: 200000 }) ?? base;
    const rates = extractPercentTokens(line);
    const amounts = nums.filter(
      value => value >= 50 && value <= 60000 && !(localBase && Math.abs(value - localBase) < 5),
    );
    const isEmployeeLine = /(עובד|תגמולי\s*עובד|ניכוי\s*עובד)/i.test(line);
    const isEmployerLine = /(מעביד|מעסיק|תגמולי\s*מעביד|הפרשת\s*מעסיק)/i.test(line);
    const isSeveranceLine = /פיצוי|פיצויים/i.test(line);

    if (localBase !== undefined && rates.length) {
      for (const rate of rates) {
        const expected = +(localBase * (rate / 100)).toFixed(2);
        const amount = bestAmountByExpected(amounts, expected, 25);
        if (amount === undefined) continue;

        if (isSeveranceLine) {
          severance = severance ?? amount;
          base_for_severance = base_for_severance ?? localBase;
        } else if (isEmployeeLine) {
          employee = employee ?? amount;
        } else if (isEmployerLine) {
          employer = employer ?? amount;
        }
      }
    }

    if (isEmployeeLine && employee === undefined && amounts.length === 1) {
      if (singleAmountMatchesRates(amounts[0], localBase, rates, 25)) {
        employee = amounts[0];
      }
    }

    if (isEmployerLine && employer === undefined && amounts.length === 1) {
      if (singleAmountMatchesRates(amounts[0], localBase, rates, 25)) {
        employer = amounts[0];
      }
    }

    if (isSeveranceLine && severance === undefined && amounts.length === 1) {
      if (singleAmountMatchesRates(amounts[0], localBase, rates, 25)) {
        severance = amounts[0];
        base_for_severance = base_for_severance ?? localBase;
      }
    }
  }

  if (!pensionLines.length) warnings.push('Pension lines not found (פנסיה/תגמולים/פיצויים).');
  if (pensionLines.length && (employee === undefined || employer === undefined)) {
    warnings.push('Pension contribution lines found but employee/employer roles were ambiguous.');
  }

  return {
    base,
    employee,
    employer,
    severance,
    base_for_severance,
    debug_lines: pensionLines.slice(0, 8),
  };
}

module.exports = {
  extractPension,
  extractStudyFund,
};
