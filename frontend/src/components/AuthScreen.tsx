import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, loginWithGoogle, register } from "../api/auth.api";
import Toast from "./ui/Toast";
import ToastContainer from "./ui/ToastContainer";
import Loader from "./ui/Loader";
import { APP_ROUTES } from "../types/navigation";
import { emitAuthChanged } from "../auth/authEvents";

interface AuthScreenProps {
  mode: "login" | "register";
}

const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

const MailIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M4 6.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 16V8A1.5 1.5 0 0 1 4 6.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M3.5 8.5 12 13.5 20.5 8.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect
      x="5"
      y="10"
      width="14"
      height="10"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M8 10V8a4 4 0 0 1 8 0v2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M4 4 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M6.2 6.7C4 8.3 2.5 12 2.5 12s3.5 6 9.5 6c2 0 3.7-.6 5.2-1.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.8 9.3a3 3 0 0 0 4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 6c4 0 7.2 2.7 9.2 6-.6 1-1.4 2.1-2.5 3.1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="m12 3 1.6 4.2 4.4 1.1-4.4 1.1L12 13.7 10.4 9.4 6 8.3l4.4-1.1L12 3Z"
      fill="currentColor"
    />
    <path
      d="m18.2 14.2.8 2.1 2.2.5-2.2.6-.8 2.1-.8-2.1-2.2-.6 2.2-.5.8-2.1Z"
      fill="currentColor"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M12 3 4.5 6.5v5.2c0 4.1 3 7.6 7.5 9.3 4.5-1.7 7.5-5.2 7.5-9.3V6.5L12 3Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle
      cx="12"
      cy="8"
      r="3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path
      d="M5 19c1.8-3.6 12.2-3.6 14 0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export default function AuthScreen({
  mode,
}: AuthScreenProps) {
  const navigate = useNavigate();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const isRegister = mode === "register";
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!error) return undefined;
    const timer = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const persistSession = useCallback(
    (token: string, user?: { id: string; name: string; email: string }) => {
      localStorage.setItem("token", token);
      if (user) {
        localStorage.setItem("auth_user", JSON.stringify(user));
      }
      emitAuthChanged();
      navigate(APP_ROUTES.dashboard);
    },
    [navigate],
  );

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setError(null);
      setIsGoogleSubmitting(true);

      try {
        const response = await loginWithGoogle(credential);
        const token = response.data?.token ?? response.token;

        if (!response.success || !token) {
          setError(response.message || "לא הצלחנו להתחבר עם Google.");
          return;
        }

        persistSession(token, response.data?.user);
      } catch {
        setError("אירעה שגיאה בהתחברות עם Google, נסו שוב בהמשך.");
      } finally {
        setIsGoogleSubmitting(false);
      }
    },
    [persistSession],
  );

  useEffect(() => {
    if (!googleClientId) {
      setIsGoogleReady(false);
      return undefined;
    }

    setIsGoogleReady(false);
    let isCancelled = false;
    const scriptSelector = "script[data-google-identity='true']";
    let attachedScript: HTMLScriptElement | null = null;

    const renderGoogleButton = () => {
      if (
        isCancelled ||
        !googleButtonRef.current ||
        !window.google?.accounts?.id
      ) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (googleResponse) => {
          const credential = googleResponse.credential;
          if (!credential) {
            setError("לא התקבל אישור התחברות מ-Google.");
            return;
          }

          void handleGoogleCredential(credential);
        },
      });

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: isRegister ? "signup_with" : "signin_with",
        shape: "pill",
        width: 320,
        locale: "he",
        logo_alignment: "left",
      });
      setIsGoogleReady(true);
    };

    const handleScriptLoad = () => {
      renderGoogleButton();
    };

    const handleScriptError = () => {
      if (!isCancelled) {
        setError("טעינת התחברות Google נכשלה. נסו לרענן את הדף.");
      }
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return () => {
        isCancelled = true;
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>(scriptSelector);
    if (existingScript) {
      existingScript.addEventListener("load", handleScriptLoad);
      existingScript.addEventListener("error", handleScriptError);
    } else {
      attachedScript = document.createElement("script");
      attachedScript.src = GOOGLE_SCRIPT_SRC;
      attachedScript.async = true;
      attachedScript.defer = true;
      attachedScript.dataset.googleIdentity = "true";
      attachedScript.addEventListener("load", handleScriptLoad);
      attachedScript.addEventListener("error", handleScriptError);
      document.head.appendChild(attachedScript);
    }

    return () => {
      isCancelled = true;
      const script = attachedScript || document.querySelector<HTMLScriptElement>(scriptSelector);
      if (script) {
        script.removeEventListener("load", handleScriptLoad);
        script.removeEventListener("error", handleScriptError);
      }
    };
  }, [googleClientId, handleGoogleCredential, isRegister]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      if (isRegister) {
        if (!name.trim() || !email.trim() || !password.trim()) {
          setError("נא למלא שם, אימייל וסיסמה");
          return;
        }

        const response = await register(name.trim(), email.trim(), password);
        const token = response.token ?? response.data?.token;

        if (!response.success || !token) {
          const serverMessage =
            response.errors?.[0]?.message ||
            response.errors?.[0]?.msg ||
            response.message;
          setError(serverMessage || "לא הצלחנו להשלים את ההרשמה.");
          return;
        }

        persistSession(token, response.data?.user);
        return;
      }

      if (!email.trim() || !password.trim()) {
        setError("נא למלא אימייל וסיסמה");
        return;
      }

      const response = await login(email.trim(), password);
      const token = response.data?.token ?? response.token;

      if (!response.success || !token) {
        setError(response.message || "לא הצלחנו להתחבר, נסו שוב.");
        return;
      }

      persistSession(token, response.data?.user);
    } catch {
      setError(
        isRegister
          ? "אירעה שגיאה בהרשמה, נסו שוב בהמשך."
          : "אירעה שגיאה בהתחברות, נסו שוב בהמשך.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-card">
          <header className="auth-card-header">
            <h1>{isRegister ? "יצירת חשבון" : "ברוכים השבים"}</h1>
            <p>
              {isRegister
                ? "צרו חשבון חדש כדי להתחיל לנתח את המסמכים שלכם"
                : "היכנסו כדי לגשת ללוח הבקרה הפיננסי שלכם"}
            </p>
          </header>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {isRegister && (
              <label className="auth-field">
                <span>שם מלא</span>
                <div className="auth-input">
                  <input
                    className="auth-input-control"
                    type="text"
                    placeholder="השם שלכם"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                  />
                  <span className="auth-input-icon" aria-hidden="true">
                    <UserIcon />
                  </span>
                </div>
              </label>
            )}
            <label className="auth-field">
              <span>כתובת אימייל</span>
              <div className="auth-input">
                <input
                  className="auth-input-control is-ltr"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                <span className="auth-input-icon" aria-hidden="true">
                  <MailIcon />
                </span>
              </div>
            </label>

            <label className="auth-field">
              <span>סיסמה</span>
              <div className="auth-input has-action">
                <input
                  className="auth-input-control"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <span className="auth-input-icon" aria-hidden="true">
                  <LockIcon />
                </span>
                <button
                  className="auth-input-action"
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>

            {isRegister ? (
              <span
                className="auth-link"
                style={{ visibility: "hidden", pointerEvents: "none" }}
              >
                placeholder
              </span>
            ) : (
              <button className="auth-link" type="button">
                שכחתם את הסיסמה?
              </button>
            )}

            <button
              className="auth-button"
              type="submit"
              disabled={isSubmitting || isGoogleSubmitting}
            >
              {isSubmitting ? <Loader /> : isRegister ? "יצירת חשבון" : "התחברות"}
            </button>

            <div className="auth-divider">
              <span>או המשיכו עם</span>
            </div>

            {!googleClientId ? (
              <div className="auth-google-state auth-google-state-error">
                התחברות Google לא זמינה: חסר VITE_GOOGLE_CLIENT_ID בצד הלקוח.
              </div>
            ) : (
              <>
                <div className="auth-google-slot">
                  <div
                    ref={googleButtonRef}
                    className="auth-google-button"
                    aria-label="Google Sign-In"
                  />
                </div>
                {!isGoogleReady ? (
                  <div className="auth-google-state">
                    טוענים התחברות עם Google...
                  </div>
                ) : null}
                {isGoogleSubmitting ? (
                  <div className="auth-google-state">
                    מאמתים התחברות עם Google...
                  </div>
                ) : null}
              </>
            )}

            <div className="auth-register">
              <span>{isRegister ? "כבר יש לכם חשבון?" : "אין לכם חשבון?"}</span>
              <button
                className="auth-link is-inline"
                type="button"
                onClick={() =>
                  navigate(isRegister ? APP_ROUTES.login : APP_ROUTES.register)
                }
              >
                {isRegister ? "התחברו" : "הרשמו"}
              </button>
            </div>
          </form>

          <div className="auth-note">
            <span className="auth-note-icon" aria-hidden="true">
              <ShieldIcon />
            </span>
            המידע שלכם מוצפן ומאובטח. אנחנו לעולם לא משתפים את המידע שלכם עם
            צדדים שלישיים.
          </div>
        </section>

        <aside className="auth-side">
          <div className="auth-logo">
            <span className="auth-logo-badge" aria-hidden="true">
              <SparkleIcon />
            </span>
            <span>FinGuide</span>
          </div>

          <h2>העוזר הפיננסי המבוסס על AI שלכם</h2>
          <p>
            העלו מסמכים, קבלו תובנות מיידיות מבוססות בינה מלאכותית, וקחו שליטה
            על העתיד הפיננסי שלכם.
          </p>

          <div className="auth-features">
            <div className="auth-feature">
              <span className="auth-feature-icon" aria-hidden="true">
                <SparkleIcon />
              </span>
              ניתוח מסמכים מבוסס בינה מלאכותית
            </div>
            <div className="auth-feature">
              <span className="auth-feature-icon" aria-hidden="true">
                <ShieldIcon />
              </span>
              אבטחה והצפנה ברמת בנק
            </div>
            <div className="auth-feature">
              <span className="auth-feature-icon" aria-hidden="true">
                <MailIcon />
              </span>
              אינטגרציה אוטומטית לתיבת המייל
            </div>
          </div>
        </aside>
      </div>
      <ToastContainer>
        {error ? <Toast message={error} onDismiss={() => setError(null)} /> : null}
      </ToastContainer>
    </div>
  );
}
