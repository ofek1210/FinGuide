'use strict';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const UserProfile = require('../../models/UserProfile');
const User = require('../../models/User');
const {
  getState,
  saveAnswers,
  completeLayer,
  getContextForAgent,
} = require('../../services/smartOnboarding/smartOnboardingService');
const { buildKnownAnswersMap } = require('../../services/smartOnboarding/contextResolver');
const { GENERAL_QUESTIONS } = require('../../config/smartOnboardingConfig');

describe('smart onboarding engine', () => {
  let userId;
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });
  beforeEach(async () => {
    const user = await User.create({
      name: 'Smart Onboarding Test',
      email: `smart-onb-${Date.now()}@test.com`,
      password: 'Test123456',
    });
    userId = user._id;
  });

  afterEach(async () => {
    await UserProfile.deleteMany({});
    await User.deleteMany({ email: /smart-onb-/ });
  });

  it('returns all general questions for new user', async () => {
    const state = await getState(userId, 'general');
    expect(state.complete).toBe(false);
    expect(state.missingQuestions.length).toBe(GENERAL_QUESTIONS.length);
  });

  it('skips questions already in profile (duplicate prevention)', async () => {
    const profile = await UserProfile.findOrCreateForUser(userId);
    profile.personal = { age: 35, maritalStatus: 'married', hasChildren: true };
    profile.financial = {
      riskTolerance: 'medium',
      investmentExperience: 'beginner',
      financialGoals: ['reduce_fees'],
    };
    profile.employment = { employmentStatus: 'employee' };
    await profile.save();

    const state = await getState(userId, 'general');
    expect(state.missingQuestions.length).toBeLessThan(GENERAL_QUESTIONS.length);
    expect(state.missingQuestions.find(q => q.id === 'general.age')).toBeUndefined();
    expect(state.missingQuestions.find(q => q.id === 'general.riskTolerance')).toBeUndefined();
  });

  it('persists answers with metadata', async () => {
    await saveAnswers(userId, 'general', {
      'general.age': 42,
      'general.maritalStatus': 'single',
    });
    const profile = await UserProfile.findOne({ user: userId });
    expect(profile.personal.age).toBe(42);
    expect(profile.personal.maritalStatus).toBe('single');
    const stored = profile.smartOnboarding?.general?.answers;
    const entry = stored?.['general.age'];
    expect(entry?.source).toBe('user');
    expect(entry?.confidence).toBe(1);
  });

  it('completes general onboarding and sets user flag', async () => {
    await saveAnswers(userId, 'general', {
      'general.age': 30,
      'general.maritalStatus': 'married',
      'general.hasChildren': true,
      'general.employmentStatus': 'employee',
      'general.financialGoals': ['improve_retirement'],
      'general.investmentExperience': 'intermediate',
      'general.riskTolerance': 'medium',
    });
    await completeLayer(userId, 'general');
    const user = await User.findById(userId);
    expect(user.onboarding.completed).toBe(true);
    const state = await getState(userId, 'general');
    expect(state.complete).toBe(true);
  });

  it('returns only missing agent questions (partial onboarding)', async () => {
    const profile = await UserProfile.findOrCreateForUser(userId);
    profile.assets = { hasMortgage: true };
    profile.personal = { hasDependents: false };
    await profile.save();

    const state = await getState(userId, 'insurance');
    expect(state.missingQuestions.find(q => q.id === 'insurance.hasMortgage')).toBeUndefined();
    expect(state.missingQuestions.find(q => q.id === 'insurance.hasDependents')).toBeUndefined();
    expect(state.missingQuestions.length).toBeGreaterThan(0);
  });

  it('marks agent onboarding complete for returning user', async () => {
    await saveAnswers(userId, 'gemel', {
      'gemel.moneyPurpose': 'retirement',
      'gemel.liquidityHorizon': 'over_10_years',
      'gemel.returnVsStability': 'balance',
      'gemel.lossReaction': 'stay_invested',
      'gemel.wantAlternatives': true,
    });
    await completeLayer(userId, 'gemel');
    const state = await getState(userId, 'gemel');
    expect(state.complete).toBe(true);
    expect(state.missingQuestions).toHaveLength(0);
  });

  it('builds agent context from general + agent answers', async () => {
    await saveAnswers(userId, 'general', { 'general.riskTolerance': 'high' });
    await saveAnswers(userId, 'pension', { 'pension.priority': 'stability' });
    const ctx = await getContextForAgent(userId, 'pension');
    expect(ctx.general['general.riskTolerance']).toBe('high');
    expect(ctx.agent['pension.priority']).toBe('stability');
  });

  it('reuses existing answers without re-asking', async () => {
    const profile = await UserProfile.findOrCreateForUser(userId);
    profile.retirement = { plannedRetirementAge: 67 };
    await profile.save();
    const known = await buildKnownAnswersMap(userId, profile, 'pension');
    expect(known['pension.retirementAge']?.value).toBe(67);
  });
});
