import { useCallback, useMemo, useState } from "react";
import { runFullAnalysis, type FullAnalysisResponse } from "../../api/fullAnalysis.api";
import type { SyncStage } from "./AgentSyncOverlay";
import type { FocusStage } from "./AgentFocusOverlay";
import { mergeAnalysisResult, type BackendAgentKey } from "./masterAgentMerge";
import { FOCUS_LABEL } from "./agentDisplay";

/* ============================================================
   useMasterAgent — the Hub's analysis state machine.
   Owns the run phase, the focused-run key, the merged result and
   the overlay choreography (full-run sync scene / solo mission).
   ============================================================ */

export type Phase = "idle" | "running" | "done" | "error";

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Overlay timing: hold the animation a readable minimum, then play the exit. */
const SYNC_MIN_MS = 3400;
const SYNC_EXIT_MS = 1000;
const FOCUS_MIN_MS = 2600;
const FOCUS_EXIT_MS = 800;

/** Dev affordance: /hub?demo=1 routes runs to the backend's deterministic
 *  mock payload (isDemoRequest is hard-disabled in production). */
const isDemoRun = () => new URLSearchParams(window.location.search).get("demo") === "1";

export type MasterAgent = {
  phase: Phase;
  result: FullAnalysisResponse | null;
  busy: boolean;
  focusKey: BackendAgentKey | null;
  syncStage: SyncStage | null;
  focusStage: FocusStage | null;
  statusLine: string;
  runFull: () => void;
  runFocused: (key: BackendAgentKey) => void;
};

export function useMasterAgent(): MasterAgent {
  const [phase, setPhase] = useState<Phase>("idle");
  const [focusKey, setFocusKey] = useState<BackendAgentKey | null>(null);
  const [result, setResult] = useState<FullAnalysisResponse | null>(null);
  const [syncStage, setSyncStage] = useState<SyncStage | null>(null);
  const [focusStage, setFocusStage] = useState<FocusStage | null>(null);

  const busy = phase === "running" || focusKey !== null;

  const applyResult = useCallback((data: FullAnalysisResponse, focus?: BackendAgentKey) => {
    setResult(prev => mergeAnalysisResult(prev, data, focus));
  }, []);

  const runFull = useCallback(async () => {
    setPhase("running");
    setSyncStage("enter");
    const startedAt = Date.now();

    const res = await runFullAnalysis(isDemoRun() ? { demo: true } : {});

    // Hold the 3D sync scene for a minimum beat, then play the exit
    // (satellites converge into the core, core bursts, overlay fades).
    await sleep(Math.max(0, SYNC_MIN_MS - (Date.now() - startedAt)));
    setSyncStage("exit");
    await sleep(SYNC_EXIT_MS);
    setSyncStage(null);

    // Only now — back in the Hub — reveal the results.
    if (res.ok && res.data) {
      applyResult(res.data);
      setPhase("done");
    } else {
      setPhase("error");
    }
  }, [applyResult]);

  /** Run a single agent (focused analysis). Shows the solo-mission overlay
   *  for just this agent while it works. */
  const runFocused = useCallback(async (key: BackendAgentKey) => {
    setFocusKey(key);
    setFocusStage("enter");
    const startedAt = Date.now();

    // Focused run: skipLLM so no model credit is spent — only the agent's own
    // (rule-based) data. The unified LLM summary is reserved for a full run.
    const res = await runFullAnalysis({ focus: key, skipLLM: true, ...(isDemoRun() ? { demo: true } : {}) });

    await sleep(Math.max(0, FOCUS_MIN_MS - (Date.now() - startedAt)));
    setFocusStage("exit");
    await sleep(FOCUS_EXIT_MS);
    setFocusStage(null);

    if (res.ok && res.data) {
      applyResult(res.data, key);
      setPhase(p => (p === "idle" || p === "error" ? "done" : p));
    }
    setFocusKey(null);
  }, [applyResult]);

  const statusLine = useMemo(() => {
    if (phase === "running") return "מריץ ארבעה סוכנים במקביל ומצליב תוצאות...";
    if (focusKey) return `מריץ את סוכן ה${FOCUS_LABEL[focusKey]} בלבד...`;
    if (phase === "done" && result?.meta) {
      const secs = (result.meta.durationMs / 1000).toFixed(1);
      return `הניתוח הושלם · ${result.meta.successCount}/${result.meta.agentCount} סוכנים · ${secs} שניות`;
    }
    if (phase === "error") return "הניתוח נכשל — נסה שוב בעוד רגע.";
    return "ארבעה סוכנים מחכים לפקודה. הרצה אחת — תמונה מלאה.";
  }, [phase, focusKey, result]);

  return {
    phase,
    result,
    busy,
    focusKey,
    syncStage,
    focusStage,
    statusLine,
    runFull: () => { void runFull(); },
    runFocused: (key: BackendAgentKey) => { void runFocused(key); },
  };
}
