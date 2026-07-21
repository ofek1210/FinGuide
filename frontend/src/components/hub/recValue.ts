import type { FullAnalysisRecommendation } from "../../api/fullAnalysis.api";

/* ============================================================
   recValue — turns the free-text `financialImpact` strings the
   agents produce ("+₪1,167/חודש לקצבה", "~₪163/שנה") into a
   comparable yearly ₪ figure, and grades how much effort each
   recommendation type takes. Powers the "total value" headline
   and the money×effort ordering of the unified summary.
   Pure functions — no React, fully unit-testable.
   ============================================================ */

/**
 * Parse a recommendation's financialImpact into an estimated ₪/year.
 * Monthly amounts are annualized (×12); yearly pass through; amounts
 * with no explicit period (one-time / until-retirement horizons like
 * "₪280,000 עד הפרישה") return null so they never inflate the yearly
 * total. Percent-only impacts ("עד 75% מהשכר") also return null.
 */
export function parseYearlyImpact(impact: string | null | undefined): number | null {
  if (!impact) return null;
  const m = impact.match(/₪\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  const amount = Number.parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (/חודש/.test(impact)) return amount * 12;
  if (/שנה/.test(impact)) return amount;
  return null;
}

export type EffortLevel = {
  /** 0 = a single phone call, 1 = one submission/inquiry, 2 = a longer process */
  rank: 0 | 1 | 2;
  label: string;
};

const EFFORT_CALL: EffortLevel = { rank: 0, label: "שיחה אחת" };
const EFFORT_INQUIRY: EffortLevel = { rank: 1, label: "פנייה אחת" };
const EFFORT_PROCESS: EffortLevel = { rank: 2, label: "תהליך" };

/**
 * Grade the effort a recommendation takes by its backend `type`.
 * Fee negotiations and duplicate cancellations are one phone call;
 * missing coverage / deposits / tax refunds are one inquiry or form;
 * everything else (habits, planning) is a longer process.
 */
export function effortFor(type: string): EffortLevel {
  const t = (type || "").toLowerCase();
  if (/(fee|negotiat|duplicate|cancel)/.test(t)) return EFFORT_CALL;
  if (/(missing|coverage|deposit|continuity|refund|tax|track)/.test(t)) return EFFORT_INQUIRY;
  return EFFORT_PROCESS;
}

const URGENCY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Money×effort ordering: highest yearly value first; among equals,
 * the least effort wins, then urgency breaks the remaining ties —
 * so "the 10-minute call worth ₪14K/yr" always tops the list.
 */
export function compareByValue(a: FullAnalysisRecommendation, b: FullAnalysisRecommendation): number {
  const av = parseYearlyImpact(a.financialImpact) ?? 0;
  const bv = parseYearlyImpact(b.financialImpact) ?? 0;
  if (av !== bv) return bv - av;
  const ae = effortFor(a.type).rank;
  const be = effortFor(b.type).rank;
  if (ae !== be) return ae - be;
  return (URGENCY_ORDER[a.urgency] ?? 3) - (URGENCY_ORDER[b.urgency] ?? 3);
}

/** Sum every parseable impact into one "worth handling it all" ₪/year figure. */
export function totalYearlyValue(recs: FullAnalysisRecommendation[]): { total: number; counted: number } {
  let total = 0;
  let counted = 0;
  for (const r of recs) {
    const v = parseYearlyImpact(r.financialImpact);
    if (v != null) {
      total += v;
      counted += 1;
    }
  }
  return { total, counted };
}
