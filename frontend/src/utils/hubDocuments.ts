import { APP_ROUTES } from "../types/navigation";

export const HUB_DOCUMENT_IDS = ["clearinghouse", "insurance", "payslips"] as const;
export type HubDocumentId = (typeof HUB_DOCUMENT_IDS)[number];

export function hubDocumentUrl(documentId: HubDocumentId): string {
  return `${APP_ROUTES.hub}?document=${documentId}`;
}

export function parseHubDocumentParam(value: string | null): HubDocumentId | null {
  if (!value) return null;
  return HUB_DOCUMENT_IDS.includes(value as HubDocumentId) ? (value as HubDocumentId) : null;
}

const PENSION_FUND_TYPES = new Set([
  "pension_comprehensive",
  "pension_old",
  "managers_insurance",
  "other",
]);
const GEMEL_FUND_TYPES = new Set(["study_fund", "provident_fund"]);

export type ClearinghouseUploadReadiness = {
  pensionReady: boolean;
  gemelReady: boolean;
  pensionInsuranceReady: boolean;
  pensionFundCount: number;
  gemelFundCount: number;
  pensionCoverageCount: number;
};

/** Derive post-upload readiness lines from clearinghouse import payload (server or client). */
export function buildClearinghouseReadiness(funds: {
  fundType?: string;
  insuranceCoverages?: unknown[];
}[]): ClearinghouseUploadReadiness {
  let pensionFundCount = 0;
  let gemelFundCount = 0;
  let pensionCoverageCount = 0;

  for (const fund of funds) {
    if (fund.fundType && PENSION_FUND_TYPES.has(fund.fundType)) pensionFundCount += 1;
    if (fund.fundType && GEMEL_FUND_TYPES.has(fund.fundType)) gemelFundCount += 1;
    pensionCoverageCount += fund.insuranceCoverages?.length ?? 0;
  }

  return {
    pensionReady: pensionFundCount > 0,
    gemelReady: gemelFundCount > 0,
    pensionInsuranceReady: pensionCoverageCount > 0,
    pensionFundCount,
    gemelFundCount,
    pensionCoverageCount,
  };
}

export function clearinghouseReadinessLines(readiness: ClearinghouseUploadReadiness): string[] {
  const lines: string[] = [];
  if (readiness.pensionReady) lines.push("הסוכן הפנסיוני מוכן");
  if (readiness.gemelReady) lines.push("סוכן הגמל מוכן");
  if (readiness.pensionInsuranceReady) lines.push("הסוכן הביטוחי קיבל כיסויים פנסיוניים");
  return lines;
}
