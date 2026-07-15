'use strict';

const { buildQuestionBank, filterQuestions } = require('../../services/insuranceOnboardingQuestions');
const { buildReportProfile } = require('../../services/insuranceOnboardingService');

describe('insuranceOnboardingQuestions', () => {
  const emptyProfile = {
    personal: {},
    assets: {},
    financial: {},
    insuranceOnboarding: { answers: {}, skippedIds: [] },
  };

  it('does not ask home ownership when apartment policy exists in report', () => {
    const ctx = { hasApartment: true, hasCar: false, hasLife: false, hasHealth: false, hasDisability: false };
    const bank = buildQuestionBank(ctx);
    const questions = filterQuestions(bank, emptyProfile, emptyProfile.insuranceOnboarding, ctx);
    expect(questions.some(q => q.id === 'home.owns_home')).toBe(false);
    expect(questions.some(q => q.id === 'home.primary_residence')).toBe(true);
  });

  it('asks vehicle ownership when no car policy in report', () => {
    const ctx = { hasApartment: false, hasCar: false, hasLife: true, hasHealth: true, hasDisability: false };
    const bank = buildQuestionBank(ctx);
    const questions = filterQuestions(bank, emptyProfile, emptyProfile.insuranceOnboarding, ctx);
    expect(questions.some(q => q.id === 'vehicle.owns')).toBe(true);
    expect(questions.some(q => q.id === 'life.explain')).toBe(false);
  });

  it('does not ask a skipped question again', () => {
    const ctx = { hasApartment: false, hasCar: false, hasLife: false, hasHealth: false, hasDisability: false };
    const bank = buildQuestionBank(ctx);
    const onboarding = { answers: {}, skippedIds: ['home.owns_home'] };
    const questions = filterQuestions(bank, emptyProfile, onboarding, ctx);

    expect(questions.some(q => q.id === 'home.owns_home')).toBe(false);
  });

  it('buildReportProfile aggregates active policies', () => {
    const report = buildReportProfile([
      { type: 'health', provider: 'כלל', monthlyPremium: 200, status: 'active' },
      { type: 'life', provider: 'הפניקס', monthlyPremium: 150, status: 'active' },
      { type: 'car', provider: 'מגדל', monthlyPremium: 300, status: 'expired' },
    ]);
    expect(report.policyCount).toBe(2);
    expect(report.hasHealth).toBe(true);
    expect(report.hasCar).toBe(false);
    expect(report.totalMonthlyPremium).toBe(350);
  });
});

describe('insuranceOnboardingService resetOnboarding', () => {
  it('clears completed onboarding state', async () => {
    const { resetOnboarding } = require('../../services/insuranceOnboardingService');
    const UserProfile = require('../../models/UserProfile');

    const save = jest.fn();
    const markModified = jest.fn();
    UserProfile.findOrCreateForUser = jest.fn().mockResolvedValue({
      insuranceOnboarding: {
        answers: { 'home.owns_home': true, _answeredIds: ['home.owns_home'] },
        skippedIds: ['vehicle.owns'],
        completedAt: new Date('2024-01-01'),
        lastReportAt: new Date('2024-01-01'),
      },
      markModified,
      save,
    });

    await resetOnboarding('user123');

    expect(save).toHaveBeenCalled();
    expect(markModified).toHaveBeenCalledWith('insuranceOnboarding');
    const profile = await UserProfile.findOrCreateForUser.mock.results[0].value;
    expect(profile.insuranceOnboarding).toEqual({ answers: {}, skippedIds: [] });
  });
});
