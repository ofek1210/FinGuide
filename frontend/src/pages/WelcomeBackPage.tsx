import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { APP_ROUTES } from "../types/navigation";
import { clearWelcomeBackPending } from "../utils/welcomeBackSession";
import Loader from "../components/ui/Loader";

function extractFirstName(fullName: string | undefined | null): string | null {
  if (!fullName) return null;
  const trimmed = fullName.trim();
  if (!trimmed) return null;
  const [first] = trimmed.split(/\s+/);
  return first || null;
}

export default function WelcomeBackPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const firstName = useMemo(() => extractFirstName(auth.user?.name), [auth.user?.name]);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleContinue = useCallback(() => {
    if (isLeaving) return;
    setIsLeaving(true);
    clearWelcomeBackPending();
    navigate(APP_ROUTES.dashboard, { replace: true });
  }, [isLeaving, navigate]);

  return (
    <div className="welcome-back-page" dir="ltr">
      <main className="welcome-back-main">
        <section
          className="welcome-back-founder"
          aria-labelledby="welcome-back-headline"
        >
          <div className="welcome-back-grid">
            <div className="welcome-back-content">
              <span className="welcome-back-eyebrow">
                <span aria-hidden="true">👋</span> Welcome Back
              </span>

              <h1 id="welcome-back-headline" className="welcome-back-headline">
                {firstName ? (
                  <>
                    Hello again,<br />
                    <strong>{firstName}</strong>.
                  </>
                ) : (
                  <>Hello again.</>
                )}
              </h1>

              <p className="welcome-back-sub">Good to see you again.</p>

              <p className="welcome-back-body">
                Every visit here is another small step toward a stronger financial future.
              </p>

              <blockquote className="welcome-back-quote">
                <p>
                  "Financial confidence isn't built in a single day.<br />
                  It's built one smart decision at a time."
                </p>
              </blockquote>

              <footer className="welcome-back-signature">
                <span className="welcome-back-signature-name">Segev Partush</span>
                <span className="welcome-back-signature-role">
                  Co-Founder &amp; CEO
                </span>
              </footer>

              <button
                type="button"
                className="welcome-back-cta"
                onClick={handleContinue}
                disabled={isLeaving}
                autoFocus
              >
                {isLeaving ? (
                  <Loader />
                ) : (
                  <>
                    <span>Continue To Dashboard</span>
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </div>

            <figure className="welcome-back-portrait" aria-hidden="true">
              <div className="welcome-back-portrait-frame">
                <img
                  src="/team/CEO.png"
                  alt=""
                  loading="eager"
                  decoding="async"
                  width={1313}
                  height={1198}
                />
              </div>
            </figure>
          </div>
        </section>
      </main>
    </div>
  );
}
