import type { AdvisoryDataQuality, AdvisoryMarketData, AdvisoryMissingDataItem } from "../../api/financialAdvisory.types";
import { hasDisplayValue } from "../../utils/financialAdvisoryDisplay";

type Props = {
  marketData?: AdvisoryMarketData | null;
  dataQuality?: AdvisoryDataQuality | null;
  missingData?: AdvisoryMissingDataItem[];
};

function formatSyncDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" });
}

export default function DataQualityNotice({ marketData, dataQuality, missingData = [] }: Props) {
  const warnings = [
    ...(marketData?.warnings ?? []),
    ...(dataQuality?.warnings ?? []),
  ].filter(hasDisplayValue);

  const sourceLabel = marketData?.sourceLabel
    ?? (marketData?.source === "PENSION_NET" ? "פנסיה-נט" : marketData?.source === "GEMEL_NET" ? "גמל-נט" : null);

  const lastUpdate = formatSyncDate(marketData?.lastSyncedAt);
  const reportPeriod = marketData?.latestReportPeriod;
  const peerCount = hasDisplayValue(marketData?.fundCount) ? marketData!.fundCount : null;

  const hasContent = sourceLabel || lastUpdate || reportPeriod || peerCount != null
    || warnings.length || missingData.length;

  if (!hasContent) return null;

  return (
    <section
      style={{
        marginTop: 18,
        padding: "16px 18px",
        borderRadius: "var(--r-md)",
        background: "var(--surface-sunken)",
        border: "1px solid var(--border-hair)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-strong)", marginBottom: 10 }}>
        שקיפות נתונים
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", fontSize: 12.5, color: "var(--text-muted)" }}>
        {sourceLabel && <span>מקור: {sourceLabel}</span>}
        {lastUpdate && <span>עודכן: {lastUpdate}</span>}
        {reportPeriod && <span>תקופת דיווח: {reportPeriod}</span>}
        {peerCount != null && <span>{peerCount.toLocaleString("he-IL")} מסלולים בבסיס הנתונים</span>}
        {hasDisplayValue(dataQuality?.matchConfidence) && (
          <span>התאמת שוק ממוצעת: {Math.round(dataQuality!.matchConfidence!)}%</span>
        )}
      </div>
      {marketData?.isStale && (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--butter-ink)", fontWeight: 700 }}>
          ייתכן שנתוני השוק אינם מעודכנים לחלוטין.
        </p>
      )}
      {warnings.length > 0 && (
        <ul style={{ margin: "10px 0 0", paddingInlineStart: 18, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
      {missingData.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-faint)", marginBottom: 4 }}>שדות חסרים</div>
          <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            {missingData.map((m, i) => <li key={i}>{m.message}</li>)}
          </ul>
        </div>
      )}
      <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.5 }}>
        דירוגי השוואה מחושבים במתודולוגיית הפרויקט (45% / 35% / 20%) — לא המלצה רשמית של פנסיה-נט או גמל-נט.
      </p>
    </section>
  );
}
