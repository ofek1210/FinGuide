/**
 * Rule Engine
 *
 * Layer 1 of the Hybrid AI stack.
 * Pure deterministic rules — no LLM.
 * Consolidates detection logic from utils/detect*.js into a single entry point.
 *
 * Architecture:
 *   Rule Engine → findings DTO → passed to agents
 *   Never: Rule Engine → MongoDB directly
 */

'use strict';

const { detectFundContributionStatus } = require('../../utils/detectFundWithoutDeposit');
const { detectSalaryAnomalies } = require('../../utils/detectSalaryAnomalies');

// ── Salary rules ──────────────────────────────────────────────────────────────

/**
 * Check for salary anomalies (month-over-month).
 * @param {Array<{grossSalary: number, netSalary: number, date: string}>} payslips
 * @returns {{ hasAnomalies: boolean, anomalies: string[] }}
 */
function runSalaryAnomalyRules(payslips) {
  if (!Array.isArray(payslips) || payslips.length === 0) {
    return { hasAnomalies: false, anomalies: [] };
  }
  const latest = payslips[0];
  if (!latest) return { hasAnomalies: false, anomalies: [] };

  const result = detectSalaryAnomalies({
    grossSalary: latest.grossSalary,
    netSalary: latest.netSalary,
  });

  return {
    hasAnomalies: result.hasAnomalies || false,
    anomalies: result.anomalies || [],
  };
}

// ── Pension rules ─────────────────────────────────────────────────────────────

/**
 * Check pension contribution rate against legal minimum.
 * @param {number} grossSalary
 * @param {number} pensionEmployee
 * @returns {{ belowMinimum: boolean, rate: number, minimumRate: number }}
 */
function runPensionContributionRules(grossSalary, pensionEmployee) {
  if (!grossSalary || !pensionEmployee) {
    return { belowMinimum: false, rate: null, minimumRate: 0.06 };
  }
  const rate = pensionEmployee / grossSalary;
  return {
    belowMinimum: rate < 0.06,
    rate: parseFloat((rate * 100).toFixed(2)),
    minimumRate: 6,
  };
}

/**
 * Check if pension fund section exists but amounts are missing (OCR gap).
 * @param {object} analysisData - document.analysisData
 * @returns {{ hasPensionGap: boolean, missingRoles: string[] }}
 */
function runPensionGapRules(analysisData) {
  const status = detectFundContributionStatus(analysisData, 'pension');
  const missingRoles = [];
  if (status.fundSectionDetected) {
    if (status.employeeAmount === null || status.employeeAmount === undefined) missingRoles.push('employee');
    if (status.employerAmount === null || status.employerAmount === undefined) missingRoles.push('employer');
  }
  return {
    hasPensionGap: missingRoles.length > 0,
    missingRoles,
    fundSectionDetected: status.fundSectionDetected,
  };
}

// ── Insurance rules ───────────────────────────────────────────────────────────

/**
 * Detect duplicate insurance coverage.
 * @param {Array<{type: string, provider: string, monthlyPremium: number}>} policies
 * @returns {{ duplicates: Array<{type: string, policies: object[]}>, totalWaste: number }}
 */
function runInsuranceDuplicateRules(policies) {
  if (!Array.isArray(policies) || policies.length === 0) {
    return { duplicates: [], totalWaste: 0 };
  }

  const byType = {};
  for (const policy of policies) {
    const t = policy.type || 'unknown';
    if (!byType[t]) byType[t] = [];
    byType[t].push(policy);
  }

  const duplicates = [];
  let totalWaste = 0;

  for (const [type, group] of Object.entries(byType)) {
    if (group.length > 1) {
      // The lowest-premium policy is the "keeper"; rest are waste
      const sorted = [...group].sort((a, b) => (a.monthlyPremium || 0) - (b.monthlyPremium || 0));
      const waste = sorted
        .slice(1)
        .reduce((sum, p) => sum + (p.monthlyPremium || 0), 0);
      duplicates.push({ type, policies: group, estimatedMonthlyWaste: waste });
      totalWaste += waste;
    }
  }

  return { duplicates, totalWaste };
}

/**
 * Detect missing coverage based on user profile.
 * @param {object} profile - UserProfile data
 * @param {Array<{type: string}>} policies
 * @returns {{ missingTypes: string[], urgency: 'high' | 'medium' | 'low' }}
 */
function runMissingCoverageRules(profile, policies) {
  const coveredTypes = new Set((policies || []).map((p) => p.type));
  const missing = [];

  const ins = profile?.insurance || {};
  const assets = profile?.assets || {};

  // Life insurance: recommended if married with children
  if (profile?.personal?.maritalStatus === 'married' && !ins.hasLifeInsurance) {
    missing.push('life');
  }

  // Disability (אכ"ע): always recommended for employees
  if (!ins.hasDisabilityInsurance && !coveredTypes.has('disability')) {
    missing.push('disability');
  }

  // Apartment insurance: required if owns apartment
  if (assets.ownsApartment && !ins.hasApartmentInsurance) {
    missing.push('apartment');
  }

  // Health supplement: generally recommended
  if (!ins.hasHealthInsurance && !coveredTypes.has('health')) {
    missing.push('health_supplement');
  }

  const urgency =
    missing.includes('disability') || missing.includes('life') ? 'high'
    : missing.length > 0 ? 'medium'
    : 'low';

  return { missingTypes: missing, urgency };
}

// ── Document completeness rules ───────────────────────────────────────────────

/**
 * Check what document types are missing for a full analysis.
 * @param {string[]} uploadedCategories - list of document categories
 * @returns {{ missingCategories: string[], completenessScore: number }}
 */
function runDocumentCompletenessRules(uploadedCategories) {
  const required = ['payslip'];
  const recommended = ['pension', 'insurance'];
  const all = [...required, ...recommended];

  const uploaded = new Set(uploadedCategories || []);
  const missingRequired = required.filter((c) => !uploaded.has(c));
  const missingRecommended = recommended.filter((c) => !uploaded.has(c));

  const score = Math.round(
    (([...required, ...recommended].filter((c) => uploaded.has(c)).length) / all.length) * 100,
  );

  return {
    missingCategories: [...missingRequired, ...missingRecommended],
    missingRequired,
    missingRecommended,
    completenessScore: score,
  };
}

module.exports = {
  runSalaryAnomalyRules,
  runPensionContributionRules,
  runPensionGapRules,
  runInsuranceDuplicateRules,
  runMissingCoverageRules,
  runDocumentCompletenessRules,
};
