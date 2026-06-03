import { useLocation, useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

/**
 * Routes that render their own top-of-page navbar (Logo + actions).
 * BackButton would overlap that navbar visually, so it stays hidden.
 */
const SUPPRESS_ON: ReadonlyArray<string> = [
  APP_ROUTES.home,
  APP_ROUTES.team,
  APP_ROUTES.contact,
  APP_ROUTES.faq,
  APP_ROUTES.privacy,
  APP_ROUTES.terms,
  APP_ROUTES.careers,
];

export default function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");

  if (token) {
    return null;
  }

  // Hide on the home page and on every other public page that has its own nav.
  if (SUPPRESS_ON.includes(location.pathname)) {
    return null;
  }

  // Dynamic /careers/:slug also has its own nav.
  if (location.pathname.startsWith("/careers/")) {
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
