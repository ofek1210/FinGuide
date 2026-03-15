import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/auth.api";
import Loader from "../components/ui/Loader";
import { APP_ROUTES } from "../types/navigation";

/**
 * This page expects the token in the URL query: ?token=...
 * Backend sends password-reset emails with links of the form:
 * {APP_PUBLIC_URL or CLIENT_URL}/reset-password?token=...
 */

const PASSWORD_HINT = "לפחות 6 תווים, עם אות גדולה, אות קטנה ומספר.";
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !token) {
      return;
    }

    if (!newPassword.trim()) {
      setError("נא להזין סיסמה חדשה.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("אימות הסיסמה אינו תואם.");
      return;
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError("סיסמה חייבת להיות לפחות 6 תווים.");
      return;
    }
    if (!PASSWORD_COMPLEXITY_REGEX.test(newPassword)) {
      setError("סיסמה חייבת להכיל אות גדולה, אות קטנה ומספר.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await resetPassword(token, newPassword);

      if (!response.success) {
        setError(
          response.errors?.[0]?.message ||
            response.errors?.[0]?.msg ||
            response.message ||
            "לא הצלחנו לעדכן את הסיסמה."
        );
        return;
      }

      navigate(APP_ROUTES.login, {
        replace: true,
        state: { toastMessage: response.message || "הסיסמה עודכנה בהצלחה" },
      });
    } catch {
      setError("אירעה שגיאה באיפוס הסיסמה. נסו שוב בהמשך.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <section className="auth-card reset-password-card">
          <header className="auth-card-header">
            <h1>קישור איפוס חסר</h1>
            <p>לא התקבל token לאיפוס סיסמה. בקשו קישור חדש ממסך ההתחברות.</p>
          </header>
          <button
            className="auth-button"
            type="button"
            onClick={() => navigate(APP_ROUTES.login)}
          >
            חזרה להתחברות
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <section className="auth-card reset-password-card">
        <header className="auth-card-header">
          <h1>בחירת סיסמה חדשה</h1>
          <p>הזינו סיסמה חדשה לחשבון שלכם. הקישור תקף לזמן מוגבל ומשמש פעם אחת.</p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label className="auth-field">
            <span>סיסמה חדשה</span>
            <input
              className="auth-input-control"
              type="password"
              placeholder="הזינו סיסמה חדשה"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <label className="auth-field">
            <span>אימות סיסמה חדשה</span>
            <input
              className="auth-input-control"
              type="password"
              placeholder="הזינו שוב את הסיסמה"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </label>

          <p className="auth-helper-text">{PASSWORD_HINT}</p>

          {error ? <div className="auth-error">{error}</div> : null}

          <button className="auth-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader /> : "עדכון סיסמה"}
          </button>

          <button
            className="auth-link auth-secondary-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.login)}
          >
            חזרה להתחברות
          </button>
        </form>
      </section>
    </div>
  );
}
