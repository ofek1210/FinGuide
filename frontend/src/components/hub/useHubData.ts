import { useEffect, useMemo, useState } from "react";
import type { AgentId } from "../../theme/agents";
import { listFindings, type FindingItem } from "../../api/findings.api";
import { getPensionAnalysis, getPensionImportHistory, type PensionAnalysisData } from "../../api/pension.api";
import { listDocuments, type DocumentItem } from "../../api/documents.api";
import { getInsuranceAnalysis } from "../../api/insuranceAI.api";
import { enrichPayslipFromDoc } from "../../utils/payslipEnrichment";
import { domainOf } from "./agentDisplay";

/* ============================================================
   useHubData — the Hub's mount-time domain snapshot.
   The band and the four agent cards must show real content
   before any analysis run; a run only augments them.
   ============================================================ */

/** sortable YYYYMM key — explicit payslip period when present, else upload date */
function periodKey(d: DocumentItem): number {
  const y = d.metadata?.periodYear, m = d.metadata?.periodMonth;
  if (y && m) return y * 100 + m;
  const t = new Date(d.processedAt || d.uploadedAt || d.createdAt || 0);
  return Number.isNaN(t.getTime()) ? 0 : t.getFullYear() * 100 + (t.getMonth() + 1);
}

/** net-salary trend across the user's completed payslips (last 6 with a net value) */
function netTrend(docs: DocumentItem[]): number[] {
  const points = docs
    .filter(d => d.status === "completed" || d.status === "needs_review")
    .sort((a, b) => periodKey(a) - periodKey(b))
    .map(d => enrichPayslipFromDoc(d).netSalary)
    .filter((n): n is number => n != null)
    .slice(-6);
  return points.length >= 2 ? points : [];
}

export type HubData = {
  loading: boolean;
  findings: FindingItem[];
  pension: PensionAnalysisData | null;
  documents: DocumentItem[];
  completedDocs: number;
  domainCounts: Record<AgentId, number>;
  rankedFindings: FindingItem[];
  potentialSavings: number;
  opportunities: number;
  heroRows: [string, string][];
  agentMetric: Record<AgentId, string>;
  agentSpark: Record<AgentId, number[]>;
};

export function useHubData(): HubData {
  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [pension, setPension] = useState<PensionAnalysisData | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [importedPolicies, setImportedPolicies] = useState(0);
  const [pensionScoreTrend, setPensionScoreTrend] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      listFindings(),
      getPensionAnalysis(),
      listDocuments(),
      getPensionImportHistory(),
      getInsuranceAnalysis(),
    ]).then(([findRes, penRes, docRes, histRes, insRes]) => {
      if (!alive) return;
      if (findRes.status === "fulfilled" && findRes.value.success && findRes.value.data) {
        setFindings(findRes.value.data);
      }
      if (penRes.status === "fulfilled" && penRes.value.ok && penRes.value.data.data) {
        setPension(penRes.value.data.data);
      }
      if (docRes.status === "fulfilled" && docRes.value.success && docRes.value.data) {
        setDocuments(docRes.value.data);
      }
      if (histRes.status === "fulfilled" && histRes.value.ok && histRes.value.data.data) {
        const scores = histRes.value.data.data
          .slice()
          .reverse() // history arrives newest-first; sparkline reads oldest→newest
          .map(s => s.healthScore)
          .filter((s): s is number => s != null)
          .slice(-6);
        setPensionScoreTrend(scores.length >= 2 ? scores : []);
      }
      if (insRes.status === "fulfilled" && insRes.value.ok && insRes.value.data?.data) {
        setImportedPolicies(insRes.value.data.data.policies?.length ?? 0);
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const completedDocs = useMemo(
    () => documents.filter(d => d.status === "completed" || d.status === "needs_review").length,
    [documents],
  );
  const pensionFundCount = pension?.summary.fundCount ?? 0;
  const pensionRecs = pension?.recommendations ?? [];

  // ranked findings — warnings first, top 3
  const rankedFindings = useMemo(() => {
    const order = { warning: 0, info: 1 } as const;
    return [...findings].sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 3);
  }, [findings]);

  const domainCounts = useMemo(() => {
    const c: Record<AgentId, number> = { payslips: 0, insurance: 0, pension: 0, gemel: 0 };
    findings.forEach(f => { c[domainOf(f)]++; });
    return c;
  }, [findings]);

  // potential savings to retirement, from real pension analysis
  const potentialSavings =
    pension?.benchmark?.summary.totalPotentialSavings ??
    pension?.projection?.mgmtFeeSavings?.savingsByRetirement ??
    0;
  const opportunities = findings.length + pensionRecs.length;

  const heroRows = useMemo(() => {
    const rows: [string, string][] = [];
    if (domainCounts.payslips) rows.push(["ממצאים בתלושי שכר", `${domainCounts.payslips}`]);
    if (domainCounts.insurance) rows.push(["ממצאי ביטוח", `${domainCounts.insurance}`]);
    if (domainCounts.pension) rows.push(["ממצאי פנסיה", `${domainCounts.pension}`]);
    if (domainCounts.gemel) rows.push(["ממצאי גמל והשתלמות", `${domainCounts.gemel}`]);
    if (pensionRecs.length) rows.push(["המלצות פנסיה", `${pensionRecs.length}`]);
    return rows.slice(0, 3);
  }, [domainCounts, pensionRecs.length]);

  // real per-agent trend series; a card simply shows no chart when there is no history yet
  const payslipTrend = useMemo(() => netTrend(documents), [documents]);
  const agentSpark: Record<AgentId, number[]> = useMemo(() => ({
    payslips: payslipTrend,
    insurance: [],
    pension: pensionScoreTrend,
    gemel: [],
  }), [payslipTrend, pensionScoreTrend]);

  const agentMetric: Record<AgentId, string> = useMemo(() => ({
    payslips: completedDocs > 0
      ? (domainCounts.payslips > 0 ? `${domainCounts.payslips} ממצאים פעילים` : `${completedDocs} תלושים נותחו`)
      : "טרם הועלו תלושים",
    insurance: importedPolicies > 0
      ? (domainCounts.insurance > 0 ? `${domainCounts.insurance} ממצאים פעילים` : `${importedPolicies} פוליסות במעקב`)
      : "טרם יובאו פוליסות",
    pension: pensionFundCount > 0
      ? (pensionRecs.length > 0 ? `${pensionRecs.length} המלצות` : `${pensionFundCount} קרנות במעקב`)
      : "טרם חובר מידע פנסיוני",
    gemel: domainCounts.gemel > 0
      ? `${domainCounts.gemel} ממצאים פעילים`
      : (pension?.summary.hasStudyFund ? "קרן השתלמות במעקב" : "טרם חוברו קופות גמל"),
  }), [completedDocs, domainCounts, importedPolicies, pensionFundCount, pensionRecs.length, pension?.summary.hasStudyFund]);

  return {
    loading,
    findings,
    pension,
    documents,
    completedDocs,
    domainCounts,
    rankedFindings,
    potentialSavings,
    opportunities,
    heroRows,
    agentMetric,
    agentSpark,
  };
}
