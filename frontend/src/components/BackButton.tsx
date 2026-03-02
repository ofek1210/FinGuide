import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

export default function BackButton() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  if (token) {
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
