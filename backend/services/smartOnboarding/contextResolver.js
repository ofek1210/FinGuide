'use strict';

const Document = require('../../models/Document');
const PensionFund = require('../../models/PensionFund');
const InsurancePolicy = require('../../models/InsurancePolicy');
const { getNested, readStoredAnswer } = require('./answerStore');
const { GENERAL_QUESTIONS, AGENT_QUESTIONS } = require('../../config/smartOnboardingConfig');

function normalizeYesNo(val) {
  if (val === true || val === 'yes' || val === 'true' || val === 1) return true;
  if (val === false || val === 'no' || val === 'false' || val === 0) return false;
  return null;
}

function resolveFromProfile(profile, questionDef) {
  const stored = readStoredAnswer(profile, questionDef.layer || 'general', questionDef.id);
  if (stored?.answer != null) {
    return { value: stored.answer, source: stored.source || 'onboarding', confidence: stored.confidence ?? 1 };
  }

  if (questionDef.profilePath) {
    let val = getNested(profile.toObject ? profile.toObject() : profile, questionDef.profilePath);
    if (val != null && val !== '') {
      return { value: val, source: 'onboarding', confidence: 0.95 };
    }
  }

  return null;
}

function resolveGeneralQuestion(profile, questionDef) {
  const fromProfile = resolveFromProfile(profile, questionDef);

  if (questionDef.id === 'general.hasChildren' && fromProfile == null) {
    const count = profile.personal?.childrenCount;
    if (count != null) {
      return { value: count > 0, source: 'onboarding', confidence: 0.9 };
    }
  }

  if (questionDef.id === 'general.employmentStatus' && fromProfile == null) {
    const t = profile.employment?.employmentType;
    if (t === 'employee' || t === 'self_employed') {
      return { value: t, source: 'onboarding', confidence: 0.9 };
    }
    if (t === 'both') return { value: 'both', source: 'onboarding', confidence: 0.9 };
  }

  if (questionDef.id === 'general.financialGoals' && fromProfile == null) {
    const goals = profile.financial?.financialGoals;
    if (Array.isArray(goals) && goals.length) {
      return { value: goals, source: 'onboarding', confidence: 0.9 };
    }
  }

  return fromProfile;
}

async function resolveFromDocuments(userId, questionId) {
  if (questionId === 'payslip.hasVariablePay') {
    const docs = await Document.find({ user: userId, status: 'completed' }).limit(6).lean();
    for (const doc of docs) {
      const salary = doc.analysisData?.salary;
      if (!salary) continue;
      const hasBonus = (salary.bonus || salary.overtime || salary.commissions) > 0;
      if (hasBonus) return { value: true, source: 'uploaded_document', confidence: 0.85 };
    }
  }
  if (questionId === 'payslip.hasCompanyCar') {
    const docs = await Document.find({ user: userId, status: 'completed' }).limit(3).lean();
    for (const doc of docs) {
      const benefits = doc.analysisData?.employment?.benefits || doc.analysisData?.deductions?.items || [];
      const text = JSON.stringify(benefits).toLowerCase();
      if (/רכב|car|lease/.test(text)) {
        return { value: true, source: 'uploaded_document', confidence: 0.8 };
      }
    }
  }
  if (questionId === 'payslip.onlyEmployer') {
    const docs = await Document.find({ user: userId, status: 'completed' }).lean();
    const employers = new Set(
      docs.map(d => d.analysisData?.parties?.employer_name || d.analysisData?.employment?.employer).filter(Boolean),
    );
    if (employers.size === 1) return { value: true, source: 'uploaded_document', confidence: 0.75 };
    if (employers.size > 1) return { value: false, source: 'uploaded_document', confidence: 0.75 };
  }
  return null;
}

async function resolveFromExternalData(userId, profile, questionDef) {
  const qid = questionDef.id;

  if (qid === 'insurance.hasMortgage') {
    if (profile.assets?.hasMortgage != null) {
      return { value: profile.assets.hasMortgage, source: 'onboarding', confidence: 0.95 };
    }
  }

  if (qid === 'insurance.hasDependents') {
    if (profile.personal?.hasDependents != null) {
      return { value: profile.personal.hasDependents, source: 'onboarding', confidence: 0.95 };
    }
    const children = profile.personal?.childrenCount;
    if (children != null && children > 0) {
      return { value: true, source: 'inferred', confidence: 0.7 };
    }
    if (['married', 'partnered'].includes(profile.personal?.maritalStatus)) {
      return { value: true, source: 'inferred', confidence: 0.55 };
    }
  }

  if (qid === 'pension.retirementAge') {
    const age = profile.retirement?.plannedRetirementAge;
    if (age != null) return { value: age, source: 'onboarding', confidence: 0.95 };
  }

  if (qid === 'general.riskTolerance' && profile.financial?.riskTolerance) {
    return { value: profile.financial.riskTolerance, source: 'onboarding', confidence: 0.95 };
  }

  if (qid.startsWith('payslip.')) {
    return resolveFromDocuments(userId, qid);
  }

  if (qid.startsWith('gemel.') || qid.startsWith('pension.')) {
    const funds = await PensionFund.find({ user: userId }).limit(5).lean();
    if (funds.length && qid === 'gemel.moneyPurpose') {
      const hasStudy = funds.some(f => f.fundType === 'study_fund');
      if (hasStudy) return { value: 'general_savings', source: 'imported', confidence: 0.6 };
    }
  }

  if (qid.startsWith('insurance.')) {
    const policies = await InsurancePolicy.find({ user: userId, status: 'active' }).limit(1).lean();
    if (policies.length && qid === 'insurance.priority') {
      return { value: 'everything', source: 'imported', confidence: 0.5 };
    }
  }

  return null;
}

async function resolveQuestionAnswer(userId, profile, questionDef, layer = 'general') {
  if (layer === 'general') {
    return resolveGeneralQuestion(profile, questionDef);
  }

  const stored = readStoredAnswer(profile, layer, questionDef.id);
  if (stored?.answer != null) {
    return { value: stored.answer, source: stored.source || 'onboarding', confidence: stored.confidence ?? 1 };
  }

  const fromProfile = resolveFromProfile({ ...profile.toObject?.() || profile, layer }, questionDef);
  if (fromProfile) return fromProfile;

  return resolveFromExternalData(userId, profile, questionDef);
}

function isAnswered(resolved, questionDef) {
  if (!resolved || resolved.value == null) return false;
  if (questionDef.type === 'multi') return Array.isArray(resolved.value) && resolved.value.length > 0;
  if (questionDef.type === 'number') return Number.isFinite(Number(resolved.value));
  return String(resolved.value).trim() !== '';
}

async function buildKnownAnswersMap(userId, profile, layer) {
  const questions = layer === 'general'
    ? GENERAL_QUESTIONS
    : (AGENT_QUESTIONS[layer] || []);

  const known = {};
  for (const q of questions) {
    const resolved = await resolveQuestionAnswer(userId, profile, q, layer);
    if (isAnswered(resolved, q)) {
      known[q.id] = resolved;
    }
  }
  return known;
}

module.exports = {
  resolveQuestionAnswer,
  buildKnownAnswersMap,
  isAnswered,
  normalizeYesNo,
};
