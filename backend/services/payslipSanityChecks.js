'use strict';

/**
 * Deterministic arithmetic sanity checks for vision-extracted payslips.
 * Zero AI cost — catches swapped columns and arithmetic drift.
 *
 * @module services/payslipSanityChecks
 */

const TOLERANCE_ABS = 2;
const TOLERANCE_REL = 0.02;

function approxEqual(a, b, tolerance = TOLERANCE_ABS) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const rel = Math.max(tolerance, Math.abs(b) * TOLERANCE_REL);
  return Math.abs(a - b) <= rel;
}

function checkContributionGroup(label, employee, employer, total, base, employeeRate, employerRate) {
  const issues = [];

  if (Number.isFinite(employee) && Number.isFinite(employer) && Number.isFinite(total)) {
    const sum = +(employee + employer).toFixed(2);
    if (!approxEqual(sum, total)) {
      issues.push(
        `${label}: employee (${employee}) + employer (${employer}) = ${sum} ≠ stated total (${total})`,
      );
    }
  } else if (Number.isFinite(employee) && Number.isFinite(employer) && !Number.isFinite(total)) {
    // OK — total not always printed
  }

  if (Number.isFinite(base) && Number.isFinite(employeeRate) && Number.isFinite(employee)) {
    const expected = +(base * (employeeRate / 100)).toFixed(2);
    if (!approxEqual(expected, employee, Math.max(5, base * 0.005))) {
      issues.push(
        `${label} employee: rate ${employeeRate}% × base ${base} = ${expected} ≠ amount ${employee}`,
      );
    }
  }

  if (Number.isFinite(base) && Number.isFinite(employerRate) && Number.isFinite(employer)) {
    const expected = +(base * (employerRate / 100)).toFixed(2);
    if (!approxEqual(expected, employer, Math.max(5, base * 0.005))) {
      issues.push(
        `${label} employer: rate ${employerRate}% × base ${base} = ${expected} ≠ amount ${employer}`,
      );
    }
  }

  return issues;
}

/**
 * @param {object} data — schema_version 1.9 analysisData
 * @returns {{ passed: boolean, flaggedInconsistencies: string[], warnings: string[] }}
 */
function runPayslipSanityChecks(data) {
  const flaggedInconsistencies = [];
  const warnings = [];

  const gross = data?.salary?.gross_total;
  const net = data?.salary?.net_payable;
  const mandatory = data?.deductions?.mandatory?.total;
  const voluntary = data?.deductions?.voluntary_total;
  const pension = data?.contributions?.pension || {};
  const study = data?.contributions?.study_fund || {};

  if (Number.isFinite(gross) && Number.isFinite(net) && net > gross * 1.005) {
    flaggedInconsistencies.push(`net_payable (${net}) exceeds gross_total (${gross})`);
  }

  if (Number.isFinite(gross) && Number.isFinite(mandatory) && mandatory > gross * 1.005) {
    flaggedInconsistencies.push(`mandatory_total (${mandatory}) exceeds gross_total (${gross})`);
  }

  if (Number.isFinite(gross) && Number.isFinite(net) && Number.isFinite(mandatory)) {
    const voluntaryAmt = Number.isFinite(voluntary) ? voluntary : 0;
    const pensionEmp = Number.isFinite(pension.employee) ? pension.employee : 0;
    const studyEmp = Number.isFinite(study.employee) ? study.employee : 0;
    const impliedNet = +(gross - mandatory - voluntaryAmt - pensionEmp - studyEmp).toFixed(2);
    if (Number.isFinite(voluntaryAmt + pensionEmp + studyEmp) && !approxEqual(impliedNet, net, Math.max(50, gross * 0.05))) {
      warnings.push(
        `gross (${gross}) − mandatory (${mandatory}) − voluntary (${voluntaryAmt}) − pension_employee (${pensionEmp}) − study_employee (${studyEmp}) = ${impliedNet}, expected net ≈ ${net}`,
      );
    }
  }

  flaggedInconsistencies.push(
    ...checkContributionGroup(
      'pension',
      pension.employee,
      pension.employer,
      pension.participation_total,
      pension.base_salary_for_pension,
      pension.employee_rate_percent,
      pension.employer_rate_percent,
    ),
  );

  flaggedInconsistencies.push(
    ...checkContributionGroup(
      'study_fund',
      study.employee,
      study.employer,
      study.participation_total,
      study.base_salary_for_study_fund,
      study.employee_rate_percent,
      study.employer_rate_percent,
    ),
  );

  return {
    passed: flaggedInconsistencies.length === 0,
    flaggedInconsistencies,
    warnings,
  };
}

module.exports = {
  runPayslipSanityChecks,
  approxEqual,
};
