import { Percent, Scale, TrendingUp } from "lucide-react";
import type { RecommendationCard as RecommendationCardType } from "../../api/financialAdvisory.types";
import ConfidenceIndicator from "./ConfidenceIndicator";
import MarketAlternatives from "./MarketAlternatives";
import {
  BLOCKER_LABELS,
  OUTCOME_LABELS,
  OUTCOME_TONE,
  RISK_LABELS,
  feeMetricsOf,
  formatCurrency,
  formatPercent,
  formatRankLine,
  hasDisplayValue,
  marketMetricsOf,
  suitabilityMetricsOf,
} from "../../utils/financialAdvisoryDisplay";

type Props = {
  card: RecommendationCardType;
  accent?: "mint" | "butter";
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "4px 0" }}>
      <span style={{ color: "var(--text-faint)", fontWeight: 700 }}>{label}</span>
      <span style={{ color: "var(--text-body)", fontWeight: 700, textAlign: "end" }}>{value}</span>
    </div>
  );
}

function FeeDetails({ card }: { card: RecommendationCardType }) {
  const m = feeMetricsOf(card);
  const inputs = m.calculationInputs;
  const depositPct = formatPercent(m.currentFeeDepositPct ?? inputs?.userDepositFeePct);
  const balancePct = formatPercent(m.currentFeeBalancePct ?? inputs?.userBalanceFeePct);
  const marketDeposit = formatPercent(inputs?.marketAvgDepositPct);
  const marketBalance = formatPercent(inputs?.marketAvgBalancePct);
  const annualCost = formatCurrency(m.estimatedAnnualCost);
  const annualSaving = formatCurrency(m.estimatedAnnualSaving ?? m.potentialAnnualSavingIls);

  return (
    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-faint)", marginBottom: 8 }}>פירוט דמי ניהול</div>
      {depositPct && <DetailRow label="דמי ניהול מהפקדות" value={depositPct} />}
      {balancePct && <DetailRow label="דמי ניהול מצבירה" value={balancePct} />}
      {marketDeposit && <DetailRow label="ממוצע שוק — הפקדות" value={marketDeposit} />}
      {marketBalance && <DetailRow label="ממוצע שוק — צבירה" value={marketBalance} />}
      {annualCost && <DetailRow label="עלות שנתית משוערת" value={annualCost} />}
      {annualSaving && <DetailRow label="פער שנתי משוער מול השוואה" value={annualSaving} />}
      {hasDisplayValue(inputs?.peerBalanceSampleSize) && (
        <DetailRow label="מדגם השוואה (צבירה)" value={String(inputs!.peerBalanceSampleSize)} />
      )}
    </div>
  );
}

function SuitabilityDetails({ card }: { card: RecommendationCardType }) {
  const m = suitabilityMetricsOf(card);
  const range = m.suitableRiskRange;
  const userRisk = m.userRiskLevel ? (RISK_LABELS[m.userRiskLevel] ?? m.userRiskLevel) : null;
  const fundRisk = m.fundRiskLevel ? (RISK_LABELS[m.fundRiskLevel] ?? m.fundRiskLevel) : null;

  return (
    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-faint)", marginBottom: 8 }}>גורמי התאמה</div>
      {userRisk && <DetailRow label="העדפת סיכון (פרופיל)" value={userRisk} />}
      {fundRisk && <DetailRow label="רמת סיכון המסלול" value={fundRisk} />}
      {range?.min && range?.max && (
        <DetailRow label="טווח מתאים" value={`${RISK_LABELS[range.min] ?? range.min} – ${RISK_LABELS[range.max] ?? range.max}`} />
      )}
      {hasDisplayValue(m.horizonYears) && (
        <DetailRow label="אופק השקעה" value={`${m.horizonYears} שנים`} />
      )}
      {range?.explanationHe && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{range.explanationHe}</p>
      )}
      {m.suitabilityBlockers && m.suitabilityBlockers.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--butter-ink)", marginBottom: 4 }}>מידע חסר להשלמה</div>
          <ul style={{ margin: 0, paddingInlineStart: 16, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
            {m.suitabilityBlockers.map(b => (
              <li key={b}>{BLOCKER_LABELS[b] ?? b}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MarketDetails({ card }: { card: RecommendationCardType }) {
  const m = marketMetricsOf(card);
  const rankLine = formatRankLine(m);

  return (
    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-faint)", marginBottom: 8 }}>השוואת שוק</div>
      {rankLine && (
        <div style={{ fontSize: 14, fontWeight: 900, color: "var(--text-strong)", marginBottom: 8 }}>{rankLine}</div>
      )}
      {m.comparisonGroupLabel && <DetailRow label="קבוצת השוואה" value={m.comparisonGroupLabel} />}
      {card.statusLabelHe && <DetailRow label="סטטוס דירוג" value={card.statusLabelHe} />}
      {m.periodsUsed && m.periodsUsed.length > 0 && (
        <DetailRow label="תקופות בדירוג" value={m.periodsUsed.join(" · ")} />
      )}
      {m.comparisonDataDate && <DetailRow label="תאריך נתוני השוואה" value={m.comparisonDataDate} />}
      {m.rankingFormula && (
        <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.5 }}>{m.rankingFormula}</p>
      )}
      <MarketAlternatives alternatives={card.alternatives ?? []} label={card.alternativesLabelHe} />
    </div>
  );
}

const SLOT_ICON = {
  management_fees: Percent,
  track_suitability: TrendingUp,
  market_comparison: Scale,
} as const;

export default function RecommendationCard({ card, accent = "mint" }: Props) {
  const tone = OUTCOME_TONE[card.cardOutcome] ?? OUTCOME_TONE.insufficient_data;
  const Icon = SLOT_ICON[card.slot] ?? Scale;
  const accentColor = accent === "butter" ? "var(--butter-ink)" : "var(--mint-ink)";
  const accentSoft = accent === "butter" ? "var(--butter-soft)" : "var(--mint-soft)";

  return (
    <article
      style={{
        background: "var(--card)",
        border: `1px solid ${tone.border}`,
        borderRadius: "var(--radius)",
        padding: "20px 22px",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 12 }}>
        <span
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            flex: "none",
            background: accentSoft,
            color: accentColor,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon size={20} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--text-strong)" }}>{card.title}</h3>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: tone.fg, background: tone.bg, borderRadius: 999, padding: "3px 9px" }}>
              {OUTCOME_LABELS[card.cardOutcome]}
            </span>
          </div>
          {hasDisplayValue(card.statusLabelHe) && (
            <div style={{ fontSize: 13, fontWeight: 800, color: accentColor }}>{card.statusLabelHe}</div>
          )}
          {hasDisplayValue(card.accountLabel) && (
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
              חשבון נבחר: <strong>{card.accountLabel}</strong>
            </div>
          )}
        </div>
        <ConfidenceIndicator level={card.confidence} label={card.confidenceLabelHe} score={card.confidenceScore} />
      </div>

      {hasDisplayValue(card.summary) && (
        <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--text-body)", lineHeight: 1.55 }}>{card.summary}</p>
      )}

      {hasDisplayValue(card.why) && (
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
          <strong style={{ color: "var(--text-faint)" }}>למה: </strong>{card.why}
        </p>
      )}

      {card.slot === "management_fees" && <FeeDetails card={card} />}
      {card.slot === "track_suitability" && <SuitabilityDetails card={card} />}
      {card.slot === "market_comparison" && <MarketDetails card={card} />}

      {hasDisplayValue(card.recommendation) && (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: "var(--r-sm)",
            background: tone.bg,
            border: `1px solid ${tone.border}`,
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 800, color: tone.fg, marginBottom: 4 }}>
            {card.cardOutcome === "information_required" ? "מה כדאי להשלים" : "המשך מומלץ"}
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.5 }}>{card.recommendation}</p>
        </div>
      )}
    </article>
  );
}
