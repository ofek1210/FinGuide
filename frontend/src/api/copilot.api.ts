import { apiJson } from "./client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RiskTolerance = "low" | "medium" | "high";

export interface BudgetBreakdown {
  fixed: { amount: number; pct: number };
  discretionary: { amount: number; pct: number };
  savings: { amount: number; pct: number };
}

export interface BudgetAnalysis {
  available: boolean;
  reason?: string;
  netSalary?: number;
  grossSalary?: number;
  breakdown?: BudgetBreakdown;
  health?: { status: string; label: string; color: string };
  ideal?: { needs: number; wants: number; savings: number };
  monthlyFreeFlow?: number;
  savingsRate?: string;
  recommendations?: Array<{
    type: string;
    priority: string;
    title: string;
    description: string;
    impact: number | null;
  }>;
}

export interface InvestmentAllocation {
  category: string;
  pct: number;
}

export interface InvestmentRecs {
  riskProfile: RiskTolerance;
  riskLabel: string;
  allocation: InvestmentAllocation[];
  expectedAnnualReturn: string;
  suggestions: Array<{ title: string; description: string; priority: string }>;
  recommendedMonthlyInvestment: number;
  disposableMonthly: number | null;
  projections: Array<{ years: number; projected: number }>;
}

export interface CopilotGoal {
  id: string;
  type: string;
  label: string;
  targetAmount: number | null;
  currentAmount: number;
  targetDate?: string;
  priority: number;
  progressPct: number;
}

export interface CopilotProfile {
  riskTolerance: RiskTolerance | null;
  monthlyExpenses: number | null;
  monthlyDebts: number | null;
  savings: number | null;
}

export interface CopilotAnalysis {
  profile: CopilotProfile;
  payslip: {
    grossSalary: number | null;
    netSalary: number | null;
  } | null;
  budgetAnalysis: BudgetAnalysis;
  investmentRecs: InvestmentRecs;
  healthScore: {
    score: number;
    label: string;
    level: string;
    categories?: unknown[];
  } | null;
  insights: Array<{ title: string; description: string; type: string }>;
  goals: CopilotGoal[];
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const getCopilotAnalysis = () =>
  apiJson<{ success: boolean; data: CopilotAnalysis }>("/api/copilot/analysis", { auth: true });

export const updateCopilotProfile = (body: Partial<{
  riskTolerance: RiskTolerance;
  monthlyExpenses: number;
  monthlyDebts: number;
  savings: number;
}>) =>
  apiJson<{ success: boolean }>("/api/copilot/profile", {
    method: "PUT",
    auth: true,
    body: JSON.stringify(body),
  });

export const upsertGoal = (body: {
  id?: string;
  type?: string;
  label?: string;
  targetAmount?: number;
  currentAmount?: number;
  targetDate?: string;
  priority?: number;
}) =>
  apiJson<{ success: boolean; goals: CopilotGoal[] }>("/api/copilot/goals", {
    method: body.id ? "PUT" : "POST",
    auth: true,
    body: JSON.stringify(body),
  });

export const deleteGoal = (id: string) =>
  apiJson<{ success: boolean }>(`/api/copilot/goals/${id}`, {
    method: "DELETE",
    auth: true,
  });

export const generateMonthlyReport = () =>
  apiJson<{ success: boolean; data: { report: string; source: string; generatedAt?: string } }>(
    "/api/copilot/monthly-report",
    { method: "POST", auth: true },
  );

// ── Financial Problems & AI Fix Plans ─────────────────────────────────────────

export interface FinancialProblem {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  impact: string;
  category: string;
}

export interface AIFixPlan {
  problemId: string;
  steps: string[];
  timeframe: string;
  expectedResult: string;
}

export const getFinancialProblems = () =>
  apiJson<{ success: boolean; data: { problems: FinancialProblem[]; aiFixPlans: AIFixPlan[] | null } }>(
    "/api/copilot/problems",
    { auth: true },
  );
