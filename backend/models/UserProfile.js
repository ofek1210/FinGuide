const mongoose = require('mongoose');

/**
 * UserProfile schema
 *
 * Stores the full onboarding answers plus any later edits from the Settings page.
 * Lives in its own collection so that the Insights/Recommendation engines (M2/M3)
 * can aggregate over it without bloating the User document.
 *
 * Completion flag still lives on `User.onboarding.completed` for backward
 * compatibility with the auth response and route guards. This model owns the
 * data itself.
 */

const STRING_ENUMS = {
  salaryType: ['global', 'hourly'],
  maritalStatus: ['single', 'married', 'divorced', 'widowed', 'partnered'],
  salaryRange: [
    'under_5k',
    '5k_10k',
    '10k_15k',
    '15k_20k',
    '20k_30k',
    '30k_50k',
    'above_50k',
  ],
  investmentType: ['stocks', 'bonds', 'real_estate', 'crypto', 'other'],
};

const personalSchema = new mongoose.Schema(
  {
    fullName: { type: String, default: null, trim: true, maxlength: 120 },
    age: { type: Number, default: null, min: 16, max: 120 },
    occupation: { type: String, default: null, trim: true, maxlength: 120 },
    maritalStatus: {
      type: String,
      enum: [...STRING_ENUMS.maritalStatus, null],
      default: null,
    },
    childrenCount: { type: Number, default: null, min: 0, max: 20 },
  },
  { _id: false }
);

const financialSchema = new mongoose.Schema(
  {
    salaryRange: {
      type: String,
      enum: [...STRING_ENUMS.salaryRange, null],
      default: null,
    },
    monthlyExpensesEstimate: { type: Number, default: null, min: 0, max: 1000000 },
    savingsEstimate: { type: Number, default: null, min: 0, max: 100000000 },
  },
  { _id: false }
);

const assetsSchema = new mongoose.Schema(
  {
    ownsApartment: { type: Boolean, default: null },
    ownsCar: { type: Boolean, default: null },
    hasMortgage: { type: Boolean, default: null },
    mortgageMonthlyPayment: { type: Number, default: null, min: 0, max: 500000 },
  },
  { _id: false }
);

const insuranceSchema = new mongoose.Schema(
  {
    hasLifeInsurance: { type: Boolean, default: null },
    hasHealthInsurance: { type: Boolean, default: null },
    hasDisabilityInsurance: { type: Boolean, default: null },
    hasApartmentInsurance: { type: Boolean, default: null },
    hasCarInsurance: { type: Boolean, default: null },
  },
  { _id: false }
);

const retirementSchema = new mongoose.Schema(
  {
    hasPension: { type: Boolean, default: null },
    hasStudyFund: { type: Boolean, default: null },
    hasInvestmentFunds: { type: Boolean, default: null },
    investmentTypes: {
      type: [String],
      default: [],
      validate: {
        validator(values) {
          return values.every(v => STRING_ENUMS.investmentType.includes(v));
        },
        message: 'Invalid investment type',
      },
    },
  },
  { _id: false }
);

const employmentSchema = new mongoose.Schema(
  {
    salaryType: {
      type: String,
      enum: [...STRING_ENUMS.salaryType, null],
      default: null,
    },
    expectedMonthlyGross: { type: Number, default: null, min: 0, max: 500000 },
    hourlyRate: { type: Number, default: null, min: 0, max: 5000 },
    expectedMonthlyHours: { type: Number, default: null, min: 0, max: 400 },
    jobPercentage: { type: Number, default: null, min: 0, max: 100 },
    isPrimaryJob: { type: Boolean, default: null },
    hasMultipleEmployers: { type: Boolean, default: null },
    employmentStartDate: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const userProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    personal: { type: personalSchema, default: () => ({}) },
    financial: { type: financialSchema, default: () => ({}) },
    assets: { type: assetsSchema, default: () => ({}) },
    insurance: { type: insuranceSchema, default: () => ({}) },
    retirement: { type: retirementSchema, default: () => ({}) },
    employment: { type: employmentSchema, default: () => ({}) },
    completedSteps: { type: [String], default: [] },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userProfileSchema.statics.STRING_ENUMS = STRING_ENUMS;

userProfileSchema.statics.findOrCreateForUser = async function findOrCreateForUser(userId) {
  let profile = await this.findOne({ user: userId });
  if (!profile) {
    profile = await this.create({ user: userId });
  }
  return profile;
};

/**
 * Flatten a profile into the legacy onboarding payload shape used by the
 * existing OnboardingPage and external clients that have not yet migrated.
 */
userProfileSchema.methods.toLegacyOnboardingData = function toLegacyOnboardingData() {
  const e = this.employment || {};
  const r = this.retirement || {};
  return {
    salaryType: e.salaryType ?? null,
    expectedMonthlyGross: e.expectedMonthlyGross ?? null,
    hourlyRate: e.hourlyRate ?? null,
    expectedMonthlyHours: e.expectedMonthlyHours ?? null,
    jobPercentage: e.jobPercentage ?? null,
    isPrimaryJob: e.isPrimaryJob ?? null,
    hasMultipleEmployers: e.hasMultipleEmployers ?? null,
    employmentStartDate: e.employmentStartDate ?? null,
    hasPension: r.hasPension ?? null,
    hasStudyFund: r.hasStudyFund ?? null,
  };
};

module.exports = mongoose.model('UserProfile', userProfileSchema);
