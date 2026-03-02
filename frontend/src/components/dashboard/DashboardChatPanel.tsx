import { MessageSquare } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { chatWithAI } from "../../api/ai.api";
import Loader from "../ui/Loader";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
};

const promptSuggestions = [
  "כמה מסמכים הועלו החודש?",
  "תסכם לי את מצב המסמכים שלי",
  "איזו פעולה הכי חשובה כרגע?",
];

export default function DashboardChatPanel() {
  const chatEndRef = useRef<HTMLDivElement | null>(null);
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
  }, [chatMessages, isChatting]);

  const handleSendChat = async () => {
    const trimmed = chatInput.trim();
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

    const response = await chatWithAI(trimmed);
    if (!response.success || !response.answer) {
      setChatError(response.message || "לא הצלחנו לקבל תשובה מהבוט.");
      setIsChatting(false);
      return;
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response.answer,
      model: response.model,
    };

    setChatMessages((prev) => [...prev, assistantMessage]);
    setIsChatting(false);
  };

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
              <span>{message.content}</span>
              {message.model ? <em className="ai-model">{message.model}</em> : null}
            </div>
          ))}
          {isChatting ? (
            <div className="ai-message assistant is-loading">
              <Loader />
            </div>
          ) : null}
          <div ref={chatEndRef} />
        </div>

        <div className="ai-suggestions">
          {promptSuggestions.map((prompt) => (
            <button
              key={prompt}
              className="ai-suggestion"
              type="button"
              onClick={() => setChatInput(prompt)}
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
                void handleSendChat();
              }
            }}
            disabled={isChatting}
          />
          <button
            className="ai-send"
            type="button"
            onClick={handleSendChat}
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
