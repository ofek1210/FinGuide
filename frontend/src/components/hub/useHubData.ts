import { useEffect, useMemo, useState } from "react";
import type { AgentId } from "../../theme/agents";
import { listFindings, type FindingItem } from "../../api/findings.api";
import { getPensionAnalysis, getPensionFunds, getPensionImportHistory, type PensionAnalysisData } from "../../api/pension.api";
import { getGemelAnalysis, getGemelFunds } from "../../api/gemel.api";
import { isThreeCardAdvisory } from "../../api/financialAdvisory.types";
import { sumAnnualSavings } from "../../utils/financialAdvisoryDisplay";
import { listDocuments, type DocumentItem } from "../../api/documents.api";
import { getInsuranceAnalysis } from "../../api/insuranceAI.api";
import { getFinancialHealthScore } from "../../api/financialHealth.api";
import type { FullAnalysisGlobalScore } from "../../api/fullAnalysis.api";
import { enrichPayslipFromDoc } from "../../utils/payslipEnrichment";
import { domainOf } from "./agentDisplay";
import {
  buildDocumentInventory,
  computeAgentReadiness,
  countProcessingDocuments,
  THEME_TO_SMART,
  type AgentReadinessItem,
  type DocumentInventoryItem,
} from "../../utils/agentReadiness";
import { getAgentOnboardingState, type SmartOnboardingStateDTO } from "../../api/smartOnboarding.api";
import { isThreeCardAdvisory as isGemelThreeCard } from "../../api/financialAdvisory.types";

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
  healthScore: FullAnalysisGlobalScore | null;
  documents: DocumentItem[];
  completedDocs: number;
  domainCounts: Record<AgentId, number>;
  rankedFindings: FindingItem[];
  potentialSavings: number;
  opportunities: number;
  heroRows: [string, string][];
  agentMetric: Record<AgentId, string>;
  agentSpark: Record<AgentId, number[]>;
  documentInventory: DocumentInventoryItem[];
  advisorReadiness: AgentReadinessItem[];
};

export function useHubData(): HubData {
  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [pension, setPension] = useState<PensionAnalysisData | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [importedPolicies, setImportedPolicies] = useState(0);
  const [pensionScoreTrend, setPensionScoreTrend] = useState<number[]>([]);
  const [healthScore, setHealthScore] = useState<FullAnalysisGlobalScore | null>(null);
  const [trackedPensionFundCount, setTrackedPensionFundCount] = useState(0);
  const [gemelFundCount, setGemelFundCount] = useState(0);
  const [hasGemelAnalysis, setHasGemelAnalysis] = useState(false);
  const [hasPayslipGemelSignal, setHasPayslipGemelSignal] = useState(false);
  const [onboardingByAgent, setOnboardingByAgent] = useState<Partial<Record<AgentId, SmartOnboardingStateDTO>>>({});

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      listFindings(),
      getPensionAnalysis(),
      listDocuments(),
      getPensionImportHistory(),
      getInsuranceAnalysis(),
      getFinancialHealthScore(new Date().getFullYear()),
      getPensionFunds(),
      getGemelFunds(),
      getGemelAnalysis(),
      getAgentOnboardingState(THEME_TO_SMART.payslips),
      getAgentOnboardingState(THEME_TO_SMART.insurance),
      getAgentOnboardingState(THEME_TO_SMART.pension),
      getAgentOnboardingState(THEME_TO_SMART.gemel),
    ]).then(([
      findRes, penRes, docRes, histRes, insRes, healthRes,
      penFundsRes, gemFundsRes, gemAnalysisRes,
      payslipObRes, insObRes, penObRes, gemObRes,
    ]) => {
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
      if (healthRes.status === "fulfilled" && healthRes.value.success && healthRes.value.data) {
        // same score the master agent computes on a full run — mapped to the
        // band's shape so the health card is populated straight from mount
        const h = healthRes.value.data;
        setHealthScore({
          year: h.year,
          score: h.score,
          level: h.level,
          label: h.label,
          categories: h.categories.map(c => ({
            id: c.key,
            label: c.name,
            score: c.score,
            maxScore: c.maxScore,
            status: c.status,
          })),
        });
      }
      if (penFundsRes.status === "fulfilled" && penFundsRes.value.ok && penFundsRes.value.data?.data) {
        setTrackedPensionFundCount(penFundsRes.value.data.data.length);
      }
      if (gemFundsRes.status === "fulfilled" && gemFundsRes.value.ok && gemFundsRes.value.data?.data) {
        setGemelFundCount(gemFundsRes.value.data.data.funds?.length ?? 0);
      }
      if (gemAnalysisRes.status === "fulfilled" && gemAnalysisRes.value.ok && gemAnalysisRes.value.data?.data) {
        const g = gemAnalysisRes.value.data.data;
        setHasGemelAnalysis(Boolean(g.summary?.hasData || isGemelThreeCard(g)));
        setHasPayslipGemelSignal(Boolean(
          g.summary?.hasStudyFund
          || g.summary?.hasProvidentFund
          || (g.summary?.fundCount ?? 0) > 0
          || (g.summary?.totalMonthlyContribution ?? 0) > 0,
        ));
      }
      const ob: Partial<Record<AgentId, SmartOnboardingStateDTO>> = {};
      if (payslipObRes.status === "fulfilled" && payslipObRes.value.ok && payslipObRes.value.data?.data) {
        ob.payslips = payslipObRes.value.data.data;
      }
      if (insObRes.status === "fulfilled" && insObRes.value.ok && insObRes.value.data?.data) {
        ob.insurance = insObRes.value.data.data;
      }
      if (penObRes.status === "fulfilled" && penObRes.value.ok && penObRes.value.data?.data) {
        ob.pension = penObRes.value.data.data;
      }
      if (gemObRes.status === "fulfilled" && gemObRes.value.ok && gemObRes.value.data?.data) {
        ob.gemel = gemObRes.value.data.data;
      }
      setOnboardingByAgent(ob);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const completedDocs = useMemo(
    () => documents.filter(d => d.status === "completed" || d.status === "needs_review").length,
    [documents],
  );
  const processingDocs = useMemo(() => countProcessingDocuments(documents), [documents]);
  const effectivePensionFunds = Math.max(trackedPensionFundCount, pension?.summary.fundCount ?? 0);
  const pensionRecs = isThreeCardAdvisory(pension)
    ? (pension.primaryRecommendations ?? [])
    : [];

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
  const potentialSavings = isThreeCardAdvisory(pension)
    ? sumAnnualSavings(pension) * 10
    : (pension?.projection?.mgmtFeeSavings?.savingsByRetirement ?? 0);
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
    pension: effectivePensionFunds > 0
      ? (isThreeCardAdvisory(pension)
        ? `${pension.recommendationCards?.length ?? 3} כרטיסי המלצה`
        : `${effectivePensionFunds} קרנות במעקב`)
      : "טרם חובר מידע פנסיוני",
    gemel: domainCounts.gemel > 0
      ? `${domainCounts.gemel} ממצאים פעילים`
      : (gemelFundCount > 0
        ? `${gemelFundCount} קופות במעקב`
        : (hasPayslipGemelSignal ? "הפקדות מהתלוש — השלימו דוח" : "טרם חוברו קופות גמל")),
  }), [completedDocs, domainCounts, importedPolicies, effectivePensionFunds, pension, gemelFundCount, hasPayslipGemelSignal]);

  const documentInventory = useMemo(() => buildDocumentInventory({
    completedPayslips: completedDocs,
    processingPayslips: processingDocs,
    pensionFundCount: effectivePensionFunds,
    insurancePolicyCount: importedPolicies,
    gemelFundCount,
    hasPayslipGemelSignal,
    hasGemelAnalysis,
  }), [completedDocs, processingDocs, effectivePensionFunds, importedPolicies, gemelFundCount, hasPayslipGemelSignal, hasGemelAnalysis]);

  const advisorReadiness = useMemo((): AgentReadinessItem[] => {
    const payslipHasDoc = completedDocs > 0;
    const pensionHasDoc = effectivePensionFunds > 0;
    const insuranceHasDoc = importedPolicies > 0;
    const gemelHasDoc = gemelFundCount > 0 || hasPayslipGemelSignal || hasGemelAnalysis;

    return ([
      computeAgentReadiness({
        agentId: "payslips",
        onboarding: onboardingByAgent.payslips ?? null,
        hasDocument: payslipHasDoc,
        isProcessing: processingDocs > 0,
        hasAnalysis: payslipHasDoc && completedDocs > 0,
        documentHint: "העלו תלוש שכר מה-Hub",
      }),
      computeAgentReadiness({
        agentId: "pension",
        onboarding: onboardingByAgent.pension ?? null,
        hasDocument: pensionHasDoc,
        hasAnalysis: isThreeCardAdvisory(pension),
        documentHint: "ייבאו דוח הר הכסף",
      }),
      computeAgentReadiness({
        agentId: "gemel",
        onboarding: onboardingByAgent.gemel ?? null,
        hasDocument: gemelHasDoc,
        hasAnalysis: hasGemelAnalysis,
        documentHint: "ייבאו Excel או דוח הר הכסף",
      }),
      computeAgentReadiness({
        agentId: "insurance",
        onboarding: onboardingByAgent.insurance ?? null,
        hasDocument: insuranceHasDoc,
        hasAnalysis: importedPolicies > 0 && Boolean(onboardingByAgent.insurance?.complete),
        documentHint: "ייבאו דוח הר הביטוח",
      }),
    ]);
  }, [
    completedDocs, processingDocs, effectivePensionFunds, importedPolicies,
    gemelFundCount, hasPayslipGemelSignal, hasGemelAnalysis, onboardingByAgent, pension,
  ]);

  return {
    loading,
    findings,
    pension,
    healthScore,
    documents,
    completedDocs,
    domainCounts,
    rankedFindings,
    potentialSavings,
    opportunities,
    heroRows,
    agentMetric,
    agentSpark,
    documentInventory,
    advisorReadiness,
  };
}
