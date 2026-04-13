import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";
import { useAuth } from "../auth/AuthProvider";

export default function BackButton() {
  const navigate = useNavigate();
  const { status } = useAuth();

  if (status !== "guest") {
    return null;
  }

  return (
    <button
      className="back-button"
      type="button"
      onClick={() => navigate(APP_ROUTES.home)}
      aria-label="חזרה לדף הקודם"
      title="חזרה"
    >
      ←
    </button>
  );
}
