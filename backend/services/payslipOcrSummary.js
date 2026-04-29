const {
  linesOf,
  match1,
  parseNumber,
} = require('./payslipOcrShared');

function extractNumberByRegexes(full, regexes, parser = parseNumber) {
  if (!full) return null;
  for (const regex of regexes) {
    const match = String(full).match(regex);
    if (match && match[1]) {
      const value = parser(match[1]);
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }
  return null;
}

function buildPayslipSummary(data, rawText) {
  if (!data || typeof data !== 'object') return null;

  const textSource =
    rawText ||
    data.raw?.ocr_text ||
    data.raw?.rawText ||
    '';

  const lines = linesOf(textSource);
  const full = lines.join('\n');

  const dateFromText =
    match1(full, /לחודש\s+([0-9]{2}\/[0-9]{4})/i) ||
    match1(full, /תאריך[:\s]+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i) ||
    match1(full, /חודש[:\s]+([^\n]+)/i);

  const employeeName = data.parties?.employee_name || null;
  const date =
    data.period?.month ||
    dateFromText ||
    data.employment?.employment_start_date ||
    null;

  const grossSalary = data.salary?.gross_total ?? null;
  const netSalary = data.salary?.net_payable ?? null;

  const vacationDays =
    extractNumberByRegexes(
      full,
      [
        /(?:ימי|יתרת)\s*חופשה[^\d]*(\d[\d,.\s]+)/i,
        /חופשה\s*צבורה[^\d]*(\d[\d,.\s]+)/i,
        /(?:ניצול\s*חופש|יתרת\s*פתיחה)[\s\S]{0,120}?(\d+(?:[.,]\d+)?)/i,
      ],
      parseNumber,
    ) ?? null;

  const sickDays =
    extractNumberByRegexes(
      full,
      [
        /(?:ימי|יתרת)\s*מחלה[^\d]*(\d[\d,.\s]+)/i,
        /מחלה\s*צבורה[^\d]*(\d[\d,.\s]+)/i,
        /(?:מחלת\s*עובד|יתרת\s*פתיחה)[\s\S]{0,120}?(\d+(?:[.,]\d+)?)/i,
      ],
      parseNumber,
    ) ?? null;

  const pensionEmployee = data.contributions?.pension?.employee ?? null;
  const pensionEmployer = data.contributions?.pension?.employer ?? null;
  const trainingFundEmployee = data.contributions?.study_fund?.employee ?? null;
  const trainingFundEmployer = data.contributions?.study_fund?.employer ?? null;
  const tax = data.deductions?.mandatory?.income_tax ?? null;
  const nationalInsurance = data.deductions?.mandatory?.national_insurance ?? null;
  const healthInsurance = data.deductions?.mandatory?.health_insurance ?? null;
  const jobPercentage = data.employment?.job_percent ?? null;

  let workingDays =
    extractNumberByRegexes(
      full,
      [
        /ימי\s*עבודה[^\d]*(\d[\d,.\s]+)/i,
        /ימי\s*עבודה[\s\S]{0,120}?(\d{1,2})\b/,
      ],
      parseNumber,
    ) ?? null;
  if (workingDays != null && (workingDays < 1 || workingDays > 31)) workingDays = null;

  const workingHours =
    extractNumberByRegexes(
      full,
      [/(?:שעות\s*עבודה|סה["״']?כ\s*שעות)[^\d]*(\d[\d,.\s]+)/i],
      parseNumber,
    ) ?? null;

  return {
    employeeName,
    date,
    grossSalary,
    netSalary,
    vacationDays,
    sickDays,
    pensionEmployee,
    pensionEmployer,
    trainingFundEmployee,
    trainingFundEmployer,
    tax,
    nationalInsurance,
    healthInsurance,
    jobPercentage,
    workingDays,
    workingHours,
  };
}

module.exports = {
  buildPayslipSummary,
  extractNumberByRegexes,
};
