import { apiJson, type ApiErrorPayload } from "./client";

export type SalaryType = "global" | "hourly";
export type MaritalStatus =
  | "single"
  | "married"
  | "divorced"
  | "widowed"
  | "partnered";
export type SalaryRange =
  | "under_5k"
  | "5k_10k"
  | "10k_15k"
  | "15k_20k"
  | "20k_30k"
  | "30k_50k"
  | "above_50k";
export type InvestmentType = "stocks" | "bonds" | "real_estate" | "crypto" | "other";

export type PersonalSection = {
  fullName: string | null;
  age: number | null;
  occupation: string | null;
  maritalStatus: MaritalStatus | null;
  childrenCount: number | null;
};

export type FinancialSection = {
  salaryRange: SalaryRange | null;
  monthlyExpensesEstimate: number | null;
  savingsEstimate: number | null;
};

export type AssetsSection = {
  ownsApartment: boolean | null;
  ownsCar: boolean | null;
  hasMortgage: boolean | null;
  mortgageMonthlyPayment: number | null;
};

export type InsuranceSection = {
  hasLifeInsurance: boolean | null;
  hasHealthInsurance: boolean | null;
  hasDisabilityInsurance: boolean | null;
  hasApartmentInsurance: boolean | null;
  hasCarInsurance: boolean | null;
};

export type RetirementSection = {
  hasPension: boolean | null;
  hasStudyFund: boolean | null;
  hasInvestmentFunds: boolean | null;
  investmentTypes: InvestmentType[];
};

export type EmploymentSection = {
  salaryType: SalaryType | null;
  expectedMonthlyGross: number | null;
  hourlyRate: number | null;
  expectedMonthlyHours: number | null;
  jobPercentage: number | null;
  isPrimaryJob: boolean | null;
  hasMultipleEmployers: boolean | null;
  employmentStartDate: string | null;
};

export type OnboardingProfile = {
  personal: PersonalSection;
  financial: FinancialSection;
  assets: AssetsSection;
  insurance: InsuranceSection;
  retirement: RetirementSection;
  employment: EmploymentSection;
};

export type OnboardingPatch = {
  personal?: Partial<PersonalSection>;
  financial?: Partial<FinancialSection>;
  assets?: Partial<AssetsSection>;
  insurance?: Partial<InsuranceSection>;
  retirement?: Partial<RetirementSection>;
  employment?: Partial<EmploymentSection>;
};

export type OnboardingResponseData = OnboardingProfile & {
  legacy?: Record<string, unknown>;
  completedSteps: string[];
  completedAt: string | null;
};

export type OnboardingResponse = {
  success: boolean;
  message?: string;
  errors?: Array<{ field?: string; message?: string }>;
  data?: {
    completed: boolean;
    completedAt: string | null;
    data: OnboardingResponseData;
  };
};

export const EMPTY_PROFILE: OnboardingProfile = {
  personal: {
    fullName: null,
    age: null,
    occupation: null,
    maritalStatus: null,
    childrenCount: null,
  },
  financial: {
    salaryRange: null,
    monthlyExpensesEstimate: null,
    savingsEstimate: null,
  },
  assets: {
    ownsApartment: null,
    ownsCar: null,
    hasMortgage: null,
    mortgageMonthlyPayment: null,
  },
  insurance: {
    hasLifeInsurance: null,
    hasHealthInsurance: null,
    hasDisabilityInsurance: null,
    hasApartmentInsurance: null,
    hasCarInsurance: null,
  },
  retirement: {
    hasPension: null,
    hasStudyFund: null,
    hasInvestmentFunds: null,
    investmentTypes: [],
  },
  employment: {
    salaryType: null,
    expectedMonthlyGross: null,
    hourlyRate: null,
    expectedMonthlyHours: null,
    jobPercentage: null,
    isPrimaryJob: null,
    hasMultipleEmployers: null,
    employmentStartDate: null,
  },
};

const extractErrors = (payload: ApiErrorPayload | null) =>
  (payload && Array.isArray(payload.errors) ? payload.errors : undefined) as
    | OnboardingResponse["errors"]
    | undefined;

export async function getOnboarding(): Promise<OnboardingResponse> {
  const result = await apiJson<OnboardingResponse>("/api/onboarding", {
    auth: true,
    fallbackErrorMessage: "לא הצלחנו לטעון את נתוני ה-onboarding.",
  });
  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      errors: extractErrors(payload),
    };
  }
  return result.data ?? { success: false, message: "תגובה לא תקינה." };
}

export async function updateOnboarding(
  data: OnboardingPatch,
  completedSteps?: string[],
): Promise<OnboardingResponse> {
  const body: { data: OnboardingPatch; completedSteps?: string[] } = { data };
  if (completedSteps) {
    body.completedSteps = completedSteps;
  }
  const result = await apiJson<OnboardingResponse>("/api/onboarding", {
    method: "PUT",
    auth: true,
    body,
    fallbackErrorMessage: "לא הצלחנו לשמור את נתוני ה-onboarding.",
  });
  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      errors: extractErrors(payload),
    };
  }
  return result.data ?? { success: false, message: "תגובה לא תקינה." };
}

export async function completeOnboarding(data?: OnboardingPatch): Promise<OnboardingResponse> {
  const result = await apiJson<OnboardingResponse>("/api/onboarding/complete", {
    method: "POST",
    auth: true,
    body: data ? { data } : {},
    fallbackErrorMessage: "לא הצלחנו להשלים את ה-onboarding.",
  });
  if (!result.ok) {
    const payload = result.error.payload as ApiErrorPayload | null;
    return {
      success: false,
      message: result.error.message,
      errors: extractErrors(payload),
    };
  }
  return result.data ?? { success: false, message: "תגובה לא תקינה." };
}

/**
 * Backwards-compatible flat onboarding shape for older callers that have not
 * yet migrated to the sectioned profile.
 */
export type OnboardingData = {
  salaryType: SalaryType | null;
  expectedMonthlyGross: number | null;
  hourlyRate: number | null;
  expectedMonthlyHours: number | null;
  jobPercentage: number | null;
  isPrimaryJob: boolean | null;
  hasMultipleEmployers: boolean | null;
  employmentStartDate: string | null;
  hasPension: boolean | null;
  hasStudyFund: boolean | null;
};
