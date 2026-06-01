import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  chatWithAI,
  getChatHistory,
  listConversations,
  type ConversationMessage,
  type ConversationSummary,
} from "../api/ai.api";
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
  contextUsed?: string[];
};

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

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([defaultWelcome]);
  const [conversationId, setConversationId] = useState<string | null>(
    () => sessionStorage.getItem("finguide_conversation_id"),
  );
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load server history when conversationId exists
  useEffect(() => {
    if (!conversationId) return;
    void getChatHistory(conversationId).then(res => {
      if (!res.success || !res.data?.length) return;
      const loaded: ChatMessage[] = res.data
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => ({
          id: m._id,
          role: m.role as "user" | "assistant",
          content: m.content,
          source: m.metadata?.model ?? m.metadata?.intent,
          contextUsed: m.metadata?.contextUsed,
        }));
      if (loaded.length) setMessages(loaded);
    });
  }, [conversationId]);

  useEffect(() => {
    void listConversations().then(res => {
      if (res.success && res.data) setConversations(res.data);
    });
  }, [messages.length]);

  useEffect(() => {
    if (conversationId) sessionStorage.setItem("finguide_conversation_id", conversationId);
  }, [conversationId]);

  // Persist messages to sessionStorage (fallback)
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
    setConversationId(null);
    sessionStorage.removeItem("finguide_conversation_id");
    setError("");
  }, []);

  const startNewConversation = useCallback(() => {
    clearChat();
  }, [clearChat]);

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

    const response = await chatWithAI(trimmed, history, conversationId ?? undefined);
    if (!response.success || !response.answer) {
      setError(response.message || "לא הצלחנו לקבל תשובה מהעוזר.");
      setIsSending(false);
      return;
    }

    if (response.conversationId) {
      setConversationId(response.conversationId);
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response.answer,
      source: response.source,
      contextUsed: response.contextUsed,
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
            <div className="ai-card-actions">
              <button type="button" className="ai-clear-btn" onClick={startNewConversation} disabled={isSending}>
                שיחה חדשה
              </button>
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
          </div>

          {conversations.length > 1 ? (
            <div className="ai-conversation-list">
              {conversations.slice(0, 5).map(c => (
                <button
                  key={c.conversationId}
                  type="button"
                  className={`ai-conversation-chip ${c.conversationId === conversationId ? "is-active" : ""}`}
                  onClick={() => setConversationId(c.conversationId)}
                >
                  {c.preview.slice(0, 40)}
                </button>
              ))}
            </div>
          ) : null}

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
                        {message.contextUsed?.length ? (
                          <div className="ai-context-pills">
                            {message.contextUsed.map(pill => (
                              <span key={pill} className="ai-context-pill">{pill}</span>
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
