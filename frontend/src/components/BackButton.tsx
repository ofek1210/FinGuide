import { useNavigate } from "react-router-dom";

export default function BackButton() {
  const navigate = useNavigate();

  return (
    <button
      className="back-button"
      type="button"
      onClick={() => navigate(-1)}
      aria-label="חזרה לדף הקודם"
      title="חזרה"
    >
      ←
    </button>
  );
}
