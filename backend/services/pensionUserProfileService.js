'use strict';

const UserProfile = require('../models/UserProfile');
const { resolveRetirementAge, recommendedRiskLevel } = require('../utils/pensionShared');

/**
 * Load merged user + onboarding context for pension analysis.
 * @param {string|import('mongoose').Types.ObjectId} userId
 * @param {object} [summary] — from getPensionSummary
 * @returns {Promise<object>}
 */
async function loadPensionUserContext(userId, summary = null) {
  const profile = await UserProfile.findOne({ user: userId }).lean();
  const personal = profile?.personal || {};
  const retirement = profile?.retirement || {};
  const financial = profile?.financial || {};
  const employment = profile?.employment || {};

  const age = summary?.currentAge ?? personal.age ?? null;
  const retirementAge = summary?.retirementAge
    ?? resolveRetirementAge({ retirement, retirementAge: retirement.plannedRetirementAge });

  const yearsToRetirement = age != null && retirementAge != null
    ? Math.max(0, retirementAge - age)
    : null;

  const riskFromOnboarding = financial.riskTolerance || null;
  const ageBasedRisk = recommendedRiskLevel(age, yearsToRetirement);

  return {
    userId,
    profile,
    personal: {
      age,
      fullName: personal.fullName || null,
      maritalStatus: personal.maritalStatus || null,
      childrenCount: personal.childrenCount ?? null,
      residenceCity: personal.residenceCity || null,
    },
    retirement: {
      plannedRetirementAge: retirementAge,
      yearsToRetirement,
      hasPension: retirement.hasPension ?? null,
      hasStudyFund: retirement.hasStudyFund ?? null,
    },
    employment: {
      status: employment.employmentStatus || employment.status || null,
      grossSalary: summary?.grossSalary ?? employment.grossSalary ?? null,
      pensionEmployeeRate: employment.pensionEmployeeRate ?? null,
      pensionEmployerRate: employment.pensionEmployerRate ?? null,
    },
    financial: {
      riskTolerance: riskFromOnboarding,
      salaryRange: financial.salaryRange || null,
      monthlyExpensesEstimate: financial.monthlyExpensesEstimate ?? null,
      savingsEstimate: financial.savingsEstimate ?? null,
    },
    risk: {
      fromOnboarding: riskFromOnboarding,
      fromAge: ageBasedRisk,
      effective: riskFromOnboarding || ageBasedRisk,
    },
    dataSources: [
      profile ? 'user_profile' : null,
      summary?.dataSource ? `pension_${summary.dataSource}` : null,
    ].filter(Boolean),
  };
}

module.exports = { loadPensionUserContext };
