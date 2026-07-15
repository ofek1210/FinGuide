import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../../types/navigation";
import PublicFooter from "./PublicFooter";
import "./landing.css";
import "./landing-public-pages.css";

interface PublicPageShellProps {
  children: ReactNode;
  /** e.g. "team-page", "careers-page", "job-page" — enables marketing content styles */
  contentClassName?: string;
}

export default function PublicPageShell({
  children,
  contentClassName,
}: PublicPageShellProps) {
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem("token"));

  const goDashboard = () =>
    navigate(hasToken ? APP_ROUTES.hub : APP_ROUTES.register);

  return (
    <div className="fg-landing fg-public" dir="rtl">
      <div className="bg">
        <div className="blob lav" />
        <div className="blob mint" />
        <div className="blob peach" />
      </div>
      <div className="grain" />

      <nav>
        <div className="wrap">
          <div className="nav-inner">
            <button
              type="button"
              className="brand"
              onClick={() => navigate(APP_ROUTES.home)}
              aria-label="FinGuide — חזרה לדף הבית"
              style={{ background: "none", border: 0, cursor: "pointer", padding: 0, font: "inherit" }}
            >
              <span className="dot">F</span>
              <b>
                Fin<span>Guide</span>
              </b>
            </button>
            <div className="nav-links">
              <button
                type="button"
                className="nav-ghost"
                onClick={() => navigate(APP_ROUTES.team)}
              >
                הכר את הצוות
              </button>
              <button
                type="button"
                className="nav-ghost"
                onClick={() => navigate(APP_ROUTES.careers)}
              >
                קריירה
              </button>
              <button
                type="button"
                className="nav-ghost"
                onClick={() => navigate(APP_ROUTES.contact)}
              >
                צור קשר
              </button>
            </div>
            <div className="nav-right">
              {hasToken ? (
                <button className="btn-mini" type="button" onClick={goDashboard}>
                  ללוח הבקרה
                </button>
              ) : (
                <>
                  <button className="nav-ghost" type="button" onClick={() => navigate(APP_ROUTES.login)}>
                    התחברות
                  </button>
                  <button className="btn-mini" type="button" onClick={() => navigate(APP_ROUTES.register)}>
                    בדיקה חינם
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className={["fg-public-body", contentClassName].filter(Boolean).join(" ")}>
        {children}
      </div>

      <PublicFooter />
    </div>
  );
}
