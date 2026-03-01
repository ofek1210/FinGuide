import { useMemo, useState } from "react";
import { chatWithAI } from "../api/ai.api";
import PrivateTopbar from "../components/PrivateTopbar";
import Loader from "../components/ui/Loader";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
};

const promptSuggestions = [
  "תסכם לי את מצב המסמכים שלי",
  "איזה פעולות מומלץ לבצע החודש?",
  "מה נראה חריג במסמכים שהעליתי?",
] as const;

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "שלום, אני כאן כדי לעזור לכם להבין את המסמכים הפיננסיים שלכם.",
    },
  ]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const hasMessages = useMemo(() => messages.length > 0, [messages.length]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError("");
    setIsSending(true);

    const response = await chatWithAI(trimmed);
    if (!response.success || !response.answer) {
      setError(response.message || "לא הצלחנו לקבל תשובה מהעוזר.");
      setIsSending(false);
      return;
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response.answer,
      model: response.model,
    };
    setMessages((prev) => [...prev, assistantMessage]);
    setIsSending(false);
  };

  return (
    <div className="feature-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <section className="dashboard-card ai-card">
          <h1 className="feature-page-title">עוזר AI פיננסי</h1>
          <p className="feature-page-subtitle">
            אפשר לשאול על תלושים, סטטוסים של מסמכים והכוונה כללית.
          </p>

          <div className="ai-chat">
            <div className="ai-chat-messages">
              {hasMessages ? (
                messages.map((message) => (
                  <div key={message.id} className={`ai-message ${message.role}`}>
                    <span>{message.content}</span>
                    {message.model ? <em className="ai-model">{message.model}</em> : null}
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
            </div>

            <div className="ai-suggestions">
              {promptSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  className="ai-suggestion"
                  type="button"
                  onClick={() => setInput(prompt)}
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
      </div>
    </div>
  );
}
