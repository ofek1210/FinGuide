import { useNavigate, useLocation } from "react-router-dom";
import { APP_ROUTES } from "../../types/navigation";

export default function DocsTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isHistory = pathname.startsWith("/documents/history");

  return (
    <div className="page-tab-bar">
      <button
        type="button"
        className={`page-tab-btn${!isHistory ? " is-active" : ""}`}
        onClick={() => navigate(APP_ROUTES.documentsUpload)}
      >
        העלאת מסמכים
      </button>
      <button
        type="button"
        className={`page-tab-btn${isHistory ? " is-active" : ""}`}
        onClick={() => navigate(APP_ROUTES.payslipHistory)}
      >
        היסטוריית תלושים
      </button>
    </div>
  );
}
