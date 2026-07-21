import { useCallback, useEffect, useRef, useState } from "react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import {
  useAiChat,
  isVoiceInputSupported,
} from "../assistant/AiChatProvider";
import { renderMarkdown } from "../utils/renderMarkdown";
import "./AIAgentsPage.css";

function formatConversationPreview(
  title: string | undefined,
  preview: string,
  updatedAt: string,
): string {
  const text = (title || preview || "שיחה").trim().slice(0, 42);
  const date = updatedAt ? new Date(updatedAt) : null;
  const dateLabel =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("he-IL", { day: "numeric", month: "short" })
      : "";
  return dateLabel ? `${text}${text.length >= 42 ? "…" : ""} · ${dateLabel}` : text;
}

function formatRateLimitWait(until: number | null): string | null {
  if (!until) return null;
  const sec = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  if (sec <= 0) return null;
  if (sec < 60) return `${sec} שניות`;
  const min = Math.ceil(sec / 60);
  return min === 1 ? "דקה" : `${min} דקות`;
}

function degradedBannerText(reason?: string): string | null {
  if (!reason) return null;
  if (reason === "budget_exhausted") {
    return "חריגת תקציב Claude — התשובה הגיעה ממודל מקומי.";
  }
  if (
    reason === "missing_anthropic_key" ||
    reason === "provider_ollama" ||
    reason === "claude_unavailable" ||
    reason === "claude_empty" ||
    reason === "claude_error"
  ) {
    return "מצב מקומי — Claude לא זמין כרגע; התשובה ממודל מקומי.";
  }
  return "מצב מדולדל — התשובה עשויה להיות פחות מדויקת.";
}

/**
 * Full-page financial assistant — same AiChatProvider /chat/stream stack
 * as the floating bubble (not /api/agents/ask).
 */
export default function AIAgentsPage() {
  const {
    messages,
    conversationId,
    conversations,
    isSending,
    isListening,
    error,
    lastFailedUserMessage,
    historyHydrated,
    rateLimitedUntil,
    suggestions,
    sendMessage,
    stopGeneration,
    retryLastFailed,
    clearChat,
    selectConversation,
    deleteConversation,
    renameConversation,
    rateMessage,
    feedbackToast,
    startVoiceInput,
    stopVoiceInput,
    pageContext,
  } = useAiChat();

  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  const rateLimited = Boolean(rateLimitedUntil && Date.now() < rateLimitedUntil);
  const rateLimitWait = formatRateLimitWait(rateLimitedUntil);
  const showSuggestions =
    historyHydrated &&
    !isSending &&
    messages.filter((m) => m.id !== "welcome").length === 0;
  const latestAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && !m.isStreaming && m.source);
  const degradedText = degradedBannerText(latestAssistant?.degradedReason);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!historyOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [historyOpen]);

  const handleSend = (forced?: string) => {
    const text = (forced ?? input).trim();
    if (!text || isSending || rateLimited || !historyHydrated) return;
    setInput("");
    sendMessage(text);
  };

  const handleStartRename = useCallback(
    (id: string, currentTitle: string | undefined, event: React.MouseEvent) => {
      event.stopPropagation();
      setRenamingId(id);
      setRenameDraft(currentTitle || "");
    },
    [],
  );

  const handleCommitRename = useCallback(
    async (id: string) => {
      const trimmed = renameDraft.trim();
      setRenamingId(null);
      if (!trimmed) return;
      await renameConversation(id, trimmed);
    },
    [renameDraft, renameConversation],
  );

  return (
    <div className="ai-agents-page" dir="rtl">
      <PrivateTopbar />
      <main className="ai-agents-main">
        <header className="ai-agents-header">
          <div>
            <h1>עוזר AI פיננסי</h1>
            <p>
              אותה שיחה כמו בבועה הצפה — שאלות על שכר, פנסיה, ממצאים והמלצות.
              להרצת סוכני ניתוח השתמשו ב-Hub.
            </p>
            {pageContext ? (
              <div className="ai-agents-page-context">📍 {pageContext}</div>
            ) : null}
          </div>
          <div className="ai-agents-header-actions">
            <div className="ai-agents-history" ref={historyRef}>
              <button
                type="button"
                className="ai-agents-clear"
                onClick={() => setHistoryOpen((o) => !o)}
                disabled={isSending}
                aria-expanded={historyOpen}
              >
                שיחות
              </button>
              {historyOpen ? (
                <div className="ai-agents-history-menu" role="listbox">
                  <button
                    type="button"
                    className="ai-agents-history-new"
                    onClick={() => {
                      clearChat();
                      setHistoryOpen(false);
                    }}
                  >
                    ＋ שיחה חדשה
                  </button>
                  {conversations.length === 0 ? (
                    <div className="ai-agents-history-empty">אין שיחות קודמות</div>
                  ) : (
                    conversations.map((c) => (
                      <div
                        key={c.conversationId}
                        className={`ai-agents-history-row${
                          c.conversationId === conversationId ? " is-active" : ""
                        }`}
                      >
                        {renamingId === c.conversationId ? (
                          <input
                            className="ai-agents-history-rename-input"
                            value={renameDraft}
                            autoFocus
                            aria-label="שם חדש לשיחה"
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void handleCommitRename(c.conversationId);
                              }
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={() => void handleCommitRename(c.conversationId)}
                          />
                        ) : (
                          <button
                            type="button"
                            className="ai-agents-history-item"
                            onClick={() => {
                              selectConversation(c.conversationId);
                              setHistoryOpen(false);
                            }}
                          >
                            {formatConversationPreview(c.title, c.preview, c.updatedAt)}
                            {c.degraded || c.lastSource === "ollama" ? (
                              <span className="ai-agents-history-meta"> מקומי</span>
                            ) : null}
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="שנה שם"
                          onClick={(e) => handleStartRename(c.conversationId, c.title, e)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          aria-label="מחק שיחה"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!window.confirm("למחוק את השיחה לצמיתות?")) return;
                            void deleteConversation(c.conversationId);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
            <button type="button" className="ai-agents-clear" onClick={clearChat} disabled={isSending}>
              שיחה חדשה
            </button>
          </div>
        </header>

        {degradedText ? (
          <div className="ai-agents-degraded" role="status">
            {degradedText}
          </div>
        ) : null}

        {error ? (
          <div className="ai-agents-error" role="alert">
            <span>
              {error}
              {rateLimited && rateLimitWait ? ` (נותרו ${rateLimitWait})` : ""}
            </span>
            {lastFailedUserMessage ? (
              <button
                type="button"
                onClick={retryLastFailed}
                disabled={isSending || rateLimited}
              >
                נסה שוב
              </button>
            ) : null}
          </div>
        ) : null}

        {feedbackToast ? (
          <div className="ai-agents-toast" role="status">
            {feedbackToast}
          </div>
        ) : null}

        {!historyHydrated ? (
          <div className="ai-agents-loading" aria-live="polite">
            טוען שיחה…
          </div>
        ) : null}

        <div className="ai-agents-messages" aria-live="polite" aria-busy={isSending || !historyHydrated}>
          {messages.map((m) => (
            <div key={m.id} className={`ai-agents-msg ${m.role}`}>
              {m.isStreaming && !m.content ? (
                <span>מכין תשובה…</span>
              ) : m.isStreaming ? (
                <div className="ai-agents-stream-plain">{m.content}</div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
              )}
              {m.role === "assistant" && !m.isStreaming && m.content ? (
                <div className="ai-agents-msg-meta">
                  {m.source ? <em>{m.source === "rule" ? "מיידי" : m.source}</em> : null}
                  {m.latencyMs != null ? (
                    <span>
                      {m.latencyMs < 1000
                        ? `${Math.round(m.latencyMs)}מ״ש`
                        : `${(m.latencyMs / 1000).toFixed(1)}שנ׳`}
                    </span>
                  ) : null}
                  {m.contextUsed?.length ? (
                    <div className="ai-agents-context-used">
                      מבוסס על: {m.contextUsed.join(" · ")}
                    </div>
                  ) : null}
                  {m.citations?.length ? (
                    <div className="ai-agents-citations">
                      {m.citations.map((c) =>
                        c.href ? (
                          <a key={`${c.type}-${c.label}`} href={c.href}>
                            {c.label}
                          </a>
                        ) : (
                          <span key={`${c.type}-${c.label}`}>{c.label}</span>
                        ),
                      )}
                    </div>
                  ) : null}
                  {m.id !== "welcome" && !m.id.startsWith("assistant-") ? (
                    <span className="ai-feedback-btns">
                      <button
                        type="button"
                        className={m.feedbackRating === 1 ? "is-active" : ""}
                        aria-label="תשובה מועילה"
                        title="מועיל"
                        onClick={() => void rateMessage(m.id, 1)}
                      >
                        👍
                      </button>
                      <button
                        type="button"
                        className={m.feedbackRating === -1 ? "is-active" : ""}
                        aria-label="תשובה לא מועילה"
                        title="לא מועיל"
                        onClick={() => void rateMessage(m.id, -1)}
                      >
                        👎
                      </button>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {showSuggestions ? (
          <div className="ai-agents-suggestions">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={isSending || rateLimited || !historyHydrated}
                onClick={() => handleSend(s)}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <div className="ai-agents-input">
          {isVoiceInputSupported ? (
            <button
              type="button"
              onClick={() => (isListening ? stopVoiceInput() : startVoiceInput(setInput))}
              disabled={isSending || rateLimited}
              aria-label={isListening ? "עצור קלט קולי" : "קלט קולי"}
            >
              {isListening ? "⏹" : "🎤"}
            </button>
          ) : null}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              rateLimited && rateLimitWait
                ? `המתינו עוד ${rateLimitWait}…`
                : !historyHydrated
                  ? "טוען שיחה…"
                  : "כתבו שאלה פיננסית…"
            }
            disabled={isSending || rateLimited || !historyHydrated}
          />
          {isSending ? (
            <button type="button" onClick={stopGeneration}>
              עצור
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={rateLimited || !historyHydrated || !input.trim()}
            >
              שליחה
            </button>
          )}
        </div>
      </main>
      <AppFooter variant="private" />
    </div>
  );
}
