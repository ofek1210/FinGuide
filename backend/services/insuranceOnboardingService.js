'use strict';

const InsurancePolicy = require('../models/InsurancePolicy');
const UserProfile = require('../models/UserProfile');
const { buildInsuranceAnalysis } = require('../services/insuranceImportService');
const { buildQuestionBank, filterQuestions } = require('./insuranceOnboardingQuestions');
const {
  compareUserPolicies,
  getSourceMetadata,
  getPricingDisclaimer,
} = require('./insurancePricingDatasetService');

const AGENT_LABELS = {
  general: 'ביטוח כללי',
  life: 'ביטוח חיים',
  health: 'ביטוח בריאות',
};

function activeByType(policies) {
  const active = policies.filter(p => p.status === 'active');
  const byType = {};
  for (const p of active) {
    byType[p.type] = (byType[p.type] || 0) + 1;
  }
  return { active, byType };
}

function buildReportProfile(policies) {
  const { active, byType } = activeByType(policies);
  const companies = [...new Set(active.map(p => p.provider).filter(Boolean))];
  const totalMonthlyPremium = active.reduce((s, p) => s + (p.monthlyPremium || 0), 0);

  return {
    policyCount: active.length,
    companies,
    byType,
    totalMonthlyPremium,
    hasApartment: (byType.apartment || 0) > 0,
    hasCar: (byType.car || 0) > 0,
    hasLife: (byType.life || 0) > 0,
    hasHealth: (byType.health || 0) > 0,
    hasDisability: (byType.disability || 0) > 0,
    policies: active.map(p => ({
      type: p.type,
      provider: p.provider,
      policyNumber: p.policyNumber,
      monthlyPremium: p.monthlyPremium,
      annualPremium: p.annualPremium,
      status: p.status,
      startDate: p.startDate,
      endDate: p.endDate,
    })),
  };
}

function setNestedAnswer(profile, path, value) {
  if (!path) return;
  if (path.startsWith('assets.')) {
    profile.assets = profile.assets || {};
    profile.assets[path.slice(7)] = value;
    profile.markModified('assets');
    return;
  }
  if (path.startsWith('personal.')) {
    profile.personal = profile.personal || {};
    profile.personal[path.slice(9)] = value;
    profile.markModified('personal');
    return;
  }
  if (path.startsWith('financial.')) {
    profile.financial = profile.financial || {};
    profile.financial[path.slice(10)] = value;
    profile.markModified('financial');
    return;
  }
  if (path.startsWith('insuranceOnboarding.')) {
    profile.insuranceOnboarding = profile.insuranceOnboarding || { answers: {}, skippedIds: [] };
    profile.insuranceOnboarding.answers = profile.insuranceOnboarding.answers || {};
    const key = path.slice('insuranceOnboarding.'.length);
    profile.insuranceOnboarding.answers[key] = value;
    profile.markModified('insuranceOnboarding');
  }
}

async function loadContext(userId) {
  const [policies, profile] = await Promise.all([
    InsurancePolicy.find({ user: userId }).lean(),
    UserProfile.findOrCreateForUser(userId),
  ]);
  const report = buildReportProfile(policies);
  return { policies, profile, report };
}

async function getSession(userId) {
  const { profile, report } = await loadContext(userId);

  if (report.policyCount === 0) {
    return {
      ready: false,
      message: 'יש להעלות דוח מהר הביטוח לפני תחילת האונבורדינג',
      reportProfile: report,
      questions: [],
      completed: false,
    };
  }

  const onboarding = profile.insuranceOnboarding || {};
  const ctx = {
    hasApartment: report.hasApartment,
    hasCar: report.hasCar,
    hasLife: report.hasLife,
    hasHealth: report.hasHealth,
    hasDisability: report.hasDisability,
  };

  const bank = buildQuestionBank(ctx);
  const questions = filterQuestions(bank, profile, onboarding, ctx);
  const answered = (onboarding.answers?._answeredIds || []).length + (onboarding.skippedIds || []).length;
  const completed = Boolean(onboarding.completedAt);

  return {
    ready: true,
    reportProfile: report,
    agentLabels: AGENT_LABELS,
    questions,
    progress: {
      answered,
      total: answered + questions.length,
      percent: questions.length === 0 ? 100 : Math.round((answered / (answered + questions.length)) * 100),
    },
    completed,
    currentQuestion: questions[0] || null,
  };
}

async function submitAnswer(userId, { questionId, value, skipped = false }) {
  const { profile, report } = await loadContext(userId);
  profile.insuranceOnboarding = profile.insuranceOnboarding || { answers: {}, skippedIds: [] };

  const ctx = {
    hasApartment: report.hasApartment,
    hasCar: report.hasCar,
    hasLife: report.hasLife,
    hasHealth: report.hasHealth,
    hasDisability: report.hasDisability,
  };
  const bank = buildQuestionBank(ctx);
  const question = bank.find(q => q.id === questionId);
  if (!question) {
    const err = new Error('שאלה לא נמצאה');
    err.statusCode = 404;
    throw err;
  }

  if (skipped) {
    if (!profile.insuranceOnboarding.skippedIds.includes(questionId)) {
      profile.insuranceOnboarding.skippedIds.push(questionId);
    }
  } else if (question.type === 'info') {
    profile.insuranceOnboarding.answers = profile.insuranceOnboarding.answers || {};
    profile.insuranceOnboarding.answers[questionId] = true;
  } else if (question.profilePath) {
    setNestedAnswer(profile, question.profilePath, value);
    profile.insuranceOnboarding.answers = profile.insuranceOnboarding.answers || {};
    profile.insuranceOnboarding.answers[question.profilePath] = value;
  } else {
    profile.insuranceOnboarding.answers = profile.insuranceOnboarding.answers || {};
    profile.insuranceOnboarding.answers[questionId] = value;
  }

  profile.insuranceOnboarding.answers._answeredIds = profile.insuranceOnboarding.answers._answeredIds || [];
  if (!profile.insuranceOnboarding.answers._answeredIds.includes(questionId)) {
    profile.insuranceOnboarding.answers._answeredIds.push(questionId);
  }
  profile.insuranceOnboarding.lastReportAt = new Date();

  if (!profile.completedSteps.includes('insurance_onboarding')) {
    profile.completedSteps.push('insurance_onboarding_progress');
  }
  profile.markModified('insuranceOnboarding');
  profile.markModified('completedSteps');
  await profile.save();

  return getSession(userId);
}

async function completeOnboarding(userId) {
  const { profile } = await loadContext(userId);
  profile.insuranceOnboarding = profile.insuranceOnboarding || {};
  profile.insuranceOnboarding.completedAt = new Date();
  if (!profile.completedSteps.includes('insurance_onboarding')) {
    profile.completedSteps.push('insurance_onboarding');
  }
  profile.markModified('insuranceOnboarding');
  profile.markModified('completedSteps');
  await profile.save();

  const analysis = await buildInsuranceAnalysis(userId);
  const onboardingAnalysis = buildOnboardingAnalysis(analysis, profile);

  return {
    session: await getSession(userId),
    analysis: onboardingAnalysis,
  };
}

function buildOnboardingAnalysis(baseAnalysis, profile) {
  const a = baseAnalysis?.analysis || {};
  const premium = baseAnalysis?.summary?.totalMonthlyPremium ?? 0;
  const policies = baseAnalysis?.policies ?? [];
  const profileDTO = {
    personal: baseAnalysis?.personal,
    financial: profile.financial,
    employment: profile.employment,
  };
  const pricingComparisons = compareUserPolicies(policies, profileDTO);
  const premiumAssessment = aggregatePremiumAssessment(
    pricingComparisons,
    premium,
    profile.financial?.salaryRange,
  );

  const fairTotalAvg = pricingComparisons.reduce(
    (s, c) => s + (c.fairRange?.average || 0),
    0,
  );
  const fairTotalMin = pricingComparisons.reduce(
    (s, c) => s + (c.fairRange?.min || 0),
    0,
  );
  const fairTotalMax = pricingComparisons.reduce(
    (s, c) => s + (c.fairRange?.max || 0),
    0,
  );

  return {
    summary: {
      existingPolicies: policies.length,
      missingPolicies: a.missingCoverage ?? [],
      duplicatePolicies: a.duplicates ?? [],
      outdatedFlags: (a.flags ?? []).filter(f => f.code?.includes('expired') || f.code?.includes('stale')),
    },
    financial: {
      totalMonthlyPremium: premium,
      premiumAssessment,
      fairPriceRange: {
        min: fairTotalMin,
        average: fairTotalAvg,
        max: fairTotalMax,
        currency: 'ILS',
      },
      monthlyDeltaVsFairAvg: premium && fairTotalAvg ? Math.round(premium - fairTotalAvg) : null,
      pricingComparisons,
      potentialMonthlySavings: a.savings?.totalSavings ?? 0,
      unnecessaryCoverages: (a.flags ?? []).filter(f => f.code === 'over_insured'),
    },
    risk: {
      underinsured: (a.missingCoverage ?? []).map(type => ({ area: type, severity: a.missingUrgency || 'medium' })),
      overinsured: (a.flags ?? []).filter(f => f.urgency === 'low'),
      hasCriticalGap: a.hasCriticalGap ?? false,
    },
    recommendations: baseAnalysis?.recommendations ?? [],
    healthCheck: baseAnalysis?.healthCheck ?? null,
    pricingSource: getSourceMetadata(),
    disclaimer: getPricingDisclaimer().he,
    disclaimerEn: getPricingDisclaimer().en,
  };
}

function aggregatePremiumAssessment(comparisons, totalPremium, salaryRange) {
  if (!comparisons.length) return assessPremiumBySalaryRatio(totalPremium, salaryRange);
  const rank = { unknown: 0, low: 1, normal: 2, high: 3, very_high: 4 };
  const worst = comparisons.reduce(
    (max, c) => (rank[c.assessment] > rank[max] ? c.assessment : max),
    'unknown',
  );
  return worst === 'unknown' ? assessPremiumBySalaryRatio(totalPremium, salaryRange) : worst;
}

function assessPremiumBySalaryRatio(monthlyPremium, salaryRange) {
  const mid = {
    under_5k: 4000,
    '5k_10k': 7500,
    '10k_15k': 12500,
    '15k_20k': 17500,
    '20k_30k': 25000,
    '30k_50k': 40000,
    above_50k: 60000,
  };
  const salary = salaryRange ? mid[salaryRange] : null;
  if (!salary || !monthlyPremium) return 'unknown';
  const ratio = monthlyPremium / salary;
  if (ratio < 0.05) return 'low';
  if (ratio < 0.12) return 'normal';
  return 'high';
}

/** Call after Har HaBituach import — resets onboarding if new report. */
async function markReportImported(userId) {
  const profile = await UserProfile.findOrCreateForUser(userId);
  profile.insuranceOnboarding = profile.insuranceOnboarding || { answers: {}, skippedIds: [] };
  profile.insuranceOnboarding.lastReportAt = new Date();
  profile.insuranceOnboarding.completedAt = null;
  profile.markModified('insuranceOnboarding');
  await profile.save();
}

module.exports = {
  getSession,
  submitAnswer,
  completeOnboarding,
  markReportImported,
  buildReportProfile,
  buildOnboardingAnalysis,
};
