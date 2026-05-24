import type { PriceRange } from "../../api/recommendations.api";
import { formatCurrencyILS } from "../../utils/formatters";

type Props = { range: PriceRange };

export default function PriceRangeBar({ range }: Props) {
  const max = range.max || 1;
  const avgPct = Math.min(100, Math.round((range.average / max) * 100));
  const minPct = Math.min(100, Math.round((range.min / max) * 100));

  return (
    <div className="price-range-bar" dir="rtl">
      <div className="price-range-track">
        <div className="price-range-min" style={{ width: `${minPct}%` }} />
        <div className="price-range-avg" style={{ width: `${avgPct}%` }} />
      </div>
      <div className="price-range-labels">
        <span>מינ׳ {formatCurrencyILS(range.min)}</span>
        <span>ממוצע {formatCurrencyILS(range.average)}</span>
        <span>מקס׳ {formatCurrencyILS(range.max)}</span>
      </div>
    </div>
  );
}
