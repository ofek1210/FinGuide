import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chatWithAI, type ConversationMessage } from "../api/ai.api";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";

const AI_CHAT_STORAGE_KEY = "finguide_ai_chat";
const MAX_HISTORY_TURNS = 6;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: string;
};

const defaultWelcome: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "שלום, אני כאן כדי לעזור לכם להבין את המסמכים הפיננסיים שלכם.",
};

const promptSuggestions = [
  "תסכם לי את מצב המסמכים שלי",
  "איזה פעולות מומלץ לבצע החודש?",
  "מה נראה חריג במסמכים שהעליתי?",
] as const;

function loadStoredMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(AI_CHAT_STORAGE_KEY);
    if (!raw) return [defaultWelcome];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as ChatMessage[];
    }
  } catch {
    /* ignore */
  }
  return [defaultWelcome];
}

function saveMessages(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    /* ignore */
  }
}

function buildHistory(messages: ChatMessage[]): ConversationMessage[] {
  return messages
    .filter((m) => m.id !== "welcome")
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content }));
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadStoredMessages);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persist messages to sessionStorage
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Auto-scroll to bottom when messages update or while loading
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  const copyToClipboard = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([defaultWelcome]);
    setError("");
  }, []);

  // Accepts optional text so suggestion chips can auto-send without waiting for state update
  const sendMessage = async (forcedText?: string) => {
    const trimmed = (forcedText ?? input).trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => {
      const next = [...prev, userMessage];
      saveMessages(next);
      return next;
    });
    setInput("");
    setError("");
    setIsSending(true);

    // Build history from current messages (before appending the new user message)
    const history = buildHistory(messages);

    const response = await chatWithAI(trimmed, history);
    if (!response.success || !response.answer) {
      setError(response.message || "לא הצלחנו לקבל תשובה מהעוזר.");
      setIsSending(false);
      return;
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response.answer,
      source: response.source,
    };
    setMessages((prev) => [...prev, assistantMessage]);
    setIsSending(false);
  };

  return (
    <div className="feature-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <section className="dashboard-card ai-card">
          <div className="ai-card-header">
            <div>
              <h1 className="feature-page-title">עוזר AI פיננסי</h1>
              <p className="feature-page-subtitle">
                אפשר לשאול על תלושים, סטטוסים של מסמכים והכוונה כללית.
              </p>
            </div>
            <button
              type="button"
              className="ai-clear-btn"
              onClick={clearChat}
              title="נקה שיחה"
              disabled={isSending}
            >
              נקה שיחה
            </button>
          </div>

          <div className="ai-chat">
            <div className="ai-chat-messages">
              {hasMessages ? (
                messages.map((message) => (
                  <div key={message.id} className={`ai-message ${message.role}`}>
                    <span>{message.content}</span>
                    {message.role === "assistant" && (
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
                          <em className="ai-model">{message.source}</em>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="findings-placeholder">אין הודעות עדיין.</div>
              )}
              {isSending ? (
                <div className="ai-message assistant is-loading">
                  <Loader />
                </div>
              ) : null}
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            <div className="ai-suggestions">
              {promptSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  className="ai-suggestion"
                  type="button"
                  disabled={isSending}
                  onClick={() => void sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="ai-input">
              <input
                type="text"
                placeholder="כתבו שאלה..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                disabled={isSending}
              />
              <button
                className="ai-send"
                type="button"
                onClick={() => void sendMessage()}
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
