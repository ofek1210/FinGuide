import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchPayslipHistory } from "../services/payslip.service";
import { formatCurrencyILS } from "../utils/formatters";
import { APP_ROUTES } from "../types/navigation";

export default function ScanCompletePage() {
  const navigate = useNavigate();
  const [totalPayslips, setTotalPayslips] = useState<number>(0);
  const [averageNet, setAverageNet] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchPayslipHistory();
        if (!cancelled) {
          setTotalPayslips(res.stats.totalPayslips);
          setAverageNet(res.stats.averageNet);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    { value: loading ? "…" : String(totalPayslips), label: "תלושים שעובדו" },
    { value: loading ? "…" : formatCurrencyILS(averageNet), label: "ממוצע נטו" },
  ];

  return (
    <div className="scan-complete-page" dir="rtl">
      <main className="scan-complete-main">
        <section className="scan-complete-card">
          <div className="scan-complete-icon" aria-hidden="true">
            <span className="scan-complete-chart">▮▮▮</span>
            <span className="scan-complete-badge">✓</span>
          </div>

          <h1>הניתוח הושלם</h1>
          <p>תובנות השכר שלכם מוכנות. צפו בהיסטוריית התלושים או בדאשבורד.</p>

          <div className="scan-complete-stats">
            {stats.map((item) => (
              <div key={item.label} className="scan-complete-stat">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="scan-complete-actions">
            <button
              className="scan-complete-cta"
              type="button"
              onClick={() => navigate(APP_ROUTES.payslipHistory)}
            >
              היסטוריית תלושים
              <span aria-hidden="true">←</span>
            </button>
            <button
              className="scan-complete-cta secondary"
              type="button"
              onClick={() => navigate(APP_ROUTES.dashboard)}
            >
              חזרה ללוח הבקרה
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
