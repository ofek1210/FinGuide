export type DomainRecommendationDTO = {
  type?: string;
  title: string;
  reason: string;
  urgency?: "high" | "medium" | "low" | string;
  financialImpact?: string | null;
  confidenceScore?: number | null;
};
