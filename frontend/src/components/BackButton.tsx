import { useNavigate } from "react-router-dom";

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
      onClick={() => navigate("/")}
      aria-label="חזרה לדף הקודם"
      title="חזרה"
    >
      ←
    </button>
  );
}
