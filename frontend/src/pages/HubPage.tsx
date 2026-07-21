import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { AGENTS } from "../theme/agents";
import { timeOfDayGreeting } from "../utils/timeGreeting";
import { APP_ROUTES } from "../types/navigation";
import { AGENT_KEY, DOMAIN_TO_AGENT } from "../components/hub/masterAgentMerge";
import { useMasterAgent } from "../components/hub/useMasterAgent";
import { useHubData } from "../components/hub/useHubData";
import MasterBand, { type LastReportMeta } from "../components/hub/MasterBand";
import AgentSummaryCard from "../components/hub/AgentSummaryCard";
import CommandBar from "../components/hub/CommandBar";
import AgentSyncOverlay from "../components/hub/AgentSyncOverlay";
import AgentFocusOverlay from "../components/hub/AgentFocusOverlay";
import { useRegisterPageContext } from "../assistant/AiChatProvider";
import { getLatestExecutiveReport } from "../api/executiveReport.api";
import HubReadinessPanel from "../components/hub/HubReadinessPanel";

/* ============================================================
   Hub — the master agent's home. One editorial page in the
   FinGuide design language: bold greeting → the dark master
   band (unified picture + run CTA + health card) → four agent
   summary cards → a floating command bar.
   ============================================================ */

export default function HubPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // An explicit full run should produce a fresh report; the report page reads
  // this flag — without it, it shows the last saved analysis instantly.
  const goToExecutiveReport = useCallback(() => {
    navigate(APP_ROUTES.executiveReport, { state: { fresh: true } });
  }, [navigate]);

  const master = useMasterAgent({ onFullComplete: goToExecutiveReport });
  const data = useHubData();

  // The last saved executive report (kept 7 days server-side) — lets the user
  // reopen their previous analysis without running the agents again.
  const [lastReport, setLastReport] = useState<LastReportMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getLatestExecutiveReport().then(latest => {
      if (cancelled || !latest.success || !latest.found) return;
      setLastReport({
        savedAt: latest.savedAt,
        score: latest.report.meta.globalHealthScore ?? null,
        topAction: latest.report.sections.topPriorityActions[0]?.title ?? null,
      });
    });
    return () => { cancelled = true; };
  }, []);

  // Deep-link from a domain agent's "chat with the agent" button (/hub?chat=1):
  // scroll to the master-agent chat and focus its input.
  useEffect(() => {
    if (new URLSearchParams(location.search).get("chat") !== "1") return;
    const t = setTimeout(() => {
      document.getElementById("agent-chat")?.scrollIntoView({ behavior: "smooth", block: "start" });
      (document.getElementById("agent-chat-input") as HTMLInputElement | null)?.focus({ preventScroll: true });
    }, 350);
    return () => clearTimeout(t);
  }, [location.search]);

  const hubContextLabel = data.loading
    ? "לוח בקרה (Hub)"
    : data.opportunities > 0
      ? `לוח בקרה · ${data.opportunities} הזדמנויות`
      : "לוח בקרה (Hub)";
  const hubContextDetail = [
    data.completedDocs > 0 ? `תלושים מעובדים: ${data.completedDocs}` : null,
    data.findings.length ? `ממצאים פעילים: ${data.findings.length}` : null,
    data.rankedFindings[0]?.title ? `ממצא מוביל: ${data.rankedFindings[0].title}` : null,
    data.pension?.summary?.fundCount
      ? `קרנות פנסיה במעקב: ${data.pension.summary.fundCount}`
      : null,
    typeof data.potentialSavings === "number" && data.potentialSavings > 0
      ? `פוטנציאל חיסכון: ₪${Math.round(data.potentialSavings).toLocaleString("he-IL")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  useRegisterPageContext(hubContextLabel, hubContextDetail || null);

  const firstName = user?.name?.split(" ")[0] ?? "שלום";
  const greeting = timeOfDayGreeting();
  const reviewLabel = new Date().toLocaleDateString("he-IL", { month: "long", year: "numeric" });

  const oppLine = data.loading
    ? "טוענים את התמונה הפיננסית שלך…"
    : data.opportunities === 1
      ? "ריכזנו עבורך הזדמנות אחת לשיפור."
      : data.opportunities > 1
        ? `ריכזנו עבורך ${data.opportunities} הזדמנויות לשיפור.`
        : data.completedDocs > 0
          ? "לא נמצאו הזדמנויות חדשות — הכל נראה תקין."
          : "העלו תלוש ראשון כדי שנתחיל לזהות הזדמנויות.";

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", direction: "rtl", fontFamily: "var(--font-body)" }}>
      <style>{`
        @keyframes fgSpin { to { transform: rotate(360deg); } }
        @keyframes fgPulse { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
        @keyframes fgRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes fgBlink { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
      `}</style>

      {/* full-screen 3D sync sequence while all agents run together */}
      {master.syncStage && <AgentSyncOverlay stage={master.syncStage} />}
      {/* solo-mission sequence while a single agent runs a focused task */}
      {master.focusStage && master.focusKey && (
        <AgentFocusOverlay agentId={DOMAIN_TO_AGENT[master.focusKey]} stage={master.focusStage} />
      )}

      <PrivateTopbar />

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "44px 24px 80px" }}>
        {/* greeting */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 26 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
              <Sparkles size={17} color="var(--lav-500)" />
              <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".12em", color: "var(--lav-600)" }}>הסוכן הראשי · {reviewLabel}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: "clamp(32px,4vw,48px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.04, color: "var(--text-strong)" }}>{greeting}, {firstName}.</h1>
          </div>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 16, fontWeight: 500, maxWidth: 280, textWrap: "balance" }}>{oppLine}</p>
        </div>

        {/* THE MASTER AGENT BAND — unified picture + run CTA + health card */}
        <MasterBand
          loading={data.loading}
          phase={master.phase}
          busy={master.busy}
          focusKey={master.focusKey}
          result={master.result}
          statusLine={master.statusLine}
          potentialSavings={data.potentialSavings}
          opportunities={data.opportunities}
          completedDocs={data.completedDocs}
          heroRows={data.heroRows}
          onRunFull={master.runFull}
          lastReport={lastReport}
          savedScore={data.healthScore}
        />

        <HubReadinessPanel
          loading={data.loading}
          documents={data.documentInventory}
          advisors={data.advisorReadiness}
        />

        {/* FOUR AGENT CARDS — status readout + gateway into each domain */}
        <div id="agent-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 20, marginBottom: 46, scrollMarginTop: 90 }}>
          {AGENTS.map((a, i) => {
            const key = AGENT_KEY[a.id];
            return (
              <AgentSummaryCard
                key={a.id}
                agent={a}
                index={i}
                metric={data.agentMetric[a.id]}
                readinessDetail={data.advisorReadiness.find(r => r.agentId === a.id)?.detail}
                spark={data.agentSpark[a.id]}
                loading={data.loading}
                agentResult={master.result?.agents?.[key]}
                running={master.phase === "running" || master.focusKey === key}
                disabled={master.busy}
                onOpen={() => navigate(a.route)}
                onAnalyze={() => master.runFocused(key)}
              />
            );
          })}
        </div>

        {/* FLOATING COMMAND BAR — talk to the master agent */}
        <CommandBar busy={master.busy} onRunFocused={master.runFocused} />
      </main>

      <AppFooter variant="private" />
    </div>
  );
}
