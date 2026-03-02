import { useNavigate } from "react-router-dom";

const stats = [
  { value: "99%", label: "דיוק" },
  { value: "8", label: "תובנות" },
  { value: "24", label: "נקודות עניין" },
];

export default function ScanCompletePage() {
  const navigate = useNavigate();

  return (
    <div className="scan-complete-page" dir="rtl">
      <main className="scan-complete-main">
        <section className="scan-complete-card">
          <div className="scan-complete-icon" aria-hidden="true">
            <span className="scan-complete-chart">▮▮▮</span>
            <span className="scan-complete-badge">✓</span>
          </div>

          <h1>הניתוח הושלם</h1>
          <p>תובנות השכר שלכם מוכנות. ניתחנו כל פרט בתלוש שלך.</p>

          <div className="scan-complete-stats">
            {stats.map((item) => (
              <div key={item.label} className="scan-complete-stat">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <button
            className="scan-complete-cta"
            type="button"
            onClick={() => navigate("/dashboard")}
          >
            צפייה בתובנות
            <span aria-hidden="true">←</span>
          </button>

          <div className="scan-complete-footnote">
            הניתוח הושלם תוך 3.2 שניות
          </div>
        </section>
      </main>
    </div>
  );
}
