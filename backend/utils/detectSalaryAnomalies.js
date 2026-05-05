const { normalizeAmount } = require('./numeric');

const DEFAULTS = {
  netToGrossRatioThreshold: 0.95,
  highGrossThreshold: 80_000,
  lowGrossThreshold: 3_000,
  roundIncrement: 1_000,
  minRoundCheck: 5_000,
  checkRoundGross: false,
};

const buildAnomaly = (code, message, severity, meta = {}) => ({
  code,
  message,
  severity,
  ...Object.keys(meta).length ? { meta } : {},
});

const isFiniteNumber = value => Number.isFinite(value);

const detectSalaryAnomalies = (
  { grossSalary, netSalary },
  options = {}
) => {
  const config = { ...DEFAULTS, ...options };
  const anomalies = [];

  if (!isFiniteNumber(grossSalary) || !isFiniteNumber(netSalary)) {
    return {
      hasAnomalies: true,
      anomalies: [
        buildAnomaly(
          'INVALID_SALARY_INPUT',
          'Salary values could not be analyzed',
          'high',
          { grossSalary, netSalary }
        ),
      ],
    };
  }

  const normalizedGross = normalizeAmount(grossSalary);
  const normalizedNet = normalizeAmount(netSalary);

  if (normalizedGross > 0) {
    const ratio = normalizedNet / normalizedGross;
    if (ratio > config.netToGrossRatioThreshold) {
      anomalies.push(
        buildAnomaly(
          'NET_TOO_CLOSE_TO_GROSS',
          'Net salary is unusually close to gross salary',
          'medium',
          { ratio }
        )
      );
    }
  }

  if (normalizedGross > config.highGrossThreshold) {
    anomalies.push(
      buildAnomaly(
        'GROSS_UNUSUALLY_HIGH',
        'Gross salary is unusually high',
        'high',
        { threshold: config.highGrossThreshold }
      )
    );
  }

  if (normalizedGross < config.lowGrossThreshold) {
    anomalies.push(
      buildAnomaly(
        'GROSS_UNUSUALLY_LOW',
        'Gross salary is unusually low',
        'medium',
        { threshold: config.lowGrossThreshold }
      )
    );
  }

  const deductions = normalizeAmount(normalizedGross - normalizedNet);
  if (deductions === 0) {
    anomalies.push(
      buildAnomaly(
        'ZERO_DEDUCTIONS',
        'No deductions detected (gross equals net)',
        'medium'
      )
    );
  }

  if (config.checkRoundGross) {
    const isRoundGross =
      normalizedGross >= config.minRoundCheck &&
      normalizedGross % config.roundIncrement === 0;
    if (isRoundGross) {
      anomalies.push(
        buildAnomaly(
          'GROSS_SUSPICIOUSLY_ROUND',
          'Gross salary is a round number',
          'low',
          { increment: config.roundIncrement }
        )
      );
    }
  }

  return {
    hasAnomalies: anomalies.length > 0,
    anomalies,
  };
};

module.exports = {
  detectSalaryAnomalies,
  DEFAULTS,
};
