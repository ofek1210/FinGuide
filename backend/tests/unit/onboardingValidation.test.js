const {
  validateDraft,
  validateComplete,
  normalizeLegacyPatch,
  mergeProfilePatch,
} = require('../../utils/onboardingValidation');
const { ValidationError } = require('../../utils/appErrors');

describe('onboardingValidation', () => {
  describe('validateDraft', () => {
    it('accepts an empty patch', () => {
      expect(() => validateDraft({})).not.toThrow();
    });

    it('accepts partial nested patches', () => {
      expect(() => validateDraft({ personal: { age: 30 } })).not.toThrow();
      expect(() => validateDraft({ assets: { ownsCar: true } })).not.toThrow();
    });

    it('rejects non-object patch', () => {
      expect(() => validateDraft(null)).toThrow(ValidationError);
      expect(() => validateDraft('hello')).toThrow(ValidationError);
    });

    it('rejects when a section is not an object', () => {
      expect(() => validateDraft({ personal: 'not-an-object' })).toThrow(ValidationError);
    });

    it('rejects out-of-range numeric fields', () => {
      expect(() => validateDraft({ personal: { age: 5 } })).toThrow(ValidationError);
      expect(() => validateDraft({ personal: { age: 200 } })).toThrow(ValidationError);
      expect(() =>
        validateDraft({ employment: { expectedMonthlyGross: -10 } }),
      ).toThrow(ValidationError);
    });

    it('rejects non-boolean booleans', () => {
      expect(() => validateDraft({ assets: { ownsCar: 'yes' } })).toThrow(ValidationError);
    });

    it('rejects invalid enum values', () => {
      expect(() => validateDraft({ personal: { maritalStatus: 'cohabiting' } })).toThrow(
        ValidationError,
      );
      expect(() => validateDraft({ employment: { salaryType: 'monthly' } })).toThrow(
        ValidationError,
      );
    });

    it('accepts valid enum values', () => {
      expect(() => validateDraft({ personal: { maritalStatus: 'married' } })).not.toThrow();
      expect(() => validateDraft({ employment: { salaryType: 'global' } })).not.toThrow();
    });

    it('validates investment types array', () => {
      expect(() =>
        validateDraft({ retirement: { investmentTypes: ['stocks', 'crypto'] } }),
      ).not.toThrow();
      expect(() =>
        validateDraft({ retirement: { investmentTypes: ['stocks', 'unknown'] } }),
      ).toThrow(ValidationError);
      expect(() =>
        validateDraft({ retirement: { investmentTypes: 'stocks' } }),
      ).toThrow(ValidationError);
    });

    it('validates date strings', () => {
      expect(() =>
        validateDraft({ employment: { employmentStartDate: '2024-01-15' } }),
      ).not.toThrow();
      expect(() =>
        validateDraft({ employment: { employmentStartDate: '15/01/2024' } }),
      ).toThrow(ValidationError);
    });
  });

  describe('validateComplete', () => {
    const baseValidProfile = {
      personal: { age: 30, maritalStatus: 'married' },
      employment: {
        salaryType: 'global',
        expectedMonthlyGross: 20000,
        jobPercentage: 100,
        isPrimaryJob: true,
        employmentStartDate: '2020-01-01',
        hasMultipleEmployers: false,
      },
      retirement: { hasPension: true, hasStudyFund: true },
    };

    it('passes for a valid complete profile', () => {
      expect(() => validateComplete(baseValidProfile)).not.toThrow();
    });

    it('fails when personal.age is missing', () => {
      const profile = { ...baseValidProfile, personal: { maritalStatus: 'married' } };
      expect(() => validateComplete(profile)).toThrow(ValidationError);
    });

    it('fails when employment.salaryType is missing', () => {
      const profile = {
        ...baseValidProfile,
        employment: { ...baseValidProfile.employment, salaryType: null },
      };
      expect(() => validateComplete(profile)).toThrow(ValidationError);
    });

    it('requires expectedMonthlyGross for global salaryType', () => {
      const profile = {
        ...baseValidProfile,
        employment: { ...baseValidProfile.employment, expectedMonthlyGross: null },
      };
      expect(() => validateComplete(profile)).toThrow(ValidationError);
    });

    it('requires hourlyRate and expectedMonthlyHours for hourly salaryType', () => {
      const profile = {
        ...baseValidProfile,
        employment: {
          ...baseValidProfile.employment,
          salaryType: 'hourly',
          expectedMonthlyGross: null,
        },
      };
      expect(() => validateComplete(profile)).toThrow(ValidationError);

      const fixed = {
        ...profile,
        employment: {
          ...profile.employment,
          hourlyRate: 80,
          expectedMonthlyHours: 180,
        },
      };
      expect(() => validateComplete(fixed)).not.toThrow();
    });

    it('fails when retirement fields are missing', () => {
      const profile = { ...baseValidProfile, retirement: { hasPension: true } };
      expect(() => validateComplete(profile)).toThrow(ValidationError);
    });
  });

  describe('normalizeLegacyPatch', () => {
    it('converts a legacy flat payload into sectioned shape', () => {
      const input = {
        salaryType: 'global',
        expectedMonthlyGross: 20000,
        hasPension: true,
        hasStudyFund: false,
      };
      expect(normalizeLegacyPatch(input)).toEqual({
        employment: {
          salaryType: 'global',
          expectedMonthlyGross: 20000,
        },
        retirement: {
          hasPension: true,
          hasStudyFund: false,
        },
      });
    });

    it('returns sectioned payloads untouched', () => {
      const input = { personal: { age: 30 } };
      expect(normalizeLegacyPatch(input)).toBe(input);
    });

    it('handles null gracefully', () => {
      expect(normalizeLegacyPatch(null)).toBeNull();
      expect(normalizeLegacyPatch(undefined)).toBeUndefined();
    });
  });

  describe('mergeProfilePatch', () => {
    it('merges per-section without losing other sections', () => {
      const profile = {
        personal: { age: 30, maritalStatus: 'single' },
        assets: { ownsCar: true },
      };
      mergeProfilePatch(profile, { personal: { age: 31 }, insurance: { hasCarInsurance: true } });
      expect(profile.personal.age).toBe(31);
      expect(profile.personal.maritalStatus).toBe('single');
      expect(profile.assets.ownsCar).toBe(true);
      expect(profile.insurance.hasCarInsurance).toBe(true);
    });
  });
});
