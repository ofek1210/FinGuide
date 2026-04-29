const { normalizeAmount } = require('./numeric');

const CURRENT_YEAR = () => new Date().getFullYear();

const buildLinearSavingsScenario = ({
  currentBalance,
  currentAge,
  retirementAge,
  monthlyContribution,
  currentYear = CURRENT_YEAR(),
}) => {
  const yearsToRetirement = retirementAge - currentAge;
  const monthsToRetirement = yearsToRetirement * 12;
  const projectedBalance = normalizeAmount(
    currentBalance + monthlyContribution * monthsToRetirement
  );

  const timeline = Array.from({ length: yearsToRetirement + 1 }, (_, index) => {
    const monthsFromNow = index * 12;
    return {
      yearIndex: index,
      age: currentAge + index,
      calendarYear: currentYear + index,
      monthsFromNow,
      projectedBalance: normalizeAmount(
        currentBalance + monthlyContribution * monthsFromNow
      ),
    };
  });

  return {
    monthlyContribution: normalizeAmount(monthlyContribution),
    monthsToRetirement,
    projectedBalance,
    timeline,
  };
};

module.exports = {
  buildLinearSavingsScenario,
};
