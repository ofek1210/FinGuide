import { useNavigate, useSearchParams } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

export default function ScanCompletePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("documentId")?.trim() ?? "";

  return (
    <div className="scan-complete-page" dir="rtl">
      <main className="scan-complete-main">
        <section className="scan-complete-card">
          <div className="scan-complete-icon" aria-hidden="true">
            <span className="scan-complete-chart">▮▮▮</span>
            <span className="scan-complete-badge">✓</span>
          </div>

          <h1>העיבוד הושלם</h1>
          <p>המסמך עובד בהצלחה. ניתן לצפות בתלוש בהיסטוריית התלושים.</p>

          <button
            className="scan-complete-cta"
            type="button"
            onClick={() =>
              navigate(documentId ? `/documents/${documentId}` : APP_ROUTES.payslipHistory)
            }
          >
            {documentId ? "צפייה בפרטי המסמך" : "צפייה בהיסטוריית תלושים"}
            <span aria-hidden="true">←</span>
          </button>
        </section>
      </main>
    </div>
  );
}
