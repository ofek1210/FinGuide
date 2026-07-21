import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  useAiChat,
  isVoiceInputSupported,
} from "../assistant/AiChatProvider";
import { APP_ROUTES } from "../types/navigation";
import { renderMarkdown } from "../utils/renderMarkdown";

function formatRateLimitWait(until: number | null): string | null {
  if (!until) return null;
  const sec = Math.max(0, Math.ceil((until - Date.now()) / 1000));
  if (sec <= 0) return null;
  if (sec < 60) return `${sec} שניות`;
  const min = Math.ceil(sec / 60);
  return min === 1 ? "דקה" : `${min} דקות`;
}
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

function sourceBadgeLabel(source?: string): string {
  if (!source) return "";
  if (source === "rule") return "מיידי";
  if (source.startsWith("claude")) return "Claude AI";
  if (source === "ollama" || source.startsWith("llama")) return "AI מקומי";
  return source;
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

function formatContextUsed(contextUsed?: string[]): string | null {
  if (!contextUsed?.length) return null;
  const labels = contextUsed.map((c) => {
    if (c === "profile") return "פרופיל";
    if (c === "latest payslip") return "תלוש אחרון";
    if (c === "page context") return "מסך נוכחי";
    if (c.includes("findings")) return "ממצאים";
    if (c.includes("insights")) return "תובנות";
    if (c.includes("recommendations")) return "המלצות";
    if (c.includes("documents")) return "מסמכים";
    return c;
  });
  return `מבוסס על: ${labels.join(" · ")}`;
}

export default function FloatingAssistant() {
  const auth = useAuth();
  const location = useLocation();
  const {
    messages,
    conversationId,
    conversations,
    isSending,
    isListening,
    error,
    isPanelOpen,
    pageContext,
    lastFailedUserMessage,
    historyHydrated,
    rateLimitedUntil,
    closePanel,
    togglePanel,
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
    suggestions,
  } = useAiChat();

  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [copyToastId, setCopyToastId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  const isOpen = isPanelOpen;
  const rateLimited = Boolean(rateLimitedUntil && Date.now() < rateLimitedUntil);
  const rateLimitWait = formatRateLimitWait(rateLimitedUntil);
  const showSuggestions =
    historyHydrated &&
    !isSending &&
    messages.filter((m) => m.id !== "welcome").length === 0;

  useEffect(() => {
    if (isOpen && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isSending, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      launcherRef.current?.focus();
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setHistoryOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (historyOpen) {
          setHistoryOpen(false);
          return;
        }
        closePanel();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closePanel, historyOpen]);

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

  const handleSend = useCallback(
    (forcedText?: string) => {
      const text = (forcedText ?? input).trim();
      if (!text || rateLimited) return;
      setInput("");
      sendMessage(text);
    },
    [input, sendMessage, rateLimited],
  );

  const copyToClipboard = useCallback((text: string, messageId: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopyToastId(messageId);
      window.setTimeout(() => setCopyToastId((id) => (id === messageId ? null : id)), 1600);
    });
  }, []);

  const handleSelectConversation = useCallback(
    (id: string) => {
      selectConversation(id);
      setHistoryOpen(false);
      setRenamingId(null);
      setPendingDeleteId(null);
    },
    [selectConversation],
  );

  const handleDeleteConversation = useCallback(
    async (id: string, event: React.MouseEvent) => {
      event.stopPropagation();
      if (pendingDeleteId !== id) {
        setPendingDeleteId(id);
        return;
      }
      setPendingDeleteId(null);
      await deleteConversation(id);
    },
    [deleteConversation, pendingDeleteId],
  );

  const handleStartRename = useCallback(
    (id: string, currentTitle: string | undefined, event: React.MouseEvent) => {
      event.stopPropagation();
      setRenamingId(id);
      setRenameDraft(currentTitle || "");
      setPendingDeleteId(null);
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

  const formatLatency = (ms?: number | null): string | null => {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
    if (ms < 1000) return `${Math.round(ms)}מ״ש`;
    return `${(ms / 1000).toFixed(1)}שנ׳`;
  };

  const latestAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && !m.isStreaming && m.source);
  const headerSourceLabel = sourceBadgeLabel(latestAssistant?.source);
  const degradedText = degradedBannerText(latestAssistant?.degradedReason);

  if (auth.status !== "authenticated") return null;
  // Full-page assistant route hosts the same chat inline — hide floating bubble there.
  if (
    location.pathname === APP_ROUTES.assistant ||
    location.pathname === APP_ROUTES.aiAgents ||
    location.pathname === APP_ROUTES.welcome ||
    location.pathname === "/dev/welcome"
  ) {
    return null;
  }

  return (
    <div className="floating-assistant" dir="rtl">
      {isOpen && (
        <section
          ref={panelRef}
          className="floating-assistant-panel"
          role="dialog"
          aria-modal="true"
          aria-label="עוזר AI פיננסי"
        >
          <header className="floating-assistant-header">
            <div className="floating-assistant-title">
              <span className="floating-assistant-badge" aria-hidden="true">
                ✦
              </span>
              <div className="floating-assistant-title-text">
                <span>עוזר AI פיננסי</span>
                {headerSourceLabel ? (
                  <em
                    className={`floating-assistant-source-badge source-${
                      latestAssistant?.source?.startsWith("claude")
                        ? "claude"
                        : latestAssistant?.source === "rule"
                          ? "rule"
                          : "ollama"
                    }`}
                  >
                    {headerSourceLabel}
                    {formatLatency(latestAssistant?.latencyMs)
                      ? ` · ${formatLatency(latestAssistant?.latencyMs)}`
                      : ""}
                  </em>
                ) : null}
              </div>
            </div>
            <div className="floating-assistant-header-actions">
              <button
                type="button"
                className="floating-assistant-icon-btn"
                title="שיחה חדשה"
                aria-label="שיחה חדשה"
                onClick={clearChat}
                disabled={isSending}
              >
                ⟳
              </button>
              <div className="floating-assistant-history" ref={historyRef}>
                <button
                  type="button"
                  className="floating-assistant-icon-btn"
                  title="שיחות קודמות"
                  aria-label="שיחות קודמות"
                  aria-expanded={historyOpen}
                  aria-haspopup="listbox"
                  onClick={() => setHistoryOpen((open) => !open)}
                  disabled={isSending}
                >
                  ☰
                </button>
                {historyOpen ? (
                  <div
                    className="floating-assistant-history-menu"
                    role="listbox"
                    aria-label="שיחות קודמות"
                  >
                    <button
                      type="button"
                      className="floating-assistant-history-new"
                      onClick={() => {
                        clearChat();
                        setHistoryOpen(false);
                      }}
                    >
                      ＋ שיחה חדשה
                    </button>
                    {conversations.length === 0 ? (
                      <div className="floating-assistant-history-empty">
                        אין שיחות קודמות
                      </div>
                    ) : (
                      conversations.map((c) => (
                        <div
                          key={c.conversationId}
                          className={`floating-assistant-history-row${
                            c.conversationId === conversationId ? " is-active" : ""
                          }`}
                        >
                          {renamingId === c.conversationId ? (
                            <input
                              className="floating-assistant-history-rename-input"
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
                              role="option"
                              aria-selected={c.conversationId === conversationId}
                              className="floating-assistant-history-item"
                              onClick={() => handleSelectConversation(c.conversationId)}
                            >
                              <span>
                                {formatConversationPreview(c.title, c.preview, c.updatedAt)}
                              </span>
                              {c.degraded || c.lastSource === "ollama" ? (
                                <span className="floating-assistant-history-meta">מקומי</span>
                              ) : null}
                            </button>
                          )}
                          <button
                            type="button"
                            className="floating-assistant-history-rename"
                            aria-label="שנה שם שיחה"
                            title="שנה שם"
                            onClick={(e) => handleStartRename(c.conversationId, c.title, e)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className={`floating-assistant-history-delete${
                              pendingDeleteId === c.conversationId ? " is-confirm" : ""
                            }`}
                            aria-label={
                              pendingDeleteId === c.conversationId
                                ? "אישור מחיקה"
                                : "מחק שיחה"
                            }
                            title={
                              pendingDeleteId === c.conversationId ? "לחצו שוב לאישור" : "מחק שיחה"
                            }
                            onClick={(e) => void handleDeleteConversation(c.conversationId, e)}
                          >
                            {pendingDeleteId === c.conversationId ? "!" : "×"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="floating-assistant-icon-btn"
                title="סגור"
                aria-label="סגור"
                onClick={closePanel}
              >
                ✕
              </button>
            </div>
          </header>

          {pageContext ? (
            <div className="floating-assistant-context" title="ההקשר שהעוזר מודע אליו">
              <span aria-hidden="true">📍</span>
              <span>{pageContext}</span>
            </div>
          ) : null}

          {degradedText ? (
            <div className="floating-assistant-degraded-banner" role="status">
              {degradedText}
            </div>
          ) : null}

          {error ? (
            <div className="floating-assistant-error-banner" role="alert">
              <span>
                {error}
                {rateLimited && rateLimitWait ? ` (נותרו ${rateLimitWait})` : ""}
              </span>
              {lastFailedUserMessage ? (
                <button
                  type="button"
                  className="floating-assistant-retry-btn"
                  onClick={retryLastFailed}
                  disabled={isSending || rateLimited}
                >
                  נסה שוב
                </button>
              ) : null}
            </div>
          ) : null}

          {feedbackToast ? (
            <div className="floating-assistant-toast" role="status">
              {feedbackToast}
            </div>
          ) : null}

          {!historyHydrated ? (
            <div className="floating-assistant-loading" aria-live="polite">
              טוען שיחה…
            </div>
          ) : null}

          <div
            className="ai-chat-messages floating-assistant-messages"
            ref={messagesContainerRef}
            aria-live="polite"
            aria-busy={isSending || !historyHydrated}
            aria-relevant="additions"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`ai-message ${message.role}${
                  message.isStreaming && !message.content ? " is-preparing" : ""
                }`}
              >
                {message.isStreaming && !message.content ? (
                  <span className="floating-assistant-preparing">
                    מכין תשובה…
                  </span>
                ) : message.isStreaming ? (
                  <span className="floating-assistant-stream-plain">{message.content}</span>
                ) : (
                  <span
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                  />
                )}
                {message.isStreaming && message.content ? (
                  <span className="ai-cursor" aria-hidden="true">
                    ▋
                  </span>
                ) : null}
                {message.role === "assistant" && !message.isStreaming && message.content ? (
                  <div className="ai-message-actions">
                    <button
                      type="button"
                      className="ai-copy-btn"
                      onClick={() => copyToClipboard(message.content, message.id)}
                      title="העתק תשובה"
                      aria-label="העתק תשובה"
                    >
                      {copyToastId === message.id ? "הועתק ✓" : "העתק תשובה"}
                    </button>
                    {message.id !== "welcome" && !message.id.startsWith("assistant-") ? (
                      <span className="ai-feedback-btns">
                        <button
                          type="button"
                          className={message.feedbackRating === 1 ? "is-active" : ""}
                          aria-label="תשובה מועילה"
                          title="מועיל"
                          onClick={() => void rateMessage(message.id, 1)}
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          className={message.feedbackRating === -1 ? "is-active" : ""}
                          aria-label="תשובה לא מועילה"
                          title="לא מועיל"
                          onClick={() => void rateMessage(message.id, -1)}
                        >
                          👎
                        </button>
                      </span>
                    ) : null}
                    {message.source ? (
                      <em
                        className={`ai-model source-${
                          message.source.startsWith("claude")
                            ? "claude"
                            : message.source === "rule"
                              ? "rule"
                              : "ollama"
                        }`}
                      >
                        {message.source === "rule"
                          ? "⚡ מיידי"
                          : message.source.startsWith("claude")
                            ? "✦ Claude AI"
                            : message.source === "ollama" ||
                                message.source.startsWith("llama")
                              ? "✦ AI מקומי"
                              : message.source}
                        {formatLatency(message.latencyMs)
                          ? ` · ${formatLatency(message.latencyMs)}`
                          : ""}
                      </em>
                    ) : null}
                    {formatContextUsed(message.contextUsed) ? (
                      <span className="floating-assistant-context-used">
                        {formatContextUsed(message.contextUsed)}
                      </span>
                    ) : null}
                    {message.citations?.length ? (
                      <span className="floating-assistant-citations">
                        {message.citations.map((c) =>
                          c.href ? (
                            c.href.startsWith("/") ? (
                              <Link key={`${c.type}-${c.label}`} to={c.href}>
                                {c.label}
                              </Link>
                            ) : (
                              <a key={`${c.type}-${c.label}`} href={c.href}>
                                {c.label}
                              </a>
                            )
                          ) : (
                            <span key={`${c.type}-${c.label}`}>{c.label}</span>
                          ),
                        )}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {showSuggestions ? (
            <div className="ai-suggestions floating-assistant-suggestions">
              {suggestions.map((prompt) => (
                <button
                  key={prompt}
                  className="ai-suggestion"
                  type="button"
                  disabled={isSending || rateLimited || !historyHydrated}
                  onClick={() => handleSend(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <div className="ai-input floating-assistant-input">
            {isVoiceInputSupported ? (
              <button
                type="button"
                className={`ai-voice-btn${isListening ? " is-listening" : ""}`}
                onClick={() =>
                  isListening ? stopVoiceInput() : startVoiceInput(setInput)
                }
                disabled={isSending || rateLimited || !historyHydrated}
                title={isListening ? "עצור האזנה" : "דבר בעברית"}
                aria-label={isListening ? "עצור קלט קולי" : "הפעל קלט קולי"}
              >
                {isListening ? "⏹" : "🎤"}
              </button>
            ) : null}
            <input
              ref={inputRef}
              type="text"
              placeholder={
                rateLimited && rateLimitWait
                  ? `המתינו עוד ${rateLimitWait}…`
                  : !historyHydrated
                    ? "טוען שיחה…"
                    : "כתבו שאלה..."
              }
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSend();
                }
              }}
              disabled={isSending || rateLimited || !historyHydrated}
            />
            {isSending ? (
              <button
                className="ai-send ai-stop"
                type="button"
                onClick={stopGeneration}
                title="עצור יצירת תשובה"
                aria-label="עצור"
              >
                עצור
              </button>
            ) : (
              <button
                className="ai-send"
                type="button"
                onClick={() => handleSend()}
                disabled={rateLimited || !historyHydrated || !input.trim()}
              >
                שליחה
              </button>
            )}
          </div>
        </section>
      )}

      <button
        ref={launcherRef}
        type="button"
        className={`floating-assistant-launcher ${isOpen ? "is-open" : ""}`}
        onClick={togglePanel}
        aria-expanded={isOpen}
        aria-label={
          isOpen
            ? "סגור עוזר AI"
            : rateLimited && rateLimitWait
              ? `עוזר AI — המתינו עוד ${rateLimitWait}`
              : "פתח עוזר AI"
        }
        title={
          isOpen
            ? "סגור עוזר AI"
            : rateLimited && rateLimitWait
              ? `המתינו עוד ${rateLimitWait}`
              : "עוזר AI"
        }
      >
        {isOpen ? <X size={22} strokeWidth={2.4} /> : <Sparkles size={23} strokeWidth={2} />}
      </button>
    </div>
  );
}
