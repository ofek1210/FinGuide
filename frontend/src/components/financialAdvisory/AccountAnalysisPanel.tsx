import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AccountAnalysis, RecommendationCard as CardType } from "../../api/financialAdvisory.types";
import RecommendationCard from "./RecommendationCard";
import ConfidenceIndicator from "./ConfidenceIndicator";
import {
  CARD_SLOT_ORDER,
  formatCurrency,
  sortCards,
} from "../../utils/financialAdvisoryDisplay";

type Props = {
  account: AccountAnalysis;
  accent?: "mint" | "butter";
};

const SLOT_MINI_LABEL: Record<string, string> = {
  management_fees: "דמי ניהול",
  track_suitability: "התאמת מסלול",
  market_comparison: "השוואת שוק",
};

function miniSummary(card: CardType): string {
  return card.statusLabelHe || card.summary?.slice(0, 80) || "—";
}

export default function AccountAnalysisPanel({ account, accent = "mint" }: Props) {
  const [open, setOpen] = useState(false);
  const cards = sortCards(account.cards);
  const balance = formatCurrency(account.currentBalance ?? undefined);

  const worstConfidence = cards.reduce<CardType["confidence"]>((worst, c) => {
    const order = { insufficient_data: 0, low: 1, medium: 2, high: 3 };
    return (order[c.confidence] ?? 0) < (order[worst] ?? 3) ? c.confidence : worst;
  }, "high");

  return (
    <div
      style={{
        border: "1px solid var(--border-hair)",
        borderRadius: "var(--r-md)",
        background: "var(--card)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "inherit",
          fontFamily: "inherit",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: "var(--text-strong)" }}>{account.accountLabel}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {account.productType}
            {balance ? ` · ${balance}` : ""}
          </div>
        </div>
        <ConfidenceIndicator level={worstConfidence} label="איכות ניתוח" />
        <ChevronDown
          size={18}
          style={{
            flex: "none",
            color: "var(--text-faint)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform .2s ease",
          }}
        />
      </button>

      {!open && (
        <div style={{ padding: "0 16px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
          {CARD_SLOT_ORDER.map(slot => {
            const card = cards.find(c => c.slot === slot);
            if (!card) return null;
            return (
              <div key={slot} style={{ padding: "8px 10px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)", fontSize: 12 }}>
                <div style={{ fontWeight: 800, color: "var(--text-faint)", marginBottom: 2 }}>{SLOT_MINI_LABEL[slot]}</div>
                <div style={{ fontWeight: 700, color: "var(--text-body)", lineHeight: 1.35 }}>{miniSummary(card)}</div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {cards.map(card => (
            <RecommendationCard key={card.id} card={card} accent={accent} />
          ))}
        </div>
      )}
    </div>
  );
}
