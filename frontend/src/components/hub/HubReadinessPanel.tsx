import { useNavigate } from "react-router-dom";
import { AlertTriangle, Check, CircleDashed, Upload } from "lucide-react";
import { agentById } from "../../theme/agents";
import type { AgentReadinessItem, DocumentInventoryItem } from "../../utils/agentReadiness";

/* ============================================================
   HubReadinessPanel — two command panels: document status (with a
   colored state tile + upload affordance per row) and agent
   readiness (title/sub + a state tag). Matches the design-system
   Hub: mono section labels, sunken rows, tinted state tiles.
   ============================================================ */

const MONO = "'SF Mono',ui-monospace,'Cascadia Mono',Consolas,monospace";

const CARD: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border-hair)",
  borderRadius: "var(--radius)",
  padding: "20px 22px",
  boxShadow: "var(--shadow-soft)",
};

type Props = {
  loading: boolean;
  documents: DocumentInventoryItem[];
  advisors: AgentReadinessItem[];
};

function docTile(status: DocumentInventoryItem["status"]): { bg: string; fg: string; icon: React.ReactNode } {
  if (status === "ok") return { bg: "var(--mint-soft)", fg: "var(--mint-ink)", icon: <Check size={16} strokeWidth={2.6} /> };
  if (status === "processing") return { bg: "var(--butter-soft)", fg: "var(--butter-ink)", icon: <CircleDashed size={16} style={{ animation: "fgSpin 1s linear infinite" }} /> };
  if (status === "partial") return { bg: "var(--butter-soft)", fg: "var(--butter-ink)", icon: <AlertTriangle size={16} /> };
  return { bg: "var(--peach-soft)", fg: "var(--peach-ink)", icon: <AlertTriangle size={16} /> };
}

function advisorTone(phase: AgentReadinessItem["phase"]): { fg: string; bg: string } {
  if (phase === "analysis_ready" || phase === "document_ready_onboarding_complete") {
    return { fg: "var(--mint-ink)", bg: "var(--mint-soft)" };
  }
  if (phase === "document_processing" || phase === "document_ready_onboarding_incomplete") {
    return { fg: "var(--butter-ink)", bg: "var(--butter-soft)" };
  }
  return { fg: "var(--peach-ink)", bg: "var(--peach-soft)" };
}

export default function HubReadinessPanel({ loading, documents, advisors }: Props) {
  const navigate = useNavigate();

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20, marginBottom: 20 }}>
      {/* ── documents in the system ── */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text-strong)" }}>מסמכים במערכת</h2>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>DOCS.STATUS</span>
        </div>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>טוען סטטוס מסמכים…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {documents.map(doc => {
              const t = docTile(doc.status);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => navigate(doc.route)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", cursor: "pointer", textAlign: "start", fontFamily: "inherit", width: "100%" }}
                >
                  <span style={{ width: 32, height: 32, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", background: t.bg, color: t.fg }}>{t.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 800, fontSize: 14, color: "var(--text-strong)" }}>{doc.label}</span>
                    <span style={{ display: "block", fontSize: 12, marginTop: 1, color: doc.status === "ok" ? "var(--text-muted)" : "var(--peach-ink)", fontWeight: doc.status === "ok" ? 500 : 700 }}>{doc.detail}</span>
                  </span>
                  <span style={{ width: 32, height: 32, borderRadius: 9, flex: "none", border: "1px solid var(--border-hair)", background: "var(--card)", color: "var(--text-muted)", display: "grid", placeItems: "center" }}><Upload size={15} /></span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── agent readiness ── */}
      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text-strong)" }}>מוכנות הסוכנים</h2>
          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--text-faint)", fontWeight: 700 }}>AGENTS.READY</span>
        </div>
        {loading ? (
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>טוען מוכנות סוכנים…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {advisors.map((item, i) => {
              const agent = agentById(item.agentId);
              const tone = advisorTone(item.phase);
              return (
                <button
                  key={item.agentId}
                  type="button"
                  onClick={() => navigate(item.route)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 2px", borderBottom: i < advisors.length - 1 ? "1px solid var(--hair)" : "none", background: "none", border: "none", cursor: "pointer", textAlign: "start", fontFamily: "inherit", width: "100%" }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 800, fontSize: 14, color: "var(--text-strong)" }}>{agent.label}</span>
                    <span style={{ display: "block", fontSize: 12, marginTop: 1, color: "var(--text-muted)" }}>{item.detail}</span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: tone.fg, background: tone.bg, borderRadius: 999, padding: "4px 11px", flex: "none", whiteSpace: "nowrap" }}>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
        {!loading && (
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-faint)", fontWeight: 600, lineHeight: 1.5 }}>
            לאחר ייבוא מסמך, היכנסו לסוכן הרלוונטי להשלמת האונבורדינג המקצועי שלו.
          </p>
        )}
      </div>
    </section>
  );
}
