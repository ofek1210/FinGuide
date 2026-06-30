/**
 * SettingsPage — account & profile editing, redesigned to the design system
 * (ui_kits/app/Settings.jsx): a purple profile hero with avatar + completion
 * ring, a sticky scroll-spy section rail, themed section cards, a floating save
 * bar that appears on change, and a red danger zone. Account-level = lavender.
 *
 * Every action is wired to the real backend (updateProfile, uploadAvatar,
 * changePassword, gmail disconnect, data deletes) with success/error toasts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, BarChart3, Check, Eye, EyeOff, FileText,
  Loader2, Lock, LogOut, Mail, Shield, Trash2, Unplug, Upload,
  type LucideIcon,
} from "lucide-react";
import { updateProfile, getAvatarDisplayUrl, resolveAvatarUrl, uploadAvatar } from "../api/profile.api";
import { changePassword } from "../api/auth.api";
import { apiJson } from "../api/client";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import Loader from "../components/ui/Loader";
import { useAuth } from "../auth/AuthProvider";
import { APP_ROUTES } from "../types/navigation";
import { logoutWithConfirm } from "../utils/logout";

type Toast = { type: "success" | "error"; text: string } | null;
type SectionId = "profile" | "onboarding" | "email" | "password" | "privacy";

const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "פרופיל", icon: FileText },
  { id: "onboarding", label: "Onboarding", icon: BarChart3 },
  { id: "email", label: "אימייל", icon: Mail },
  { id: "password", label: "סיסמה", icon: Lock },
  { id: "privacy", label: "פרטיות ונתונים", icon: Shield },
];

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)", padding: "26px 28px" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)", marginBottom: 7 };
const fieldStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: "var(--r-md)", border: "1px solid var(--border-soft)", background: "var(--surface-sunken)", fontFamily: "var(--font-body)", fontSize: 14.5, fontWeight: 600, color: "var(--ink)", outline: "none" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 14, color: "#fff", background: "var(--ink)", boxShadow: "var(--shadow-ink)" };
const dangerBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 15px", borderRadius: "var(--r-sm)", border: "1px solid rgba(214,69,69,.35)", background: "var(--card)", color: "#C23B3B", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 12.5, cursor: "pointer", flex: "none", whiteSpace: "nowrap" };

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, status, refresh } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const [active, setActive] = useState<SectionId>("profile");
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = status === "checking";
  const displayAvatarUrl = resolveAvatarUrl(avatarPreviewUrl) ?? getAvatarDisplayUrl(user ?? null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!document.getElementById("set-anim")) {
      const st = document.createElement("style");
      st.id = "set-anim";
      st.textContent =
        "@keyframes setRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
        "@keyframes setBar{from{opacity:0}to{opacity:1}}" +
        "@media (prefers-reduced-motion:reduce){[style*=setRise]{animation:none!important}}";
      document.head.appendChild(st);
    }
  }, []);

  useEffect(() => {
    void apiJson<{ success: boolean; data: { connected: boolean } }>("/api/integrations/gmail/status", { auth: true }).then(res => {
      if (res.ok && res.data) setGmailConnected(res.data.data?.connected === true);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  // scroll-spy
  useEffect(() => {
    const io = new IntersectionObserver(
      ents => ents.forEach(e => { if (e.isIntersecting) setActive((e.target as HTMLElement).dataset.sec as SectionId); }),
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    Object.values(refs.current).forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, [isLoading]);

  const goTo = (id: SectionId) => {
    const el = refs.current[id];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
  };

  const dirty = !!user && name.trim() !== user.name && name.trim().length > 0;

  // profile completion (real-ish): name, avatar, onboarding done
  const completion = (() => {
    const flags = [Boolean(user?.name?.trim()), Boolean(displayAvatarUrl), Boolean(user?.onboardingCompleted)];
    return Math.round((flags.filter(Boolean).length / flags.length) * 100);
  })();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setToast({ type: "error", text: "רק קבצי תמונה מורשים להעלאה." }); return; }
    setAvatarUploading(true);
    const res = await uploadAvatar(file);
    setAvatarUploading(false);
    if (res.success) {
      if (res.avatarUrl) setAvatarPreviewUrl(res.avatarUrl);
      await refresh();
      setToast({ type: "success", text: "תמונת הפרופיל עודכנה" });
    } else {
      setToast({ type: "error", text: res.message ?? "שגיאה בהעלאת התמונה." });
    }
  };

  const handleSaveName = async () => {
    setSavingName(true);
    const res = await updateProfile({ name: name.trim() });
    setSavingName(false);
    if (res.success && res.data?.user) { setName(res.data.user.name); refresh(); setToast({ type: "success", text: "השם נשמר בהצלחה" }); }
    else setToast({ type: "error", text: res.message || "שגיאה בשמירת השם." });
  };

  const handleEmailSave = async () => {
    setSavingEmail(true);
    const res = await updateProfile({ email: email.trim() });
    setSavingEmail(false);
    if (res.success && res.data?.user) { setEmail(res.data.user.email); refresh(); setToast({ type: "success", text: "האימייל עודכן בהצלחה" }); }
    else setToast({ type: "error", text: res.message || "שגיאה בעדכון האימייל." });
  };

  const handlePasswordChange = async () => {
    setPwError(null);
    if (!currentPassword.trim()) { setPwError("נא להזין סיסמה נוכחית."); return; }
    if (!newPassword.trim() || !confirmPassword.trim()) { setPwError("נא למלא סיסמה חדשה ואימות."); return; }
    if (newPassword !== confirmPassword) { setPwError("הסיסמאות אינן תואמות."); return; }
    if (newPassword.length < 6) { setPwError("סיסמה חייבת להיות לפחות 6 תווים."); return; }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) { setPwError("סיסמה חייבת להכיל אות גדולה, אות קטנה ומספר."); return; }
    setSavingPw(true);
    const res = await changePassword(currentPassword, newPassword);
    setSavingPw(false);
    if (res.success) {
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setToast({ type: "success", text: "הסיסמה עודכנה בהצלחה" });
    } else {
      const first = res.errors?.[0] && ("message" in res.errors[0] ? res.errors[0].message : (res.errors[0] as { msg?: string }).msg);
      setPwError(first || res.message || "שגיאה בשינוי הסיסמה.");
    }
  };

  const runDanger = useCallback(async (key: string, confirmText: string, endpoint: string, okText: string, errText: string, onOk?: () => void) => {
    if (!window.confirm(confirmText)) return;
    setPrivacyLoading(key);
    const res = await apiJson(endpoint, { method: "DELETE", auth: true });
    setPrivacyLoading(null);
    if (res.ok) { onOk?.(); setToast({ type: "success", text: okText }); }
    else setToast({ type: "error", text: errText });
  }, []);

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <PrivateTopbar />
      {children}
      <AppFooter variant="private" />
      {toast && (
        <div style={{ position: "fixed", insetInlineStart: "50%", transform: "translateX(-50%)", bottom: dirty ? 86 : 26, zIndex: 40, display: "flex", alignItems: "center", gap: 10, padding: "13px 20px", borderRadius: "var(--r-pill)", background: toast.type === "success" ? "var(--mint-ink)" : "var(--danger)", color: "#fff", boxShadow: "var(--shadow-xl)", fontWeight: 800, fontSize: 14, animation: "setBar .3s var(--ease) both" }}>
          {toast.type === "success" ? <Check size={17} strokeWidth={2.8} /> : <AlertTriangle size={17} />}
          {toast.text}
        </div>
      )}
    </div>
  );

  if (isLoading) {
    return shell(<main style={{ minHeight: "55vh", display: "grid", placeItems: "center" }}><Loader /></main>);
  }
  if (!user) {
    return shell(<main style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px", textAlign: "center", color: "var(--danger)", fontWeight: 700 }}>לא הצלחנו לטעון את פרטי החשבון.</main>);
  }

  return shell(
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px 130px" }}>
      {/* profile hero band */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius)", padding: "30px 32px", marginBottom: 26, background: "linear-gradient(135deg,#2A2150,#3B2E6E 60%,#5A47A8)", boxShadow: "var(--shadow-card)", animation: "setRise .5s var(--ease) both" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: 92, height: 92, flex: "none" }}>
            <svg width="92" height="92" viewBox="0 0 64 64" style={{ position: "absolute", inset: 0 }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="4" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="#A6E5BC" strokeWidth="4" strokeLinecap="round" strokeDasharray={2 * Math.PI * 26} strokeDashoffset={2 * Math.PI * 26 * (1 - completion / 100)} transform="rotate(-90 32 32)" style={{ transition: "stroke-dashoffset .8s var(--ease)" }} />
            </svg>
            <div style={{ position: "absolute", inset: 9, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(145deg,#C9B6FF,#8A6CE0)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, fontSize: 28, boxShadow: "inset 0 2px 6px rgba(255,255,255,.3)" }}>
              {displayAvatarUrl ? <img src={displayAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name.trim() ? name.trim().charAt(0).toUpperCase() : "?")}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} disabled={avatarUploading} />
            <button title="בחירת תמונה" onClick={() => fileInputRef.current?.click()} style={{ position: "absolute", bottom: -2, insetInlineEnd: -2, width: 30, height: 30, borderRadius: "50%", border: "3px solid #3B2E6E", background: "#fff", color: "var(--lav-600)", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "var(--shadow-soft)" }}>
              {avatarUploading ? <Loader2 size={13} style={{ animation: "spin .8s linear infinite" }} /> : <Upload size={14} />}
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-.025em", color: "#fff" }}>{user.name}</div>
            <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.62)", fontWeight: 600, marginTop: 4 }}>
              {user.email}{user.createdAt ? ` · חבר מאז ${new Date(user.createdAt).toLocaleDateString("he-IL")}` : ""}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12 }}>
              <div style={{ width: 150, height: 6, borderRadius: 999, background: "rgba(255,255,255,.18)", overflow: "hidden" }}>
                <div style={{ width: `${completion}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#A6E5BC,#7BD2A0)", transition: "width .8s var(--ease)" }} />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "#A6E5BC" }}>{completion}% הושלם</span>
            </div>
          </div>
        </div>
      </div>

      {/* sticky rail + sections */}
      <div style={{ display: "grid", gridTemplateColumns: "208px 1fr", gap: 26, alignItems: "start" }}>
        <nav style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 4 }}>
          {SECTIONS.map(s => {
            const on = active === s.id;
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => goTo(s.id)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", borderRadius: "var(--r-md)", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 14, textAlign: "start", background: on ? "var(--lav-100)" : "transparent", color: on ? "var(--lav-600)" : "var(--text-muted)", transition: "all .2s var(--ease)" }}>
                <span style={{ display: "inline-flex", color: on ? "var(--lav-600)" : "var(--text-faint)" }}><Icon size={17} /></span>{s.label}
              </button>
            );
          })}
        </nav>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* PROFILE */}
          <section ref={el => { refs.current.profile = el; }} data-sec="profile" style={{ ...card, animation: "setRise .5s var(--ease) both" }}>
            <SectionHead title="פרופיל" sub="נהל את התמונה, השם ופרטי החשבון שלך." />
            <label style={labelStyle}>שם מלא</label>
            <input style={fieldStyle} value={name} onChange={e => setName(e.target.value)} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--hair)" }}>
              <span style={{ fontSize: 13.5, color: "var(--text-muted)", fontWeight: 600 }}>נוצר בתאריך</span>
              <span style={{ fontSize: 13.5, fontWeight: 800 }}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString("he-IL") : "—"}</span>
            </div>
          </section>

          {/* ONBOARDING */}
          <section ref={el => { refs.current.onboarding = el; }} data-sec="onboarding" style={{ ...card, animation: "setRise .5s var(--ease) both" }}>
            <SectionHead title="Onboarding" sub="עדכן את פרטי ההגדרה המהירה שלך בכל רגע." />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 18px", borderRadius: "var(--r-md)", background: "var(--lav-50)", border: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--card)", color: "var(--lav-600)", display: "grid", placeItems: "center", boxShadow: "var(--shadow-soft)" }}><BarChart3 size={19} /></span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}>פרטי ההגדרה שלך</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>גיל, מצב תעסוקה, יעדים ועוד</div>
                </div>
              </div>
              <button onClick={() => navigate(`${APP_ROUTES.onboarding}?edit=1`)} style={primaryBtn}><ArrowLeft size={16} style={{ transform: "scaleX(-1)" }} /> עריכת Onboarding</button>
            </div>
          </section>

          {/* EMAIL */}
          <section ref={el => { refs.current.email = el; }} data-sec="email" style={{ ...card, animation: "setRise .5s var(--ease) both" }}>
            <SectionHead title="שינוי אימייל" sub="עדכון כתובת האימייל אליה תקבל התראות ומסמכים." />
            <label style={labelStyle}>אימייל</label>
            <input style={{ ...fieldStyle, direction: "ltr" }} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            <div style={{ marginTop: 16 }}>
              <button onClick={handleEmailSave} disabled={savingEmail} style={{ ...primaryBtn, opacity: savingEmail ? 0.6 : 1 }}>
                {savingEmail ? <Loader2 size={15} style={{ animation: "spin .8s linear infinite" }} /> : <Mail size={16} />} שמירת אימייל
              </button>
            </div>
          </section>

          {/* PASSWORD */}
          <section ref={el => { refs.current.password = el; }} data-sec="password" style={{ ...card, animation: "setRise .5s var(--ease) both" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>שינוי סיסמה</h2>
                <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>עדכון סיסמת ההתחברות שלך.</p>
              </div>
              <button onClick={() => setShowPw(v => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 999, border: "1px solid var(--border-soft)", background: "var(--card)", color: "var(--text-muted)", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 12.5, cursor: "pointer", flex: "none" }}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}{showPw ? "הסתר סיסמאות" : "הצג סיסמאות"}
              </button>
            </div>
            {([
              ["סיסמה נוכחית", currentPassword, setCurrentPassword, "חובה לכל המשתמשים לצורך שינוי הסיסמה."],
              ["סיסמה חדשה", newPassword, setNewPassword, "לפחות 6 תווים, ולכלול אות גדולה, אות קטנה ומספר."],
              ["אימות סיסמה חדשה", confirmPassword, setConfirmPassword, ""],
            ] as const).map(([lab, val, setter, hint]) => (
              <div key={lab} style={{ marginBottom: 16 }}>
                <label style={labelStyle}>{lab}</label>
                <input style={fieldStyle} type={showPw ? "text" : "password"} placeholder="••••••••" value={val} onChange={e => { setter(e.target.value); setPwError(null); }} dir="ltr" />
                {hint && <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 6 }}>{hint}</div>}
              </div>
            ))}
            {pwError && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)", marginBottom: 12 }}>{pwError}</div>}
            <button onClick={handlePasswordChange} disabled={savingPw} style={{ ...primaryBtn, opacity: savingPw ? 0.6 : 1 }}>
              {savingPw ? <Loader2 size={15} style={{ animation: "spin .8s linear infinite" }} /> : <Lock size={16} />} שינוי סיסמה
            </button>
          </section>

          {/* PRIVACY / DANGER */}
          <section ref={el => { refs.current.privacy = el; }} data-sec="privacy" style={{ background: "rgba(214,69,69,.035)", border: "1px solid rgba(214,69,69,.2)", borderRadius: "var(--radius)", padding: "26px 28px", animation: "setRise .5s var(--ease) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ color: "#C23B3B", display: "inline-flex" }}><Shield size={19} /></span>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-.02em", color: "#A93232" }}>פרטיות ומחיקת נתונים</h2>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "15px 0", borderBottom: "1px solid rgba(214,69,69,.14)" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}>חיבור Gmail</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: gmailConnected ? "var(--mint-ink)" : "var(--text-muted)" }}>
                  {gmailConnected === null ? "בודק…" : gmailConnected ? "מחובר" : "אינו מחובר"}
                </div>
              </div>
              {gmailConnected && (
                <button style={dangerBtn} disabled={privacyLoading === "gmail"} onClick={() => runDanger("gmail", "לנתק את Gmail? ניתן לחבר מחדש בכל עת.", "/api/integrations/gmail/disconnect", "Gmail נותק בהצלחה", "שגיאה בניתוק Gmail", () => setGmailConnected(false))}>
                  {privacyLoading === "gmail" ? <Loader2 size={13} style={{ animation: "spin .8s linear infinite" }} /> : <Unplug size={14} />} נתק
                </button>
              )}
            </div>

            {([
              ["נתוני פנסיה", "מחיקת כל קרנות הפנסיה שצברת", "pension", "/api/pension/funds", "נתוני הפנסיה נמחקו"],
              ["נתוני ביטוח", "מחיקת כל פוליסות הביטוח שמופו", "insurance", "/api/insurance/data", "נתוני הביטוח נמחקו"],
            ] as const).map(([t, d, key, endpoint, ok]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "15px 0", borderBottom: "1px solid rgba(214,69,69,.14)" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}>{t}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{d}</div>
                </div>
                <button style={dangerBtn} disabled={privacyLoading === key} onClick={() => runDanger(key, `${d}? פעולה זו אינה הפיכה.`, endpoint, ok, "שגיאה במחיקת הנתונים")}>
                  {privacyLoading === key ? <Loader2 size={13} style={{ animation: "spin .8s linear infinite" }} /> : <Trash2 size={14} />} מחק
                </button>
              </div>
            ))}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, paddingTop: 16 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 14.5, color: "#A93232" }}>מחק את כל הנתונים</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>מחיקת כל המסמכים, הניתוחים וההיסטוריה. לא ניתן לשחזר.</div>
              </div>
              <button style={{ ...dangerBtn, background: "#C23B3B", color: "#fff", border: "none" }} disabled={privacyLoading === "all"} onClick={() => runDanger("all", "למחוק את כל הניתוחים והמסמכים? פעולה זו אינה הפיכה.", "/api/documents/all", "כל הנתונים נמחקו", "שגיאה במחיקת נתונים")}>
                {privacyLoading === "all" ? <Loader2 size={13} style={{ animation: "spin .8s linear infinite" }} /> : <Trash2 size={14} />} מחק הכל
              </button>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(214,69,69,.14)", display: "flex", justifyContent: "flex-start" }}>
              <button onClick={() => logoutWithConfirm(navigate)} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 13.5, color: "var(--text-muted)" }}>
                <LogOut size={15} /> התנתקות
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* floating save bar (profile name) */}
      {dirty && (
        <div style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", zIndex: 30, display: "flex", alignItems: "center", gap: 14, padding: "12px 14px 12px 22px", borderRadius: 999, background: "var(--ink)", boxShadow: "0 12px 36px rgba(0,0,0,.28)", animation: "setBar .35s var(--ease) both" }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "rgba(255,255,255,.85)" }}>יש לך שינויים שלא נשמרו</span>
          <button onClick={() => setName(user.name)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.6)", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>ביטול</button>
          <button onClick={handleSaveName} disabled={savingName} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 999, border: "none", background: "#fff", color: "var(--ink)", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 13.5, cursor: "pointer" }}>
            {savingName ? <Loader2 size={14} style={{ animation: "spin .8s linear infinite" }} /> : null} שמירת שינויים
          </button>
        </div>
      )}
    </main>,
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>{title}</h2>
      {sub && <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}
