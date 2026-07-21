import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, CircleDashed, Upload } from "lucide-react";
import { agentById } from "../../theme/agents";
import type { AgentReadinessItem, DocumentInventoryItem } from "../../utils/agentReadiness";

type Props = {
  loading: boolean;
  documents: DocumentInventoryItem[];
  advisors: AgentReadinessItem[];
};

function statusIcon(status: DocumentInventoryItem["status"]) {
  if (status === "ok") return <CheckCircle2 size={16} color="var(--mint-ink)" />;
  if (status === "processing") return <CircleDashed size={16} color="var(--butter-ink)" style={{ animation: "fgSpin 1s linear infinite" }} />;
  if (status === "partial") return <AlertTriangle size={16} color="var(--butter-ink)" />;
  return <AlertTriangle size={16} color="var(--peach-ink)" />;
}

function advisorTone(phase: AgentReadinessItem["phase"]) {
  if (phase === "analysis_ready" || phase === "document_ready_onboarding_complete") {
    return { fg: "var(--mint-ink)", bg: "var(--mint-soft)" };
  }
  if (phase === "document_processing") {
    return { fg: "var(--butter-ink)", bg: "var(--butter-soft)" };
  }
  if (phase === "document_ready_onboarding_incomplete") {
    return { fg: "var(--butter-ink)", bg: "var(--butter-soft)" };
  }
  return { fg: "var(--peach-ink)", bg: "var(--peach-soft)" };
}

export default function HubReadinessPanel({ loading, documents, advisors }: Props) {
  const navigate = useNavigate();

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, marginBottom: 32 }}>
      <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "20px 22px", boxShadow: "var(--shadow-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "var(--text-strong)" }}>מסמכים במערכת</h2>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--text-faint)" }}>סטטוס מסמכים</span>
        </div>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>טוען סטטוס מסמכים…</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {documents.map(doc => (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => navigate(doc.route)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    border: "1px solid var(--border-hair)",
                    background: "var(--surface-sunken)",
                    cursor: "pointer",
                    textAlign: "inherit",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ marginTop: 2 }}>{statusIcon(doc.status)}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}>{doc.label}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{doc.detail}</span>
                  </span>
                  <Upload size={14} color="var(--text-faint)" style={{ flex: "none", marginTop: 4 }} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "20px 22px", boxShadow: "var(--shadow-soft)" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 900, color: "var(--text-strong)" }}>מוכנות הסוכנים</h2>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>טוען מוכנות סוכנים…</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {advisors.map(item => {
              const agent = agentById(item.agentId);
              const tone = advisorTone(item.phase);
              const Icon = agent.Icon;
              return (
                <li key={item.agentId}>
                  <button
                    type="button"
                    onClick={() => navigate(item.route)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--border-hair)",
                      background: "var(--surface-sunken)",
                      cursor: "pointer",
                      textAlign: "inherit",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: agent.tone.soft, color: agent.tone.accent, display: "grid", placeItems: "center" }}>
                      <Icon size={18} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: "var(--text-strong)" }}>{agent.label}</span>
                      <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{item.detail}</span>
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: tone.fg, background: tone.bg, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && (
          <p style={{ margin: "14px 0 0", fontSize: 12, color: "var(--text-faint)", lineHeight: 1.5 }}>
            לאחר ייבוא מסמך, היכנסו לסוכן הרלוונטי להשלמת האונבורדינג המקצועי שלו.
          </p>
        )}
      </div>
    </section>
  );
}

