import { useNavigate, useLocation } from "react-router-dom";
import { APP_ROUTES } from "../../types/navigation";

export default function PlanTabBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isChat = pathname.startsWith("/assistant");

  return (
    <div className="page-tab-bar">
      <button
        type="button"
        className={`page-tab-btn${!isChat ? " is-active" : ""}`}
        onClick={() => navigate(APP_ROUTES.copilot)}
      >
        ✦ תכנון פיננסי
      </button>
      <button
        type="button"
        className={`page-tab-btn${isChat ? " is-active" : ""}`}
        onClick={() => navigate(APP_ROUTES.assistant)}
      >
        ✦ שיחה עם AI
      </button>
    </div>
  );
}
