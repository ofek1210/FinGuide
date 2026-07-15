const { toFiniteNumber } = require('./payslipPeriod');
const { readTaxCreditPoints } = require('./taxCreditPoints');

function toPositiveSalary(value) {
  const n = toFiniteNumber(value);
  return n != null && n > 0 ? n : null;
}

function isGrossPlausible(gross, salary) {
  if (!Number.isFinite(gross) || gross <= 0) return false;
  const components = salary?.components;
  if (!Array.isArray(components) || !components.length) return true;
  const maxComponent = components.reduce((max, c) => {
    const amount = toFiniteNumber(c.amount) ?? 0;
    return Math.max(max, amount);
  }, 0);
  return gross >= maxComponent;
}

function sumSalaryComponents(salary) {
  const components = salary?.components;
  if (!Array.isArray(components) || !components.length) return null;
  const total = components.reduce((sum, c) => {
    const amount = toFiniteNumber(c.amount);
    return amount != null && amount > 0 ? sum + amount : sum;
  }, 0);
  return total > 0 ? Math.round(total * 100) / 100 : null;
}

function readPensionEmployee(analysis) {
  const summary = analysis?.summary || {};
  const pension = analysis?.contributions?.pension || {};
  return toFiniteNumber(summary.pensionEmployee)
    ?? toFiniteNumber(pension.employee_amount)
    ?? toFiniteNumber(pension.employee);
}

function readPensionEmployer(analysis) {
  const summary = analysis?.summary || {};
  const pension = analysis?.contributions?.pension || {};
  return toFiniteNumber(summary.pensionEmployer)
    ?? toFiniteNumber(pension.employer_amount)
    ?? toFiniteNumber(pension.employer);
}

function readStudyEmployee(analysis) {
  const summary = analysis?.summary || {};
  const study = analysis?.contributions?.study_fund || {};
  return toFiniteNumber(summary.trainingFundEmployee)
    ?? toFiniteNumber(study.employee_amount)
    ?? toFiniteNumber(study.employee);
}

function readStudyEmployer(analysis) {
  const summary = analysis?.summary || {};
  const study = analysis?.contributions?.study_fund || {};
  return toFiniteNumber(summary.trainingFundEmployer)
    ?? toFiniteNumber(study.employer_amount)
    ?? toFiniteNumber(study.employer);
}

/**
 * Normalize payslip numbers from analysisData with fallbacks for partial OCR.
 * Accepts a Mongoose document or plain { analysisData } object.
 */
function enrichSummary(document) {
  const analysis = document?.analysisData || document;
  if (!analysis || typeof analysis !== 'object') {
    return {
      grossSalary: null,
      netSalary: null,
      tax: null,
      nationalInsurance: null,
      healthInsurance: null,
      mandatoryTotal: null,
      pensionEmployee: null,
      pensionEmployer: null,
      studyFundEmployee: null,
      studyFundEmployer: null,
      pensionSeverance: null,
      vacationDays: null,
      sickDays: null,
      taxCreditPoints: null,
    };
  }

  const summary = analysis.summary || {};
  const salary = analysis.salary || {};
  const deductions = analysis.deductions?.mandatory || {};
  const contributions = analysis.contributions || {};
  const tax = analysis.tax || {};

  const rawGross = toPositiveSalary(summary.grossSalary) ?? toPositiveSalary(salary.gross_total);
  const grossSalary = isGrossPlausible(rawGross, salary)
    ? rawGross
    : (toPositiveSalary(sumSalaryComponents(salary))
        ?? toPositiveSalary(tax.gross_for_income_tax)
        ?? rawGross);

  const rawNet = toPositiveSalary(summary.netSalary) ?? toPositiveSalary(salary.net_payable);
  const grossForNetCheck = grossSalary || toPositiveSalary(tax.gross_for_income_tax);
  const netIsPlausible = Number.isFinite(rawNet) && Number.isFinite(grossForNetCheck)
    && grossForNetCheck > 0
    && (rawNet / grossForNetCheck) >= 0.3;
  const mandatoryTotal = toFiniteNumber(deductions.total);
  const pensionEmployee = readPensionEmployee(analysis) ?? 0;
  const derivedNet = (() => {
    if (!Number.isFinite(grossForNetCheck)) return null;
    if (!Number.isFinite(mandatoryTotal)) {
      const taxAmt = toFiniteNumber(deductions.income_tax) ?? 0;
      const niAmt = toFiniteNumber(deductions.national_insurance) ?? 0;
      const hiAmt = toFiniteNumber(deductions.health_insurance) ?? 0;
      const studyAmt = readStudyEmployee(analysis) ?? 0;
      const partial = taxAmt + niAmt + hiAmt + pensionEmployee + studyAmt;
      if (partial <= 0) return null;
      return Math.round((grossForNetCheck - partial) * 100) / 100;
    }
    return Math.round((grossForNetCheck - mandatoryTotal - pensionEmployee) * 100) / 100;
  })();
  const netSalary = netIsPlausible ? rawNet : (derivedNet ?? rawNet);
  const taxCreditPoints = readTaxCreditPoints(analysis);

  return {
    grossSalary,
    netSalary,
    tax: toFiniteNumber(summary.tax) ?? toFiniteNumber(deductions.income_tax),
    nationalInsurance:
      toFiniteNumber(summary.nationalInsurance) ?? toFiniteNumber(deductions.national_insurance),
    healthInsurance:
      toFiniteNumber(summary.healthInsurance) ?? toFiniteNumber(deductions.health_insurance),
    mandatoryTotal,
    pensionEmployee: readPensionEmployee(analysis),
    pensionEmployer: readPensionEmployer(analysis),
    studyFundEmployee: readStudyEmployee(analysis),
    studyFundEmployer: readStudyEmployer(analysis),
    pensionSeverance: toFiniteNumber(summary.pensionSeverance)
      ?? toFiniteNumber(contributions?.pension?.severance_amount)
      ?? toFiniteNumber(contributions?.pension?.severance),
    vacationDays: toFiniteNumber(summary.vacationDays),
    sickDays: toFiniteNumber(summary.sickDays),
    taxCreditPoints,
  };
}

function avgField(values, key) {
  const nums = values.map(v => v[key]).filter(Number.isFinite);
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

const MONEY_FLOW_LABELS = [
  { key: 'tax', label: 'מס הכנסה' },
  { key: 'nationalInsurance', label: 'ביטוח לאומי' },
  { key: 'healthInsurance', label: 'מס בריאות' },
  { key: 'pensionEmployee', label: 'הפקדה לפנסיה (עובד)' },
  { key: 'pensionEmployer', label: 'הפקדה לפנסיה (מעסיק)' },
  { key: 'studyFundEmployee', label: 'קרן השתלמות (עובד)' },
  { key: 'studyFundEmployer', label: 'קרן השתלמות (מעסיק)' },
];

function sumField(values, key) {
  const total = values.reduce((sum, e) => {
    const v = e[key];
    return Number.isFinite(v) && v > 0 ? sum + v : sum;
  }, 0);
  return Math.round(total);
}

function buildMoneyFlow(enrichedList) {
  const valid = enrichedList.filter(e => Number.isFinite(e.grossSalary) && Number.isFinite(e.netSalary));
  if (!valid.length) return null;

  const avgGross = avgField(valid, 'grossSalary');
  const avgNet = avgField(valid, 'netSalary');
  if (!Number.isFinite(avgGross) || !Number.isFinite(avgNet)) return null;

  const totalGross = Math.round(valid.reduce((s, e) => s + e.grossSalary, 0));
  const totalWithheld = Math.round(
    valid.reduce((s, e) => s + (e.grossSalary - e.netSalary), 0),
  );
  const items = MONEY_FLOW_LABELS
    .map(({ key, label }) => {
      const totalAmount = sumField(valid, key);
      if (totalAmount <= 0) return null;
      return {
        label,
        totalAmount,
        avgAmount: totalAmount,
        pctOfGross: totalGross > 0 ? Math.round((totalAmount / totalGross) * 1000) / 10 : 0,
        pctOfGap: totalWithheld > 0 ? Math.round((totalAmount / totalWithheld) * 1000) / 10 : 0,
      };
    })
    .filter(Boolean);

  const itemised = items.reduce((s, i) => s + i.totalAmount, 0);
  const remainder = totalWithheld - itemised;
  if (remainder > 50) {
    items.push({
      label: 'ניכויים נוספים / אחר',
      totalAmount: Math.round(remainder),
      avgAmount: Math.round(remainder),
      pctOfGross: totalGross > 0 ? Math.round((remainder / totalGross) * 1000) / 10 : 0,
      pctOfGap: totalWithheld > 0 ? Math.round((remainder / totalWithheld) * 1000) / 10 : 0,
    });
  }

  items.sort((a, b) => b.totalAmount - a.totalAmount);

  return {
    payslipCount: valid.length,
    avgGross,
    avgNet,
    totalGross,
    totalWithheld,
    items,
  };
}

module.exports = {
  enrichSummary,
  buildMoneyFlow,
  avgField,
};
