import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  updateProfile,
  uploadAvatar,
  getAvatarDisplayUrl,
  AVATAR_STORAGE_KEY,
} from "../api/profile.api";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import { useAuth } from "../auth/AuthProvider";
import { APP_ROUTES } from "../types/navigation";
import { logoutWithConfirm } from "../utils/logout";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, status, refresh } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState<"success" | "error" | "backend-required" | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<{ name?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarObjectUrlRef = useRef<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (avatarObjectUrlRef.current) {
        URL.revokeObjectURL(avatarObjectUrlRef.current);
        avatarObjectUrlRef.current = null;
      }
    };
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    setAvatarError(null);
    setAvatarUploading(true);
    const res = await uploadAvatar(file);
    setAvatarUploading(false);
    if (res.success) {
      localStorage.removeItem(AVATAR_STORAGE_KEY);
      if (avatarObjectUrlRef.current) {
        URL.revokeObjectURL(avatarObjectUrlRef.current);
        avatarObjectUrlRef.current = null;
      }
      const objectUrl = URL.createObjectURL(file);
      avatarObjectUrlRef.current = objectUrl;
      setAvatarPreviewUrl(objectUrl);
      refresh();
    } else {
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      if (dataUrl) {
        try {
          localStorage.setItem(AVATAR_STORAGE_KEY, dataUrl);
          setAvatarPreviewUrl(dataUrl);
        } catch {
          setAvatarError("לא ניתן לשמור תמונה מקומית.");
        }
      }
      setAvatarError(res.message || "שגיאה בהעלאת התמונה.");
    }
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
            עדכון שם הפרופיל לא זמין כרגע בשרת. התמונה נשמרת בשרת.
          </div>
        )}
        {avatarError ? (
          <div className="settings-banner settings-banner-error">{avatarError}</div>
        ) : null}
        {avatarUploading ? (
          <div className="settings-banner settings-banner-info">מעלה תמונה...</div>
        ) : null}
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
                  בחרו קובץ תמונה (JPG, PNG) להעלאה.
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

              <div className="settings-field">
                <label htmlFor="settings-email">אימייל</label>
                <input
                  id="settings-email"
                  type="email"
                  value={email}
                  readOnly
                  className="settings-input settings-input-readonly"
                  dir="ltr"
                />
                <p className="settings-field-note">שינוי אימייל אינו נתמך כרגע.</p>
              </div>

              <div className="settings-meta">
                <span>נוצר בתאריך</span>
                <strong>{createdAt ? new Date(createdAt).toLocaleDateString("he-IL") : "—"}</strong>
              </div>
            </div>
          )}
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
