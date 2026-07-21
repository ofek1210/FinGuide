/**
 * @deprecated Step 6b — no longer mounted on GemelPage.
 * Per-account analysis is rendered by AccountAnalysisList inside ThreeCardSummary.
 */
import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import type { GemelAccountReportDTO, GemelAdvisorReportDTO } from "../../api/gemel.api";
import { formatCurrencyOrDash } from "../../utils/formatters";

const PRODUCT_LABEL: Record<string, string> = {
  study_fund: "קרן השתלמות",
  gemel: "קופת גמל",
  investment_gemel: "גמל להשקעה",
  child_savings: "חיסכון לכל ילד",
};

type Props = {
  report: GemelAdvisorReportDTO | null;
  loading?: boolean;
  knownFundCount?: number;
};

export default function GemelAccountCards({ report, loading, knownFundCount = 0 }: Props) {
  if (loading) {
    return (
      <section style={{ marginBottom: 32, color: "var(--text-muted)", fontWeight: 600 }}>
        מנתח חשבונות גמל והשתלמות...
      </section>
    );
  }

  if (!report?.accounts?.length) {
    if (knownFundCount > 0) return null;
    return (
      <section style={{ marginBottom: 32, padding: 20, borderRadius: "var(--radius)", background: "var(--surface-sunken)", color: "var(--text-muted)" }}>
        לא נמצאו חשבונות לניתוח. העלה דוח Excel או ייבא דוח הר הכסף.
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "var(--text-strong)" }}>החשבונות שלך</h2>
        <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>
          {report.summary.matchedAccounts}/{report.summary.accountCount} הותאמו לשוק · {formatCurrencyOrDash(report.summary.totalBalance)}
        </span>
      </div>

      {report.humanSummary ? (
        <p style={{ margin: "0 0 18px", lineHeight: 1.65, color: "var(--text-strong)", fontSize: 15 }}>{report.humanSummary}</p>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {report.accounts.map(acc => (
          <AccountCard key={acc.accountId} account={acc} />
        ))}
      </div>
    </section>
  );
}

function AccountCard({ account }: { account: GemelAccountReportDTO }) {
  const qualityIcon = account.dataQuality === "complete" ? CheckCircle2
    : account.dataQuality === "requires_manual_review" ? AlertTriangle : HelpCircle;
  const QualityIcon = qualityIcon;

  return (
    <article style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: "20px 22px", boxShadow: "var(--shadow-soft)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--butter-ink)", letterSpacing: ".08em", marginBottom: 4 }}>
            {PRODUCT_LABEL[account.productType] || account.productType}
          </div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "var(--text-strong)" }}>{account.fundName}</h3>
          {account.companyName ? <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{account.companyName}</div> : null}
        </div>
        <div style={{ textAlign: "end" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text-strong)" }}>{formatCurrencyOrDash(account.balance)}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            <QualityIcon size={14} />
            {account.dataQuality === "complete" ? "נתונים מלאים" : account.dataQuality === "partial" ? "נתונים חלקיים" : "נדרשת בדיקה"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 14 }}>
        <InfoBlock title="דמי ניהול" value={account.fees.balanceClassification} sub={account.fees.balancePct != null ? `${account.fees.balancePct}%` : undefined} />
        <InfoBlock title="ביצועים" value={account.returns.classification.replace(/_/g, " ")} />
        <InfoBlock title="סיכון / התאמה" value={account.risk.level} sub={account.risk.suitability.replace(/_/g, " ")} />
        {account.trackName ? <InfoBlock title="מסלול" value={account.trackName} /> : null}
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)", marginBottom: account.alternatives?.length ? 14 : 0 }}>
        {account.plainLanguage.fees} {account.plainLanguage.risk}
      </div>

      {account.alternatives?.length ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-hair)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "var(--text-strong)" }}>חלופות להשוואה (עד 3)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {account.alternatives.map(alt => (
              <div key={alt.fundCode} style={{ background: "var(--surface-sunken)", borderRadius: "var(--r-md)", padding: "12px 14px" }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>#{alt.rank} {alt.fundName}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{alt.companyName} · התאמה {alt.suitabilityScore}/100</div>
                <ul style={{ margin: "8px 0 0", paddingInlineStart: 18, fontSize: 12.5, color: "var(--text-muted)" }}>
                  {alt.reasons.map(r => <li key={r}>{r}</li>)}
                  {alt.tradeoffs.map(t => <li key={t} style={{ color: "var(--peach-ink)" }}>{t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {account.whatToReview.length ? (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--butter-ink)", fontWeight: 600 }}>
          כדאי להשלים: {account.whatToReview.join(" · ")}
        </div>
      ) : null}
    </article>
  );
}

function InfoBlock({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "var(--surface-sunken)", borderRadius: "var(--r-md)", padding: "10px 12px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-strong)" }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}
