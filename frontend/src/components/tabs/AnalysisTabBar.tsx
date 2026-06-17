import { useNavigate, useLocation } from "react-router-dom";
import { APP_ROUTES } from "../../types/navigation";

export default function AnalysisTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isFindings = pathname.startsWith("/findings");

  return (
    <div className="page-tab-bar">
      <button
        type="button"
        className={`page-tab-btn${!isFindings ? " is-active" : ""}`}
        onClick={() => navigate(APP_ROUTES.insights)}
      >
        ✦ תובנות AI
      </button>
      <button
        type="button"
        className={`page-tab-btn${isFindings ? " is-active" : ""}`}
        onClick={() => navigate(APP_ROUTES.findings)}
      >
        ממצאים
      </button>
    </div>
  );
}
