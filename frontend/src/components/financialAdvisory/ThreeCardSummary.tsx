import { AlertTriangle, Loader2 } from "lucide-react";
import type { ThreeCardAdvisoryData } from "../../api/financialAdvisory.types";
import { isThreeCardAdvisory } from "../../api/financialAdvisory.types";
import RecommendationCard from "./RecommendationCard";
import AccountAnalysisList from "./AccountAnalysisList";
import DataQualityNotice from "./DataQualityNotice";
import AdvisoryDisclaimer from "./AdvisoryDisclaimer";
import { sortCards } from "../../utils/financialAdvisoryDisplay";

type Props = {
  data: ThreeCardAdvisoryData | null | undefined;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  hasAccounts?: boolean;
  accent?: "mint" | "butter";
};

function EmptyState({ hasAccounts }: { hasAccounts: boolean }) {
  return (
    <div
      style={{
        padding: "28px 20px",
        borderRadius: "var(--radius)",
        background: "var(--surface-sunken)",
        border: "1px dashed var(--border-soft)",
        textAlign: "center",
        color: "var(--text-muted)",
        fontSize: 14,
        lineHeight: 1.55,
      }}
    >
      {hasAccounts
        ? "הניתוח עדיין לא הושלם. נסו לרענן בעוד רגע."
        : "ייבאו דוח או הוסיפו חשבון כדי לקבל שלוש המלצות מותאמות."}
    </div>
  );
}

export default function ThreeCardSummary({
  data,
  loading = false,
  error = null,
  onRetry,
  hasAccounts = true,
  accent = "mint",
}: Props) {
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 8px", color: "var(--text-muted)", fontSize: 14 }}>
        <Loader2 size={18} style={{ animation: "spin .8s linear infinite" }} />
        מריצים ניתוח שלוש-כרטיסים...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: "18px 16px",
          borderRadius: "var(--r-md)",
          background: "rgba(214,69,69,.06)",
          border: "1px solid rgba(214,69,69,.2)",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <AlertTriangle size={20} color="#C23B3B" style={{ flex: "none", marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: "#C23B3B", marginBottom: 4 }}>שגיאה בטעינת הניתוח</div>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{error}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} style={{ marginTop: 10, fontSize: 13, fontWeight: 800, color: "var(--mint-ink)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              נסו שוב
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!isThreeCardAdvisory(data)) {
    return <EmptyState hasAccounts={hasAccounts} />;
  }

  const cards = sortCards(data.recommendationCards).slice(0, 3);

  return (
    <section style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".06em", margin: "0 2px 14px" }}>
        שלוש המלצות מרכזיות
      </h2>
      {data.llm?.summary && (
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-body)", lineHeight: 1.55 }}>{data.llm.summary}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {cards.map(card => (
          <RecommendationCard key={card.id} card={card} accent={accent} />
        ))}
      </div>
      <DataQualityNotice
        marketData={data.marketData}
        dataQuality={data.dataQuality}
        missingData={data.missingData}
      />
      <AdvisoryDisclaimer data={data} />
      <AccountAnalysisList accounts={data.accountAnalyses ?? []} accent={accent} />
    </section>
  );
}
