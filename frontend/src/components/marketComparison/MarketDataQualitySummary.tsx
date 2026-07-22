import { fmtReportPeriod } from "./marketComparisonFormatters";
import type { MarketComparisonGroupDTO, MarketComparisonDataQualityDTO } from "../../api/marketComparison.api";

type Props = {
  group: MarketComparisonGroupDTO | null;
  dataQuality: MarketComparisonDataQualityDTO;
  sourceShortLabel: string;
};

export default function MarketDataQualitySummary({ group, dataQuality, sourceShortLabel }: Props) {
  const ranked = group?.rankedRecords ?? dataQuality.rankedRecords ?? 0;
  const report = fmtReportPeriod(dataQuality.latestOfficialReportPeriod);

  return (
    <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-faint)" }}>
      <p style={{ margin: 0 }}>
        {ranked} מסלולים דורגו בקבוצה זו · עודכן לפי דיווחי {sourceShortLabel}
        {report ? ` · דיווח ${report}` : ""}
      </p>
      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>פרטי איכות נתונים</summary>
        <ul style={{ margin: "8px 0 0", paddingInlineStart: 18, lineHeight: 1.6 }}>
          <li>מסלולים זכאים: {group?.eligibleRecords ?? dataQuality.eligibleRecords ?? "—"}</li>
          <li>מסלולים מדורגים: {group?.rankedRecords ?? dataQuality.rankedRecords ?? "—"}</li>
          <li>ללא היסטוריה מספקת: {group?.insufficientHistoryRecords ?? dataQuality.insufficientHistoryRecords ?? "—"}</li>
          {dataQuality.lastUpdated && <li>סנכרון אחרון: {new Date(dataQuality.lastUpdated).toLocaleDateString("he-IL")}</li>}
        </ul>
      </details>
    </div>
  );
}
