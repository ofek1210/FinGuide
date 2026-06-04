import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  streamChatWithAI,
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
  isStreaming?: boolean;
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

// Check if the browser supports Web Speech API
const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition)
    : undefined;

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([defaultWelcome]);
  const [conversationId, setConversationId] = useState<string | null>(
    () => sessionStorage.getItem("finguide_conversation_id"),
  );
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<(() => void) | null>(null);
  const streamingIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      streamAbortRef.current?.();
    };
  }, []);

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  const copyToClipboard = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  const clearChat = useCallback(() => {
    streamAbortRef.current?.();
    setMessages([defaultWelcome]);
    setConversationId(null);
    sessionStorage.removeItem("finguide_conversation_id");
    setError("");
  }, []);

  const startNewConversation = useCallback(() => {
    clearChat();
  }, [clearChat]);

  // Voice input using Web Speech API (Hebrew)
  const startVoiceInput = useCallback(() => {
    if (!SpeechRecognitionAPI || isListening || isSending) return;
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "he-IL";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) setInput(transcript);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  }, [isListening, isSending]);

  // Streaming send
  const sendMessage = useCallback((forcedText?: string) => {
    const trimmed = (forcedText ?? input).trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    // Capture current messages BEFORE state update for history building
    const currentMessages = messages;

    setMessages((prev) => {
      const next = [...prev, userMessage];
      saveMessages(next);
      return next;
    });
    setInput("");
    setError("");
    setIsSending(true);

    const history = buildHistory(currentMessages);
    const assistantId = `assistant-${Date.now()}`;
    streamingIdRef.current = assistantId;

    // Insert an empty streaming placeholder immediately
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", isStreaming: true },
    ]);

    const abort = streamChatWithAI(
      trimmed,
      history,
      conversationId,
      (token) => {
        // Append each token to the streaming message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + token } : m,
          ),
        );
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      },
      (source, convId) => {
        // Mark streaming done
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false, source } : m,
          ),
        );
        setConversationId(convId);
        setIsSending(false);
        streamingIdRef.current = null;
      },
      (errMsg) => {
        setError(errMsg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setIsSending(false);
        streamingIdRef.current = null;
      },
    );

    streamAbortRef.current = abort;
  }, [input, isSending, messages, conversationId]);

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
                    <span>
                      {message.content}
                      {message.isStreaming ? (
                        <span className="ai-cursor" aria-hidden="true">▋</span>
                      ) : null}
                    </span>
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
                  onClick={() => sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="ai-input">
              {SpeechRecognitionAPI ? (
                <button
                  type="button"
                  className={`ai-voice-btn${isListening ? " is-listening" : ""}`}
                  onClick={startVoiceInput}
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
                    sendMessage();
                  }
                }}
                disabled={isSending}
              />
              <button
                className="ai-send"
                type="button"
                onClick={() => sendMessage()}
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

