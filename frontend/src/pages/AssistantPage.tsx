import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PlanTabBar from "../components/tabs/PlanTabBar";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { renderMarkdown } from "../utils/renderMarkdown";
import {
  useAiChat,
  AI_PROMPT_SUGGESTIONS,
  isVoiceInputSupported,
} from "../assistant/AiChatProvider";
import { APP_ROUTES } from "../types/navigation";

export default function AssistantPage() {
  const navigate = useNavigate();
  const {
    messages,
    conversationId,
    conversations,
    isSending,
    isListening,
    error,
    sendMessage,
    clearChat,
    selectConversation,
    startVoiceInput,
    openPanel,
  } = useAiChat();

  const [input, setInput] = useState("");
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  const copyToClipboard = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  const handleSend = useCallback(
    (forcedText?: string) => {
      const text = (forcedText ?? input).trim();
      if (!text) return;
      setInput("");
      sendMessage(text);
    },
    [input, sendMessage],
  );

  const popOutToFloating = useCallback(() => {
    openPanel();
    navigate(APP_ROUTES.dashboard);
  }, [openPanel, navigate]);

  return (
    <div className="feature-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />
        <PlanTabBar />

        <section className="dashboard-card ai-card">
          <div className="ai-card-header">
            <div>
              <h1 className="feature-page-title">עוזר AI פיננסי</h1>
              <p className="feature-page-subtitle">
                שאל שאלות על שכר, פנסיה, מס, חריגות וסימולציות — מבוסס על הנתונים שלך.
              </p>
            </div>
            <div className="ai-card-actions">
              <button
                type="button"
                className="ai-clear-btn ai-popout-btn"
                onClick={popOutToFloating}
                title="פתח כצ'אט צף שמלווה אותך בכל האתר"
              >
                ⤢ צ'אט צף
              </button>
              <button
                type="button"
                className="ai-clear-btn"
                onClick={clearChat}
                title="נקה שיחה"
                disabled={isSending}
              >
                שיחה חדשה
              </button>
            </div>
          </div>

          {conversations.length > 1 ? (
            <div className="ai-conversation-list">
              <span className="ai-conversation-list-label">שיחות קודמות</span>
              {conversations.slice(0, 5).map((c) => (
                <button
                  key={c.conversationId}
                  type="button"
                  className={`ai-conversation-chip ${c.conversationId === conversationId ? "is-active" : ""}`}
                  onClick={() => selectConversation(c.conversationId)}
                >
                  {c.preview.slice(0, 40)}
                </button>
              ))}
            </div>
          ) : null}

          <div className="ai-chat">
            <div className="ai-chat-messages" ref={messagesContainerRef}>
              {hasMessages ? (
                messages.map((message) => (
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
                            {message.source === "claude"
                              ? "✦ Claude AI"
                              : message.source === "rule"
                                ? "⚡ מיידי"
                                : message.source}
                          </em>
                        ) : null}
                        {message.contextUsed?.length ? (
                          <div className="ai-context-pills">
                            {message.contextUsed.map((pill) => (
                              <span key={pill} className="ai-context-pill">
                                {pill}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="findings-placeholder">אין הודעות עדיין.</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="ai-suggestions">
              {AI_PROMPT_SUGGESTIONS.map((prompt) => (
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

            <div className="ai-input">
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

            {error ? <span className="ai-error">{error}</span> : null}
          </div>
        </section>

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
