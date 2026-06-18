import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import {
  useAiChat,
  AI_PROMPT_SUGGESTIONS,
  isVoiceInputSupported,
} from "../assistant/AiChatProvider";
import { APP_ROUTES } from "../types/navigation";
import { renderMarkdown } from "../utils/renderMarkdown";

export default function FloatingAssistant() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    messages,
    isSending,
    isListening,
    error,
    isPanelOpen,
    pageContext,
    closePanel,
    togglePanel,
    sendMessage,
    clearChat,
    startVoiceInput,
  } = useAiChat();

  const [input, setInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpen = isPanelOpen;

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
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closePanel]);

  const handleSend = useCallback(
    (forcedText?: string) => {
      const text = (forcedText ?? input).trim();
      if (!text) return;
      setInput("");
      sendMessage(text);
    },
    [input, sendMessage],
  );

  const copyToClipboard = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  // Show only for authenticated users, and not on the dedicated assistant page.
  if (auth.status !== "authenticated") return null;
  if (location.pathname === APP_ROUTES.assistant) return null;

  return (
    <div className="floating-assistant" dir="rtl">
      {isOpen && (
        <section
          className="floating-assistant-panel"
          role="dialog"
          aria-label="עוזר AI פיננסי"
        >
          <header className="floating-assistant-header">
            <div className="floating-assistant-title">
              <span className="floating-assistant-badge" aria-hidden="true">
                ✦
              </span>
              <span>עוזר AI פיננסי</span>
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
              <button
                type="button"
                className="floating-assistant-icon-btn"
                title="פתח בעמוד מלא"
                aria-label="פתח בעמוד מלא"
                onClick={() => {
                  closePanel();
                  navigate(APP_ROUTES.assistant);
                }}
              >
                ⤢
              </button>
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

          <div className="ai-chat-messages floating-assistant-messages" ref={messagesContainerRef}>
            {messages.map((message) => (
              <div key={message.id} className={`ai-message ${message.role}`}>
                <span
                  // Safe: content is from our own AI (markdown), not user-supplied HTML
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                />
                {message.isStreaming ? (
                  <span className="ai-cursor" aria-hidden="true">
                    ▋
                  </span>
                ) : null}
                {message.role === "assistant" && !message.isStreaming && (
                  <div className="ai-message-actions">
                    <button
                      type="button"
                      className="ai-copy-btn"
                      onClick={() => copyToClipboard(message.content)}
                      title="העתק תשובה"
                    >
                      העתק תשובה
                    </button>
                    {message.source ? (
                      <em className={`ai-model source-${message.source}`}>
                        {message.source === "rule"
                          ? "⚡ מיידי"
                          : message.source.startsWith("claude")
                            ? "✦ Claude AI"
                            : message.source === "ollama" ||
                                message.source.startsWith("llama")
                              ? "✦ AI מקומי"
                              : message.source}
                      </em>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="ai-suggestions floating-assistant-suggestions">
            {AI_PROMPT_SUGGESTIONS.slice(0, 4).map((prompt) => (
              <button
                key={prompt}
                className="ai-suggestion"
                type="button"
                disabled={isSending}
                onClick={() => handleSend(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="ai-input floating-assistant-input">
            {isVoiceInputSupported ? (
              <button
                type="button"
                className={`ai-voice-btn${isListening ? " is-listening" : ""}`}
                onClick={() => startVoiceInput(setInput)}
                disabled={isSending || isListening}
                title={isListening ? "מאזין..." : "דבר בעברית"}
                aria-label={isListening ? "מאזין לדיבור" : "הפעל קלט קולי"}
              >
                {isListening ? "🔴" : "🎤"}
              </button>
            ) : null}
            <input
              ref={inputRef}
              type="text"
              placeholder="כתבו שאלה..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSend();
                }
              }}
              disabled={isSending}
            />
            <button
              className="ai-send"
              type="button"
              onClick={() => handleSend()}
              disabled={isSending || !input.trim()}
            >
              שליחה
            </button>
          </div>

          {error ? <span className="ai-error floating-assistant-error">{error}</span> : null}
        </section>
      )}

      <button
        type="button"
        className={`floating-assistant-launcher ${isOpen ? "is-open" : ""}`}
        onClick={togglePanel}
        aria-expanded={isOpen}
        aria-label={isOpen ? "סגור עוזר AI" : "פתח עוזר AI"}
        title={isOpen ? "סגור עוזר AI" : "עוזר AI"}
      >
        {isOpen ? "✕" : "✦"}
      </button>
    </div>
  );
}
