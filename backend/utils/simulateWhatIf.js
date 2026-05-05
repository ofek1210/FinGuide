const { normalizeAmount } = require('./numeric');
const { validateSalary } = require('./validateSalary');
const { ValidationError } = require('./appErrors');

const SUPPORTED_CHANGE_TYPES = ['gross_percent', 'gross_amount'];

// Israeli tax brackets 2024/2025 (monthly amounts in NIS)
const TAX_BRACKETS = [
  { upTo: 6790, rate: 0.10 },
  { upTo: 9730, rate: 0.14 },
  { upTo: 15620, rate: 0.20 },
  { upTo: 21710, rate: 0.31 },
  { upTo: 45180, rate: 0.35 },
  { upTo: 58190, rate: 0.47 },
  { upTo: Infinity, rate: 0.50 },
];

// National insurance rates (employee) 2024
const NI_REDUCED_CEILING = 7122; // 60% of average wage
const NI_REDUCED_RATE = 0.004; // 0.4% below reduced ceiling
const NI_FULL_RATE = 0.07; // 7% above reduced ceiling up to max
const NI_MAX_INCOME = 47465; // max insurable income

// Health insurance rates (employee) 2024
const HEALTH_REDUCED_RATE = 0.031; // 3.1% below reduced ceiling
const HEALTH_FULL_RATE = 0.05; // 5% above reduced ceiling

// Tax credit point value (monthly, 2024)
const CREDIT_POINT_VALUE = 235;

function calculateIncomeTax(monthlyGross, creditPoints = 2.25) {
  let tax = 0;
  let prev = 0;
  for (const bracket of TAX_BRACKETS) {
    const taxable = Math.min(monthlyGross, bracket.upTo) - prev;
    if (taxable <= 0) break;
    tax += taxable * bracket.rate;
    prev = bracket.upTo;
  }
  // Apply credit points
  const credit = creditPoints * CREDIT_POINT_VALUE;
  return Math.max(0, tax - credit);
}

function calculateNationalInsurance(monthlyGross) {
  const capped = Math.min(monthlyGross, NI_MAX_INCOME);
  if (capped <= NI_REDUCED_CEILING) {
    return capped * NI_REDUCED_RATE;
  }
  return NI_REDUCED_CEILING * NI_REDUCED_RATE + (capped - NI_REDUCED_CEILING) * NI_FULL_RATE;
}

function calculateHealthInsurance(monthlyGross) {
  const capped = Math.min(monthlyGross, NI_MAX_INCOME);
  if (capped <= NI_REDUCED_CEILING) {
    return capped * HEALTH_REDUCED_RATE;
  }
  return NI_REDUCED_CEILING * HEALTH_REDUCED_RATE + (capped - NI_REDUCED_CEILING) * HEALTH_FULL_RATE;
}

function estimateNet(gross, creditPoints = 2.25) {
  const tax = calculateIncomeTax(gross, creditPoints);
  const ni = calculateNationalInsurance(gross);
  const health = calculateHealthInsurance(gross);
  return gross - tax - ni - health;
}

const ensureValidChange = change => {
  if (!change || typeof change !== 'object') {
    throw new ValidationError('change is required', [
      { field: 'change', message: 'change is required', value: change },
    ]);
  }

  const { type, value } = change;

  if (!SUPPORTED_CHANGE_TYPES.includes(type)) {
    throw new ValidationError('Invalid change type', [
      { field: 'change.type', message: 'Invalid change type', value: type },
    ]);
  }

  if (!Number.isFinite(value)) {
    throw new ValidationError('change value must be a number', [
      { field: 'change.value', message: 'change value must be a number', value },
    ]);
  }

  return { type, value };
};

const simulateWhatIf = ({ gross, net, change, creditPoints }) => {
  const { grossSalary, netSalary } = validateSalary({
    grossSalary: gross,
    netSalary: net,
  });

  const { type, value } = ensureValidChange(change);

  const newGross =
    type === 'gross_percent'
      ? grossSalary * (1 + value)
      : grossSalary + value;

  if (newGross <= 0) {
    throw new Error('הסכום החדש לא יכול להיות אפס או שלילי.');
  }

  // Use Israeli tax bracket calculation for the DELTA in mandatory deductions.
  // We can't know pension/voluntary deductions, so we calculate the change
  // in mandatory deductions (tax + NI + health) between old and new gross,
  // and apply that delta to the actual net.
  const effectiveCreditPoints = creditPoints ?? 2.25;

  const oldMandatory =
    calculateIncomeTax(grossSalary, effectiveCreditPoints) +
    calculateNationalInsurance(grossSalary) +
    calculateHealthInsurance(grossSalary);

  const newMandatory =
    calculateIncomeTax(newGross, effectiveCreditPoints) +
    calculateNationalInsurance(newGross) +
    calculateHealthInsurance(newGross);

  const mandatoryDelta = newMandatory - oldMandatory;
  const deltaGross = newGross - grossSalary;
  // Net changes by: gross increase minus the increase in mandatory deductions
  const deltaNet = deltaGross - mandatoryDelta;
  const newNet = netSalary + deltaNet;

  return {
    original: {
      gross: grossSalary,
      net: netSalary,
    },
    scenario: {
      gross: normalizeAmount(newGross),
      net: normalizeAmount(newNet),
    },
    delta: {
      gross: normalizeAmount(deltaGross),
      net: normalizeAmount(deltaNet),
    },
  };
};

module.exports = {
  simulateWhatIf,
  calculateIncomeTax,
  calculateNationalInsurance,
  calculateHealthInsurance,
  estimateNet,
};
