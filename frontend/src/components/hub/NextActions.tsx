import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap } from "lucide-react";
import type { FullAnalysisActionItem } from "../../api/fullAnalysis.api";
import type { FindingItem } from "../../api/findings.api";
import { AGENTS } from "../../theme/agents";
import { APP_ROUTES } from "../../types/navigation";
import { DOMAIN_TO_AGENT } from "./masterAgentMerge";
import { DOMAIN_LABEL, PRIORITY_STYLE, domainOf } from "./agentDisplay";

/* ============================================================
   NextActions — "הפעולות הבאות": the master agent's top-3
   cross-referenced action items. Before any run, the ranked
   findings serve as the fallback so the section is never empty.
   ============================================================ */

type NextActionsProps = {
  items: FullAnalysisActionItem[];
  fallbackFindings: FindingItem[];
  loading: boolean;
  completedDocs: number;
};

export default function NextActions({ items, fallbackFindings, loading, completedDocs }: NextActionsProps) {
  const navigate = useNavigate();
  const top = items.slice(0, 3);

  return (
    <section style={{ marginBottom: 46 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center" }}>
          <Zap size={16} strokeWidth={2.2} />
        </span>
        <h2 style={{ margin: 0, fontSize: "clamp(20px,2.2vw,26px)", fontWeight: 900, letterSpacing: "-.025em", color: "var(--text-strong)" }}>הפעולות הבאות</h2>
        <button onClick={() => navigate(APP_ROUTES.financialHealth)} style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, color: "var(--accent)" }}>
          הכל <ArrowLeft size={15} strokeWidth={2.4} />
        </button>
      </div>

      {top.length > 0 ? (
        /* post-run: the master agent's cross-referenced action items */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          {top.map((item, i) => {
            const p = PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.medium;
            const agentId = DOMAIN_TO_AGENT[item.domain];
            const domainDef = agentId ? AGENTS.find(x => x.id === agentId) : null;
            return (
              <button
                key={`${item.domain}-${item.title}`}
                onClick={() => item.actionUrl && navigate(item.actionUrl)}
                style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "start", fontFamily: "inherit", cursor: item.actionUrl ? "pointer" : "default", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: 18, animation: `fgRise .45s ${i * 0.08}s var(--ease) both`, transition: "transform .25s var(--ease), box-shadow .25s var(--ease)" }}
                onMouseEnter={e => { if (item.actionUrl) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "var(--shadow-card)"; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "var(--shadow-soft)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: "3px 10px", background: p.bg, color: p.color }}>{p.label}</span>
                  {domainDef && (
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: domainDef.tone.accent, background: domainDef.tone.soft, borderRadius: 999, padding: "3px 10px" }}>{domainDef.label}</span>
                  )}
                </div>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)", lineHeight: 1.35 }}>{item.title}</div>
                {item.description && (
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.description}</div>
                )}
                {item.financialImpact && (
                  <div style={{ fontSize: 12.5, color: "var(--mint-ink)", fontWeight: 800 }}>{item.financialImpact}</div>
                )}
              </button>
            );
          })}
        </div>
      ) : fallbackFindings.length > 0 ? (
        /* pre-run: ranked findings keep the section alive */
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 620 }}>
          {fallbackFindings.map((f, i) => {
            const topRow = i === 0;
            const warn = f.severity === "warning";
            const domainRoute = AGENTS.find(a => a.id === domainOf(f))?.route ?? APP_ROUTES.documents;
            return (
              <button key={f.id} onClick={() => navigate(domainRoute)}
                style={{ width: "100%", textAlign: "start", fontFamily: "inherit", cursor: "pointer", display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", borderRadius: "var(--r-md)", border: topRow ? "0" : "1px solid var(--border-hair)", background: topRow ? "linear-gradient(95deg,var(--peach) 0%,var(--lav-200) 55%,var(--mint) 100%)" : "var(--surface-sunken)" }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, flex: "none", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13, background: topRow ? "rgba(255,255,255,.6)" : "var(--card)", color: "var(--ink)", boxShadow: "var(--shadow-soft)" }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: topRow ? "var(--ink-soft)" : "var(--text-muted)" }}>{DOMAIN_LABEL[domainOf(f)]}</div>
                </div>
                <span style={{ flex: "none", fontWeight: 800, fontSize: 11.5, borderRadius: "var(--r-pill)", padding: "4px 10px", background: topRow ? "rgba(255,255,255,.6)" : warn ? "var(--peach-soft)" : "var(--mint-soft)", color: warn ? "var(--peach-ink)" : "var(--mint-ink)" }}>
                  {warn ? "דורש טיפול" : "כדאי לדעת"}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "grid", placeItems: "center", minHeight: 120, textAlign: "center", background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: 24 }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text-body)", marginBottom: 6 }}>
              {loading ? "טוענים ממצאים…" : completedDocs > 0 ? "אין ממצאים פעילים — הכל תקין 🎉" : "אין ממצאים עדיין"}
            </div>
            {!loading && completedDocs === 0 && (
              <button onClick={() => navigate(APP_ROUTES.documents)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--lav-100)", color: "var(--lav-700)", border: "1px solid var(--lav-200)", borderRadius: "var(--r-btn)", padding: "10px 18px", fontFamily: "inherit", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
                העלאת תלוש ראשון <ArrowLeft size={15} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
