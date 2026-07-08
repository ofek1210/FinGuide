export type DebatePosition = {
  agentId: string;
  labelHe: string;
  domainHe: string;
  title: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  financialImpact: string | null;
  priorityScore: number;
};

export type DebateRebuttal = {
  fromAgent: string;
  toAgent: string;
  stance: "challenge" | "support" | "neutral";
  text: string;
};

export type DebateVerdict = {
  rankedPriorities: Array<{
    rank: number;
    agentId: string;
    labelHe?: string;
    title: string;
    urgency?: string;
    financialImpact?: string | null;
  }>;
  summaryHe: string;
  judgeReasoning: string;
  source: "rule" | "llm" | "demo";
};

export type DebateResult = {
  success: boolean;
  debateId: string;
  positions: DebatePosition[];
  rebuttals: DebateRebuttal[];
  verdict: DebateVerdict;
  meta?: { durationMs: number; source?: string; isDemo?: boolean };
};

export type DebateStreamEvent =
  | { type: "phase"; phase: "positions" | "rebuttals" | "verdict"; labelHe?: string }
  | ({ type: "position" } & DebatePosition)
  | ({ type: "rebuttal" } & DebateRebuttal)
  | ({ type: "verdict" } & DebateVerdict)
  | { type: "done"; debateId: string; meta?: DebateResult["meta"] }
  | { type: "error"; message: string };

export function streamAgentDebate(
  params: { demo?: boolean; skipLLM?: boolean },
  onEvent: (event: DebateStreamEvent) => void,
  onError: (message: string) => void,
): () => void {
  const controller = new AbortController();
  const token = localStorage.getItem("token");

  void (async () => {
    try {
      const response = await fetch("/api/ai/debate/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        onError("לא הצלחנו להתחבר לשרת.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.slice(5).trim()) as DebateStreamEvent;
            if (event.type === "error") {
              onError(event.message);
            } else {
              onEvent(event);
            }
          } catch {
            // skip malformed chunk
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError("שגיאה בזמן קבלת הדיון.");
      }
    }
  })();

  return () => controller.abort();
}
