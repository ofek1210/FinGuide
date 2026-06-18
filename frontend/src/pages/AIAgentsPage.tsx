import { useState, useRef, useEffect } from "react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { askAgent } from "../api/agents.api";
import { renderMarkdown } from "../utils/renderMarkdown";
import "./AIAgentsPage.css";

type Message = {
  role: "user" | "assistant";
  content: string;
  agent?: string;
  classification?: string;
  sources?: Array<{ title?: string; category?: string; score: number }>;
};

const AGENT_LABELS: Record<string, { label: string; icon: string }> = {
  payslip_analysis: { label: "סוכן ניתוח תלוש", icon: "📄" },
  pension_advisor: { label: "יועץ פנסיוני", icon: "🏦" },
  financial_analysis: { label: "מנתח פיננסי", icon: "📊" },
  financial_planning: { label: "מתכנן פיננסי", icon: "🎯" },
  insurance_benefits: { label: "יועץ ביטוח", icon: "🛡️" },
  orchestrator: { label: "עוזר כללי", icon: "🤖" },
};

const QUICK_PROMPTS = [
  { text: "תסביר לי את התלוש שלי", agent: "payslip_analysis" },
  { text: "האם הפנסיה שלי תקינה?", agent: "pension_advisor" },
  { text: "תן לי ניתוח פיננסי", agent: "financial_analysis" },
  { text: "איך אני יכול לחסוך יותר?", agent: "financial_planning" },
  { text: "אילו ביטוחים אני צריך?", agent: "insurance_benefits" },
];

export default function AIAgentsPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const message = (text || input).trim();
    if (!message || isSending) return;

    const userMessage: Message = { role: "user", content: message };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const result = await askAgent(message, history);

      if (result.ok && result.data.data) {
        const { answer, agent, classification, sources } = result.data.data;
        const assistantMessage: Message = {
          role: "assistant",
          content: answer,
          agent,
          classification,
          sources,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "שגיאה בתקשורת עם מערכת הסוכנים. נסה שנית." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "שגיאה בלתי צפויה. נסה שנית." },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="private-layout" dir="rtl">
      <PrivateTopbar />
      <main className="private-main ai-agents-page">
        <h1 className="ai-agents-title">🤖 מערכת סוכני AI</h1>
        <p className="ai-agents-subtitle">
          שאל שאלה — המערכת תבחר אוטומטית את הסוכן המתאים ביותר לענות
        </p>

        {/* Agent cards */}
        <div className="ai-agents-grid">
          {Object.entries(AGENT_LABELS).filter(([k]) => k !== "orchestrator").map(([key, { label, icon }]) => (
            <div key={key} className="ai-agents-card">
              <div className="ai-agents-card-icon">{icon}</div>
              <div className="ai-agents-card-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Quick prompts */}
        {messages.length === 0 && (
          <div className="ai-agents-prompts">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt.text}
                onClick={() => handleSend(prompt.text)}
                className="ai-agents-prompt-btn"
              >
                {AGENT_LABELS[prompt.agent]?.icon} {prompt.text}
              </button>
            ))}
          </div>
        )}

        {/* Chat messages */}
        <div className="ai-agents-chat">
          {messages.length === 0 && (
            <p className="ai-agents-empty">
              👋 שלום! שאל אותי כל שאלה פיננסית — מערכת הסוכנים תנתב אותך לסוכן המתאים.
            </p>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`ai-agents-msg ${msg.role === "user" ? "ai-agents-msg--user" : "ai-agents-msg--assistant"}`}
            >
              <div className="ai-agents-msg-bubble">
                {msg.role === "assistant" ? (
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                ) : (
                  msg.content
                )}
              </div>

              {/* Agent badge */}
              {msg.agent && (
                <div className="ai-agents-badge">
                  <span>{AGENT_LABELS[msg.agent]?.icon || "🤖"}</span>
                  <span>{AGENT_LABELS[msg.agent]?.label || msg.agent}</span>
                  {msg.sources && msg.sources.length > 0 && (
                    <span style={{ marginRight: 8 }}>
                      | 📚 {msg.sources.length} מקורות
                    </span>
                  )}
                </div>
              )}

              {/* Sources detail */}
              {msg.sources && msg.sources.length > 0 && (
                <details className="ai-agents-sources">
                  <summary>📚 מקורות מידע</summary>
                  <ul>
                    {msg.sources.map((s, i) => (
                      <li key={i}>
                        {s.title || s.category || "מאגר ידע"}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}

          {isSending && (
            <div className="ai-agents-thinking">
              ⏳ הסוכן חושב...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="ai-agents-form"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="שאל שאלה פיננסית..."
            disabled={isSending}
            className="ai-agents-input"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="ai-agents-send-btn"
          >
            שלח
          </button>
        </form>

        <p className="ai-agents-disclaimer">
          ⚠️ המידע ניתן לצורכי לימוד בלבד ואינו מהווה ייעוץ פיננסי מקצועי.
        </p>
      </main>
      <AppFooter variant="private" />
    </div>
  );
}
