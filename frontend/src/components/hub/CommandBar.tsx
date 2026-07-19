import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BrainCircuit, ChevronDown, Plus, Send, Sparkles, Zap } from "lucide-react";
import { askAgent } from "../../api/agents.api";
import { CLASSIFICATION_LABEL, CLASSIFICATION_TO_FOCUS, FOCUS_LABEL, QUICK_PROMPTS } from "./agentDisplay";
import type { BackendAgentKey } from "./masterAgentMerge";

/* ============================================================
   CommandBar — the master agent's floating command input.
   One clean sticky row; the latest answer expands in place
   above it. A classified answer offers a one-click focused run.
   Deep-link contract: #agent-chat / #agent-chat-input are the
   ids domain pages target via /hub?chat=1.
   ============================================================ */

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  agentLabel?: string;
  taskFocus?: BackendAgentKey | null;
  isError?: boolean;
};

/** localStorage key for the persisted command-chat transcript. */
const CHAT_STORAGE_KEY = "fg_hub_agent_chat";

/**
 * Answers arrive as raw text with markdown leftovers ("**bold**").
 * Render the `**…**` pairs as real bold, strip any orphan markers,
 * and turn "- " / "* " line prefixes into clean bullets.
 */
function renderAnswer(text: string): ReactNode[] {
  return text.split(/\*\*([^*]+)\*\*/g).map((part, i) =>
    i % 2 === 1
      ? <b key={i} style={{ fontWeight: 800, color: "var(--text-strong)" }}>{part}</b>
      : part.replace(/\*\*/g, "").replace(/^[ \t]*[-*][ \t]+/gm, "• "),
  );
}

function loadChat(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type CommandBarProps = {
  busy: boolean;
  onRunFocused: (key: BackendAgentKey) => void;
};

export default function CommandBar({ busy, onRunFocused }: CommandBarProps) {
  const [messages, setMessages] = useState<ChatMsg[]>(loadChat);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Persist the transcript (keep the last 50 messages).
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch { /* storage full / unavailable — non-fatal */ }
  }, [messages]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setHistoryOpen(false);
    try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* non-fatal */ }
  }, []);

  /** Send a message to the agent router; classified answers become tasks. */
  const handleSend = useCallback(async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || chatBusy) return;
    setInput("");
    setHistoryOpen(false);
    setMessages(prev => [...prev, { role: "user", content: message }]);
    setChatBusy(true);

    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
    const res = await askAgent(message, history);

    if (res.ok && res.data?.data?.answer) {
      const { answer, classification } = res.data.data;
      setMessages(prev => [...prev, {
        role: "assistant",
        content: answer,
        agentLabel: CLASSIFICATION_LABEL[classification] ?? "הסוכן הראשי",
        taskFocus: CLASSIFICATION_TO_FOCUS[classification] ?? null,
      }]);
    } else {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "לא הצלחתי להגיע לסוכנים כרגע. נסה שוב בעוד רגע.",
        isError: true,
      }]);
    }
    setChatBusy(false);
  }, [input, chatBusy, messages]);

  // The latest exchange (last user question + its answer) renders by default;
  // everything before is behind the history toggle.
  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant") ?? null;
  const lastUser = [...messages].reverse().find(m => m.role === "user") ?? null;
  const priorCount = Math.max(0, messages.length - (lastAssistant ? 1 : 0) - (lastUser ? 1 : 0));

  const showAnswerPanel = chatBusy || lastAssistant != null;

  return (
    <section
      id="agent-chat"
      style={{ position: "sticky", bottom: 16, zIndex: 40, scrollMarginTop: 90, marginBottom: 8 }}
    >
      <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-card)", overflow: "hidden" }}>
        {/* expanded answer — grows above the input row */}
        {showAnswerPanel && (
          <div style={{ padding: "16px 18px 4px", borderBottom: "1px solid var(--border-hair)", animation: "fgRise .35s var(--ease) both" }}>
            {/* history toggle + prior messages */}
            {priorCount > 0 && (
              <button
                onClick={() => setHistoryOpen(o => !o)}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 700, color: "var(--text-faint)", marginBottom: 10, padding: 0 }}
              >
                <ChevronDown size={13} style={{ transform: historyOpen ? "rotate(180deg)" : "none", transition: "transform .2s var(--ease)" }} />
                היסטוריה ({priorCount})
              </button>
            )}
            {historyOpen && priorCount > 0 && (
              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, paddingInlineEnd: 4 }}>
                {messages.slice(0, messages.length - (lastAssistant ? 1 : 0) - (lastUser ? 1 : 0)).map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "82%", padding: "8px 12px", borderRadius: m.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px", background: m.role === "user" ? "var(--lav-100)" : "var(--surface-sunken)", border: "1px solid var(--border-hair)", fontSize: 12.5, lineHeight: 1.55, fontWeight: 500, color: m.isError ? "var(--peach-ink)" : "var(--text-body)", whiteSpace: "pre-line" }}>
                    {m.role === "assistant" ? renderAnswer(m.content) : m.content}
                  </div>
                ))}
              </div>
            )}

            {/* latest question */}
            {lastUser && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <div style={{ maxWidth: "78%", padding: "9px 14px", borderRadius: "14px 14px 4px 14px", background: "var(--lav-100)", border: "1px solid var(--lav-200)", fontSize: 13.5, lineHeight: 1.55, fontWeight: 600, color: "var(--lav-700)", whiteSpace: "pre-line" }}>
                  {lastUser.content}
                </div>
              </div>
            )}

            {/* latest answer / busy indicator */}
            {chatBusy ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)", paddingBottom: 12 }}>
                <span style={{ display: "inline-flex", gap: 3 }}>
                  {[0, 1, 2].map(j => (
                    <span key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--lav-400)", animation: `fgBlink 1.1s ${j * 0.18}s ease-in-out infinite` }} />
                  ))}
                </span>
                הסוכן הראשי מנתב את השאלה...
              </div>
            ) : lastAssistant && (
              <div style={{ paddingBottom: 14 }}>
                {lastAssistant.agentLabel && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: "var(--lav-600)", marginBottom: 6, display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Sparkles size={11} /> {lastAssistant.agentLabel}
                  </span>
                )}
                <div style={{ fontSize: 13.5, lineHeight: 1.65, fontWeight: 500, color: lastAssistant.isError ? "var(--peach-ink)" : "var(--text-body)", whiteSpace: "pre-line" }}>
                  {renderAnswer(lastAssistant.content)}
                </div>
                {lastAssistant.taskFocus && (
                  <button
                    onClick={() => onRunFocused(lastAssistant.taskFocus as BackendAgentKey)}
                    disabled={busy}
                    style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, background: "var(--mint-soft)", color: "var(--mint-ink)", border: "1px solid var(--mint)", borderRadius: 999, padding: "6px 13px", fontFamily: "inherit", fontWeight: 800, fontSize: 12, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.55 : 1 }}
                  >
                    <Zap size={13} strokeWidth={2.4} />
                    הרץ ניתוח {FOCUS_LABEL[lastAssistant.taskFocus]}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* quick prompts — only before any visible answer */}
        {!showAnswerPanel && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "12px 18px 0" }}>
            {QUICK_PROMPTS.map(q => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                style={{ background: "var(--surface-sunken)", color: "var(--text-body)", border: "1px solid var(--border-hair)", borderRadius: 999, padding: "5px 12px", fontFamily: "inherit", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* the command row */}
        <form
          onSubmit={e => { e.preventDefault(); handleSend(); }}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px" }}
        >
          <span style={{ width: 34, height: 34, flex: "none", borderRadius: 10, background: "linear-gradient(135deg,#9B7FE8,#6F8BE8)", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 4px 12px rgba(124,95,214,.3)" }}>
            <BrainCircuit size={18} strokeWidth={2} />
          </span>
          <input
            id="agent-chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="שאל את הסוכן הראשי — לדוגמה: למה הנטו שלי ירד החודש?"
            disabled={chatBusy}
            style={{ flex: 1, background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", borderRadius: 11, padding: "11px 15px", fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, color: "var(--text-strong)", outline: "none" }}
          />
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleNewChat}
              disabled={chatBusy}
              title="התחל צ'אט חדש — מוחק את ההיסטוריה"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", color: "var(--text-faint)", border: "1px solid var(--border-hair)", borderRadius: 999, padding: "8px 13px", fontFamily: "inherit", fontWeight: 700, fontSize: 12, cursor: chatBusy ? "not-allowed" : "pointer", opacity: chatBusy ? 0.5 : 1, whiteSpace: "nowrap" }}
            >
              <Plus size={13} strokeWidth={2.6} /> חדש
            </button>
          )}
          <button
            type="submit"
            disabled={chatBusy || !input.trim()}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: input.trim() && !chatBusy ? "linear-gradient(135deg,#9B7FE8,#6F8BE8)" : "var(--surface-sunken)", color: input.trim() && !chatBusy ? "#fff" : "var(--text-faint)", border: "none", borderRadius: 11, padding: "11px 18px", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5, cursor: chatBusy || !input.trim() ? "not-allowed" : "pointer", transition: "background .25s var(--ease)" }}
          >
            <Send size={14} strokeWidth={2.3} /> שלח
          </button>
        </form>
      </div>
    </section>
  );
}
