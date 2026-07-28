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

  it('asks only smoking, activity, conditions and life-insurance need', () => {
    const questions = filterQuestions(buildQuestionBank(), emptyProfile, emptyProfile.insuranceOnboarding);

    expect(questions.map(q => q.id)).toEqual([
      'health.smoker',
      'health.activity',
      'health.conditions',
      'life.needs_life_insurance',
    ]);
  });

  it('asks how many vehicles are owned only when the report shows car policies', () => {
    const withCar = filterQuestions(
      buildQuestionBank({ hasCar: true }),
      emptyProfile,
      emptyProfile.insuranceOnboarding,
    );
    const vehicleQuestion = withCar.find(q => q.id === 'vehicle.vehicles_owned');

    expect(vehicleQuestion).toBeDefined();
    expect(vehicleQuestion.type).toBe('number');
    expect(vehicleQuestion.profilePath).toBe('insuranceOnboarding.vehicle.vehiclesOwned');
    expect(buildQuestionBank({ hasCar: false }).some(q => q.id === 'vehicle.vehicles_owned')).toBe(false);
  });

  it('does not ask about vehicles again once the count was answered', () => {
    const onboarding = { answers: { 'insuranceOnboarding.vehicle.vehiclesOwned': 2 }, skippedIds: [] };
    const questions = filterQuestions(buildQuestionBank({ hasCar: true }), emptyProfile, onboarding);

    expect(questions.some(q => q.id === 'vehicle.vehicles_owned')).toBe(false);
  });

  it('explains what life insurance is on the life-need question', () => {
    const lifeQuestion = buildQuestionBank().find(q => q.id === 'life.needs_life_insurance');

    expect(lifeQuestion.text).toBe('האם אתה זקוק לביטוח חיים?');
    expect(lifeQuestion.why).toContain('תלוי בו כלכלית');
    expect(lifeQuestion.why).toContain('משכנתא');
  });

  it('does not ask about smoking when the profile already knows it', () => {
    const profile = { ...emptyProfile, personal: { isSmoker: false } };
    const questions = filterQuestions(buildQuestionBank(), profile, profile.insuranceOnboarding);

    expect(questions.some(q => q.id === 'health.smoker')).toBe(false);
  });

  it('does not ask a skipped question again', () => {
    const onboarding = { answers: {}, skippedIds: ['health.conditions'] };
    const questions = filterQuestions(buildQuestionBank(), emptyProfile, onboarding);

    expect(questions.some(q => q.id === 'health.conditions')).toBe(false);
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
        answers: { 'personal.isSmoker': true, _answeredIds: ['health.smoker'] },
        skippedIds: ['health.conditions'],
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
