import type { AgentResult } from "../../api/fullAnalysis.api";
import type { AgentId } from "../../theme/agents";
import type { FindingItem } from "../../api/findings.api";
import type { BackendAgentKey } from "./masterAgentMerge";

/* ============================================================
   Display helpers for the Hub / master agent — pure lookups and
   formatters shared by MasterBand, AgentSummaryCard, NextActions
   and CommandBar.
   ============================================================ */

export const nis = (n: number) => "₪" + Math.round(n).toLocaleString("en-US");

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Chat router classifications (services/agents/orchestrator.js) → focused run key. */
export const CLASSIFICATION_TO_FOCUS: Record<string, BackendAgentKey> = {
  payslip_analysis: "payslip",
  financial_analysis: "payslip",
  insurance_benefits: "insurance",
  pension_advisor: "pension",
  gemel_advisor: "gemel",
  financial_planning: "pension",
};

export const CLASSIFICATION_LABEL: Record<string, string> = {
  payslip_analysis: "סוכן תלושים",
  financial_analysis: "סוכן ניתוח פיננסי",
  insurance_benefits: "סוכן ביטוחים",
  pension_advisor: "סוכן פנסיה",
  gemel_advisor: "סוכן קופות גמל",
  financial_planning: "סוכן תכנון פיננסי",
  general: "הסוכן הראשי",
};

export const FOCUS_LABEL: Record<BackendAgentKey, string> = {
  payslip: "תלושים",
  insurance: "ביטוחים",
  pension: "פנסיה",
  gemel: "גמל והשתלמות",
};

export const SOURCE_LABEL: Record<string, string> = {
  claude: "נוסח על-ידי Claude",
  rule: "סיכום מבוסס כללים",
  fallback: "סיכום מבוסס כללים",
  demo: "מצב הדגמה",
};

/** Priority pill styles on light surfaces (design-system tokens). */
export const PRIORITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  high: { bg: "var(--peach-soft)", color: "var(--peach-ink)", label: "דחוף" },
  medium: { bg: "var(--lav-100)", color: "var(--lav-700)", label: "חשוב" },
  low: { bg: "var(--mint-soft)", color: "var(--mint-ink)", label: "כדאי" },
};

export const QUICK_PROMPTS = [
  "מה מצב התלושים שלי?",
  "יש לי כפל ביטוחי?",
  "כמה אצבור לפנסיה?",
  "מה מצב קרן ההשתלמות שלי?",
];

/** Pull the headline stats an agent surfaces on its card. */
export function agentStats(id: AgentId, result: AgentResult | undefined): Array<{ k: string; v: string }> {
  const d = (result?.data ?? {}) as Record<string, unknown>;
  const stats: Array<{ k: string; v: string }> = [];

  if (id === "payslips") {
    const count = asNumber(d.payslipCount);
    const gross = asNumber(d.latestGross);
    const trend = (d.trend ?? null) as { trend?: string; changePct?: number } | null;
    if (count != null) stats.push({ k: "תלושים מנותחים", v: String(count) });
    if (gross != null) stats.push({ k: "ברוטו אחרון", v: nis(gross) });
    if (trend?.trend && trend.trend !== "stable" && typeof trend.changePct === "number") {
      stats.push({ k: "מגמת שכר", v: `${trend.changePct > 0 ? "+" : ""}${trend.changePct}%` });
    }
  }

  if (id === "insurance") {
    const policies = asNumber(d.policyCount);
    const dups = asNumber(d.duplicateCount);
    const waste = asNumber(d.totalMonthlyWaste);
    if (policies != null) stats.push({ k: "פוליסות", v: String(policies) });
    if (dups != null && dups > 0) stats.push({ k: "כפילויות", v: String(dups) });
    if (waste != null && waste > 0) stats.push({ k: "בזבוז חודשי", v: nis(waste) });
  }

  if (id === "pension") {
    const monthly = asNumber(d.totalMonthlyContribution);
    const projection = (d.projection ?? null) as { monthlyPensionEstimate?: number } | null;
    const health = (d.healthCheck ?? null) as { score?: number } | null;
    if (monthly != null) stats.push({ k: "הפקדה חודשית", v: nis(monthly) });
    if (typeof projection?.monthlyPensionEstimate === "number") {
      stats.push({ k: "קצבה חזויה", v: nis(projection.monthlyPensionEstimate) });
    }
    if (typeof health?.score === "number") stats.push({ k: "ציון פנסיה", v: `${health.score}` });
  }

  if (id === "gemel") {
    const balance = asNumber(d.totalBalance);
    const monthly = asNumber(d.totalMonthlyContribution);
    const funds = asNumber(d.fundCount);
    if (balance != null && balance > 0) stats.push({ k: "צבירה כוללת", v: nis(balance) });
    if (monthly != null && monthly > 0) stats.push({ k: "הפקדה חודשית", v: nis(monthly) });
    if (funds != null && funds > 0) stats.push({ k: "קופות במעקב", v: String(funds) });
  }

  return stats.slice(0, 3);
}

/** Domain verdict (pension LEAVE/NEGOTIATE/SWITCH · insurance STAY/REVIEW/SWITCH). */
export function agentVerdict(id: AgentId, result: AgentResult | undefined): string | null {
  const d = (result?.data ?? {}) as Record<string, unknown>;
  if (id === "pension") {
    const advice = (d.fundAdvice ?? null) as { overallVerdictLabelHe?: string } | null;
    return asString(advice?.overallVerdictLabelHe);
  }
  if (id === "insurance" || id === "gemel") {
    const advice = (d.marketAdvice ?? null) as { overallVerdictLabelHe?: string } | null;
    return asString(advice?.overallVerdictLabelHe);
  }
  return null;
}

/* ── findings → domain mapping (pre-run fallbacks) ───────────── */

const PENSION_KINDS = new Set(["pension_health_low", "fee_above_market", "risk_wrong_for_age", "track_underperforming"]);

export function domainOf(f: FindingItem): AgentId {
  const kind = String(f.meta?.findingKind || "");
  if (kind.startsWith("insurance_")) return "insurance";
  if (kind.startsWith("study_fund") || kind.startsWith("gemel") || f.meta?.fundType === "study_fund") return "gemel";
  if (PENSION_KINDS.has(kind) || f.meta?.fundType === "pension") return "pension";
  return "payslips";
}

export const DOMAIN_LABEL: Record<AgentId, string> = {
  payslips: "תלושי שכר",
  insurance: "ביטוח",
  pension: "פנסיה",
  gemel: "גמל והשתלמות",
};
