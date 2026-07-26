/**
 * @deprecated Step 6b — no longer mounted on GemelPage.
 * Recommendations moved to ThreeCardSummary via /api/gemel/analysis (three_card_v5).
 */
import { AlertTriangle, FileSpreadsheet, TrendingUp } from "lucide-react";
import type { GemelAdvisorReportDTO } from "../../api/gemel.api";
import { formatCurrencyOrDash } from "../../utils/formatters";

type Props = {
  report: GemelAdvisorReportDTO | null;
  loading?: boolean;
  onUpload: (file: File) => void;
  uploading?: boolean;
  uploadMsg?: string | null;
  hasPayslipGemelData?: boolean;
  knownFundCount?: number;
  knownTotalBalance?: number;
};

const SEV_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export default function GemelAdvisorSummary({
  report, loading, onUpload, uploading, uploadMsg, hasPayslipGemelData, knownFundCount = 0, knownTotalBalance,
}: Props) {
  if (loading) {
    return (
      <section style={{ marginBottom: 24, color: "var(--text-muted)", fontWeight: 600 }}>
        מכין סיכום יועץ גמל...
      </section>
    );
  }

  const priorityFindings = [...(report?.recommendations || [])]
    .sort((a, b) => (SEV_ORDER[b.severity] || 0) - (SEV_ORDER[a.severity] || 0))
    .slice(0, 5);

  const importantCount = (report?.recommendations || []).filter(r =>
    ["critical", "high", "medium"].includes(r.severity),
  ).length;

  const hasKnownFunds = knownFundCount > 0;
  const accountCount = Math.max(report?.summary?.accountCount ?? 0, knownFundCount);
  const displayBalance = report?.summary?.totalBalance ?? knownTotalBalance ?? 0;

  const showNoData = report?.status === "no_data" && !hasPayslipGemelData && !hasKnownFunds;
  const showPayslipOnly = report?.status === "no_data" && hasPayslipGemelData && !hasKnownFunds;

  const dataWarnings = (report?.dataQuality?.warnings || []).filter(w =>
    !hasKnownFunds || !/לא נמצאו חשבונות/.test(w),
  );

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "var(--text-strong)" }}>יועץ גמל והשתלמות</h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--r-md)", background: "var(--butter)", color: "var(--text-strong)", fontWeight: 800, fontSize: 13, cursor: uploading ? "wait" : "pointer", border: "2px solid var(--text-strong)" }}>
            <FileSpreadsheet size={16} />
            {uploading ? "מעלה..." : "העלאת Excel"}
            <input type="file" accept=".xlsx,.xls,.csv" hidden disabled={uploading} onChange={e => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }} />
          </label>
        </div>
      </div>

      {uploadMsg ? (
        <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "var(--butter-ink)" }}>{uploadMsg}</p>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 18 }}>
        <StatCard label="חשבונות" value={String(accountCount)} />
        <StatCard label="סך צבירה" value={formatCurrencyOrDash(displayBalance)} />
        <StatCard label="הותאמו לשוק" value={`${report?.summary?.matchedAccounts ?? 0}/${accountCount}`} />
        <StatCard label="ממצאים חשובים" value={String(importantCount)} accent={importantCount > 0} />
      </div>

      {dataWarnings.length ? (
        <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", fontSize: 13, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--butter-ink)" }}>נתונים חסרים או לא מלאים: </strong>
          {dataWarnings.slice(0, 4).join(" · ")}
        </div>
      ) : null}

      {priorityFindings.length ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "16px 18px", boxShadow: "var(--shadow-soft)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontWeight: 900, fontSize: 15, color: "var(--text-strong)" }}>
            <TrendingUp size={18} />
            ממצאים בעדיפות
          </div>
          <ol style={{ margin: 0, paddingInlineStart: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {priorityFindings.map((rec, i) => (
              <li key={`${rec.title}-${i}`} style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-strong)" }}>
                <span style={{ fontWeight: 800 }}>{rec.title}</span>
                {rec.explanation ? <span style={{ color: "var(--text-muted)" }}> — {rec.explanation}</span> : null}
                {rec.possibleSavings ? (
                  <span style={{ display: "block", fontSize: 12, color: "var(--mint-ink)", fontWeight: 700, marginTop: 2 }}>
                    חיסכון שנתי משוער: {formatCurrencyOrDash(rec.possibleSavings)}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : showNoData ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 16, borderRadius: "var(--radius)", background: "var(--surface-sunken)" }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, color: "var(--butter-ink)" }} />
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)" }}>
            לא נמצאו חשבונות גמל או השתלמות. העלה דוח Excel או ייבא דוח הר הכסף כדי להתחיל.
          </div>
        </div>
      ) : showPayslipOnly ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 16, borderRadius: "var(--radius)", background: "var(--butter-soft)", border: "1px solid var(--butter)" }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, color: "var(--butter-ink)" }} />
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-strong)" }}>
            זוהו הפקדות גמל/השתלמות מהתלוש — להשוואה מול השוק וניתוח מלא, העלה דוח Excel או ייבא דוח הר הכסף.
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? "var(--butter-soft)" : "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "var(--text-strong)" }}>{value}</div>
    </div>
  );
}
