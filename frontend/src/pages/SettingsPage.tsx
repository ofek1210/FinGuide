import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  updateProfile,
  getAvatarDisplayUrl,
  AVATAR_STORAGE_KEY,
} from "../api/profile.api";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import { useAuth } from "../auth/AuthProvider";
import { APP_ROUTES } from "../types/navigation";
import { logoutWithConfirm } from "../utils/logout";
import { changePassword } from "../api/auth.api";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, status, refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [emailSaveLoading, setEmailSaveLoading] = useState(false);
  const [passwordSaveLoading, setPasswordSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState<"success" | "error" | "backend-required" | null>(null);
  const [emailSaveMessage, setEmailSaveMessage] = useState<"success" | "error" | null>(null);
  const [passwordSaveMessage, setPasswordSaveMessage] = useState<"success" | "error" | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ name?: string; email?: string }>({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = status === "checking";
  const displayAvatarUrl = avatarPreviewUrl ?? getAvatarDisplayUrl(user ?? null);

  useEffect(() => {
    if (!user) {
      setError("לא הצלחנו לטעון את פרטי החשבון.");
      return;
    }
    setName(user.name);
    setEmail(user.email);
    setCreatedAt(user.createdAt ?? "");
    setError("");
    setFieldError({});
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      try {
        localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl);
        setAvatarPreviewUrl(dataUrl);
        setSaveMessage(null);
      } catch {
        setSaveMessage("error");
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    setSaveMessage(null);
    setFieldError({});
    setSaveLoading(true);
    const res = await updateProfile({ name: name.trim() });
    setSaveLoading(false);

    if (res.success && res.data?.user) {
      setName(res.data.user.name);
      refresh();
      setSaveMessage("success");
    } else {
      const msg = res.message || "שגיאה בשמירה.";
      const status = res.status;
      if (status === 404 || msg.includes("404") || msg.toLowerCase().includes("not found")) {
        setSaveMessage("backend-required");
      } else {
        setSaveMessage("error");
        setError(msg);
        if (res.errors && Array.isArray(res.errors)) {
          const nameErr = res.errors.find(
            (e): e is { field?: string; message?: string } =>
              typeof e === "object" && e !== null && (e as { field?: string }).field === "name",
          );
          if (nameErr && "message" in nameErr) setFieldError({ name: nameErr.message });
        }
      }
    }
  };

  const handleEmailSave = async () => {
    setEmailSaveMessage(null);
    setFieldError((prev) => ({ ...prev, email: undefined }));
    setEmailSaveLoading(true);

    const trimmedEmail = email.trim();
    const res = await updateProfile({ email: trimmedEmail });

    setEmailSaveLoading(false);

    if (res.success && res.data?.user) {
      setEmail(res.data.user.email);
      refresh();
      setEmailSaveMessage("success");
    } else {
      const msg = res.message || "שגיאה בעדכון האימייל.";
      setEmailSaveMessage("error");
      setError(msg);
      if (res.errors && Array.isArray(res.errors)) {
        const emailErr = res.errors.find(
          (e): e is { field?: string; message?: string } =>
            typeof e === "object" && e !== null && (e as { field?: string }).field === "email",
        );
        if (emailErr && "message" in emailErr) {
          setFieldError((prev) => ({ ...prev, email: emailErr.message }));
        }
      }
    }
  };

  const validatePasswordLocally = () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      setPasswordError("נא למלא סיסמה חדשה ואימות סיסמה.");
      return false;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("הסיסמאות אינן תואמות.");
      return false;
    }

    if (newPassword.length < 6) {
      setPasswordError("סיסמה חייבת להיות לפחות 6 תווים.");
      return false;
    }

    const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!complexityRegex.test(newPassword)) {
      setPasswordError("סיסמה חייבת להכיל אות גדולה, אות קטנה ומספר.");
      return false;
    }

    setPasswordError(null);
    return true;
  };

  const handlePasswordChange = async () => {
    setPasswordSaveMessage(null);
    setPasswordError(null);

    const isValid = validatePasswordLocally();
    if (!isValid) return;

    setPasswordSaveLoading(true);

    const response = await changePassword(currentPassword.trim() || null, newPassword);

    setPasswordSaveLoading(false);

    if (response.success) {
      setPasswordSaveMessage("success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      return;
    }

    setPasswordSaveMessage("error");
    setPasswordError(
      response.message ||
        "שגיאה בשינוי הסיסמה. ודאו שהסיסמה הנוכחית נכונה ושהסיסמה החדשה עומדת בכללים.",
    );
  };

  const handleLogout = () => {
    logoutWithConfirm(navigate);
  };

  return (
    <div className="feature-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <section className="dashboard-card">
          <h1 className="feature-page-title">הגדרות חשבון</h1>
          <p className="feature-page-subtitle">ניהול הפרופיל וההעדפות שלכם.</p>
        </section>

        {error ? <div className="feature-page-inline-error">{error}</div> : null}
        {saveMessage === "success" && (
          <div className="settings-banner settings-banner-success">השינויים נשמרו בהצלחה.</div>
        )}
        {saveMessage === "backend-required" && (
          <div className="settings-banner settings-banner-info">
            נדרש מהבאק: עדכון פרופיל (PATCH /api/auth/me) והעלאת תמונת פרופיל. בינתיים השם נשמר מקומית והתמונה מוצגת מדמו.
          </div>
        )}
        {saveMessage === "error" && (
          <div className="settings-banner settings-banner-error">שגיאה בשמירת השינויים. נסו שוב.</div>
        )}

        <section className="dashboard-card feature-page-grid">
          {isLoading ? (
            <div className="findings-placeholder">
              <Loader />
              טוענים פרטי חשבון...
            </div>
          ) : (
            <div className="settings-form">
              <div className="settings-avatar-block">
                <div className="settings-avatar-preview-wrap">
                  {displayAvatarUrl ? (
                    <img
                      src={displayAvatarUrl}
                      alt=""
                      className="settings-avatar-preview"
                    />
                  ) : (
                    <span className="settings-avatar-initials">
                      {name.trim() ? name.trim().charAt(0).toUpperCase() : "?"}
                    </span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="dashboard-upload-input"
                  aria-label="בחירת תמונת פרופיל"
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  className="dashboard-hero-action"
                  onClick={() => fileInputRef.current?.click()}
                >
                  בחירת תמונה
                </button>
                <p className="settings-avatar-note">
                  התמונה נשמרת מקומית (דמו). נדרש מהבאק: endpoint להעלאת Avatar.
                </p>
              </div>

              <div className="settings-field">
                <label htmlFor="settings-name">שם מלא</label>
                <input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="settings-input"
                  dir="rtl"
                />
                {fieldError.name && (
                  <span className="settings-field-error">{fieldError.name}</span>
                )}
              </div>

              <div className="settings-meta">
                <span>נוצר בתאריך</span>
                <strong>{createdAt ? new Date(createdAt).toLocaleDateString("he-IL") : "—"}</strong>
              </div>
            </div>
          )}
        </section>

        <section className="dashboard-card feature-page-grid">
          <div className="settings-form">
            <h2 className="feature-card-title">שינוי אימייל</h2>
            <p className="feature-card-subtitle">
              עדכון כתובת האימייל אליה תקבלו התראות ומסמכים. הפעולה דורשת התחברות פעילה.
            </p>

            {emailSaveMessage === "success" && (
              <div className="settings-banner settings-banner-success">
                האימייל עודכן בהצלחה.
              </div>
            )}
            {emailSaveMessage === "error" && (
              <div className="settings-banner settings-banner-error">
                שגיאה בעדכון האימייל. נסו שוב.
              </div>
            )}

            <div className="settings-field">
              <label htmlFor="settings-email">אימייל</label>
              <input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailSaveMessage(null);
                  setFieldError((prev) => ({ ...prev, email: undefined }));
                }}
                className="settings-input"
                dir="ltr"
              />
              {fieldError.email && (
                <span className="settings-field-error">{fieldError.email}</span>
              )}
            </div>

            <div className="feature-page-actions">
              <button
                className="dashboard-hero-action"
                type="button"
                disabled={emailSaveLoading}
                onClick={handleEmailSave}
              >
                {emailSaveLoading ? "שומר..." : "שמירת אימייל"}
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-card feature-page-grid">
          <div className="settings-form">
            <h2 className="feature-card-title">שינוי סיסמה</h2>
            <p className="feature-card-subtitle">
              עדכון סיסמת ההתחברות שלכם. למשתמשים שנרשמו רק עם Google, ניתן להגדיר כאן סיסמה
              ראשונה.
            </p>

            {passwordSaveMessage === "success" && (
              <div className="settings-banner settings-banner-success">
                הסיסמה עודכנה בהצלחה.
              </div>
            )}
            {passwordSaveMessage === "error" && (
              <div className="settings-banner settings-banner-error">
                לא הצלחנו לעדכן את הסיסמה. בדקו את הפרטים ונסו שוב.
              </div>
            )}

            <div className="settings-field">
              <label htmlFor="settings-current-password">סיסמה נוכחית</label>
              <input
                id="settings-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  setPasswordSaveMessage(null);
                  setPasswordError(null);
                }}
                className="settings-input"
                dir="ltr"
              />
              <p className="settings-field-note">
                חובה רק עבור משתמשים שנרשמו עם אימייל וסיסמה. עבור משתמשי Google בלבד ניתן להשאיר
                ריק כדי להגדיר סיסמה ראשונה.
              </p>
            </div>

            <div className="settings-field">
              <label htmlFor="settings-new-password">סיסמה חדשה</label>
              <input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setPasswordSaveMessage(null);
                  setPasswordError(null);
                }}
                className="settings-input"
                dir="ltr"
              />
            </div>

            <div className="settings-field">
              <label htmlFor="settings-confirm-password">אימות סיסמה חדשה</label>
              <input
                id="settings-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setPasswordSaveMessage(null);
                  setPasswordError(null);
                }}
                className="settings-input"
                dir="ltr"
              />
              <p className="settings-field-note">
                הסיסמה חייבת להיות לפחות 6 תווים, ולכלול אות גדולה, אות קטנה ומספר.
              </p>
            </div>

            {passwordError && (
              <div className="settings-field-error" style={{ marginTop: "0.5rem" }}>
                {passwordError}
              </div>
            )}

            <div className="feature-page-actions">
              <button
                className="dashboard-hero-action"
                type="button"
                disabled={passwordSaveLoading}
                onClick={handlePasswordChange}
              >
                {passwordSaveLoading ? "מעדכן..." : "שינוי סיסמה"}
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-card feature-page-actions">
          <button
            className="dashboard-hero-action"
            type="button"
            disabled={saveLoading}
            onClick={handleSave}
          >
            {saveLoading ? "שומר..." : "שמירת שינויים"}
          </button>
          <button
            className="dashboard-hero-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.dashboard)}
          >
            חזרה ללוח הבקרה
          </button>
          <button className="dashboard-logout-action" type="button" onClick={handleLogout}>
            התנתקות
          </button>
        </section>

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
