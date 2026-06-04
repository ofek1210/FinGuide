import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { streamChatWithAI } from "../../api/ai.api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: string;
  isStreaming?: boolean;
};

const promptSuggestions = [
  "כמה מסמכים הועלו החודש?",
  "תסכם לי את מצב המסמכים שלי",
  "איזו פעולה הכי חשובה כרגע?",
];

export default function DashboardChatPanel() {
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const streamAbortRef = useRef<(() => void) | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "שלום! איך אפשר לעזור לכם היום?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages]);

  useEffect(() => {
    return () => { streamAbortRef.current?.(); };
  }, []);

  const sendMessage = useCallback((forcedText?: string) => {
    const trimmed = (forcedText ?? chatInput).trim();
    if (!trimmed || isChatting) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatError("");
    setIsChatting(true);

    const assistantId = `assistant-${Date.now()}`;
    setChatMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", isStreaming: true },
    ]);

    const abort = streamChatWithAI(
      trimmed,
      [],
      null,
      (token) => {
        setChatMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: m.content + token } : m),
        );
      },
      (source) => {
        setChatMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false, source } : m),
        );
        setIsChatting(false);
      },
      (errMsg) => {
        setChatError(errMsg);
        setChatMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setIsChatting(false);
      },
    );

    streamAbortRef.current = abort;
  }, [chatInput, isChatting]);

  return (
    <article className="dashboard-card ai-card">
      <div className="ai-header">
        <div className="ai-icon">
          <MessageSquare aria-hidden="true" />
        </div>
        <div>
          <h3>צ׳אט AI פיננסי</h3>
          <p>שאלו כל שאלה על המסמכים שלכם</p>
        </div>
      </div>

      <div className="ai-chat">
        <div className="ai-chat-messages">
          {chatMessages.map((message) => (
            <div key={message.id} className={`ai-message ${message.role}`}>
              <span>
                {message.content}
                {message.isStreaming ? (
                  <span className="ai-cursor" aria-hidden="true">▋</span>
                ) : null}
              </span>
              {message.source && !message.isStreaming ? (
                <em className="ai-model">{message.source}</em>
              ) : null}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="ai-suggestions">
          {promptSuggestions.map((prompt) => (
            <button
              key={prompt}
              className="ai-suggestion"
              type="button"
              disabled={isChatting}
              onClick={() => sendMessage(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="ai-input">
          <input
            type="text"
            placeholder="כתבו שאלה..."
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                sendMessage();
              }
            }}
            disabled={isChatting}
          />
          <button
            className="ai-send"
            type="button"
            onClick={() => sendMessage()}
            disabled={isChatting || !chatInput.trim()}
          >
            שליחה
          </button>
        </div>
        {chatError ? <span className="ai-error">{chatError}</span> : null}
      </div>
    </article>
  );
}


type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: string;
};

const promptSuggestions = [
  "כמה מסמכים הועלו החודש?",
  "תסכם לי את מצב המסמכים שלי",
  "איזו פעולה הכי חשובה כרגע?",
];
