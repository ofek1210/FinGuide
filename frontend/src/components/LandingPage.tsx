import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart2,
  Bot,
  CheckCircle,
  ChevronDown,
  FileText,
  Lock,
  Mail,
  PiggyBank,
  Shield,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { APP_ROUTES } from "../types/navigation";
import AppFooter from "./AppFooter";
import "../theme/finq.css";

const pillars = [
  {
    id: "pension",
    icon: <PiggyBank size={24} />,
    title: "ניהול פנסיה AI",
    desc: "ניתוח קרנות פנסיה, דמי ניהול, תחזיות פרישה וסימולציות חלופיות — הכל אוטומטי.",
    features: ["תחזית הכנסה חודשית בפרישה", "השוואת קרנות פנסיה", "ניתוח דמי ניהול", "סימולציית גיל פרישה"],
  },
  {
    id: "insurance",
    icon: <ShieldCheck size={24} />,
    title: "ניהול ביטוח AI",
    desc: "זיהוי פוליסות כפולות, כיסוי חסר, פרמיות גבוהות — וחיסכון ריאלי לפי הפרופיל שלך.",
    features: ["זיהוי ביטוחים כפולים", "חיסכון פוטנציאלי", "כיסוי לפי מצב משפחתי", "ניתוח פרמיות"],
  },
  {
    id: "payslip",
    icon: <FileText size={24} />,
    title: "ניהול תלושים AI",
    desc: "ייבוא אוטומטי מג'ימייל, חילוץ OCR, ניתוח מגמות שכר וזיהוי חריגות.",
    features: ["ייבוא מג'ימייל", "זיהוי חריגות בשכר", "ניתוח מגמות", "מסמכים חסרים"],
  },
] as const;

const features = [
  {
    icon: <Bot size={20} />,
    title: "AI מרובה-סוכנים",
    desc: "ארכיטקטורת Multi-Agent: סוכן פנסיה, ביטוח, תלוש ופרופיל פיננסי — פועלים במקביל.",
  },
  {
    icon: <Zap size={20} />,
    title: "תשובות מיידיות",
    desc: "Streaming בזמן אמת. כל תשובה מבוססת על הנתונים שלך — לא על ממוצעים כלליים.",
  },
  {
    icon: <Lock size={20} />,
    title: "אבטחה מלאה",
    desc: "הנתונים שלך לא נשלחים ל-LLM. ה-AI מקבל רק סיכומים מחושבים — לא מסמכים גולמיים.",
  },
  {
    icon: <TrendingUp size={20} />,
    title: "ציון פיננסי",
    desc: "ציון 0–100 עם ניתוח לפי 5 קטגוריות: מסמכים, יציבות שכר, מוכנות מס, פנסיה, ביטוח.",
  },
  {
    icon: <Mail size={20} />,
    title: "חיבור Gmail",
    desc: "חיבור read-only לחשבון ה-Gmail שלך לייבוא תלושים אוטומטי — ללא שמירת סיסמאות.",
  },
  {
    icon: <BarChart2 size={20} />,
    title: "גרפים ומגמות",
    desc: "ויזואליזציה של שכר, פנסיה ומס לאורך זמן — כדי שתוכל לראות לאן אתה הולך.",
  },
];

const steps = [
  { num: "1", title: "הרשמה", desc: "יצירת חשבון ומילוי פרופיל פיננסי ראשוני" },
  { num: "2", title: "העלאת מסמכים", desc: "תלושי שכר, קרנות פנסיה — ידנית או מג'ימייל" },
  { num: "3", title: "ניתוח AI", desc: "הסוכנים מנתחים ומחפשים פערים, חריגות וחסכונות" },
  { num: "4", title: "פעולה", desc: "המלצות ממוקדות עם השפעה כספית ריאלית" },
];

const testimonials = [
  {
    text: "FinGuide גילה לי שאני משלם דמי ניהול פנסיה גבוהים ב-40% מהממוצע. עברתי קרן וחסכתי ₪180 לחודש.",
    name: "ד.כ",
    role: "מהנדסת תוכנה, תל אביב",
    initial: "ד",
  },
  {
    text: "הייתי מבולבל לגמרי מהתלוש שלי. FinGuide הסביר לי כל שורה בעברית פשוטה. שינה לי את ההבנה.",
    name: "נ.ל",
    role: "רופא, ירושלים",
    initial: "נ",
  },
  {
    text: "גיליתי שיש לי ביטוח חיים כפול — פעם אחת דרך המעסיק ופעם אחת שרכשתי בעצמי. חסכתי ₪320 לחודש.",
    name: "א.מ",
    role: "מנהל פרויקטים, חיפה",
    initial: "א",
  },
];

const faqs = [
  {
    q: "האם FinGuide בטוח לחיבור Gmail שלי?",
    a: "כן. אנו משתמשים ב-OAuth של Google עם הרשאות read-only בלבד — אנחנו לא יכולים לשלוח מיילים או לגשת לתוכן שאינו תלושי שכר. הטוקן מוצפן ב-AES-256.",
  },
  {
    q: "האם הנתונים שלי הולכים ל-AI?",
    a: "לא. ה-LLM (Claude) מקבל רק סיכומים מחושבים — מספרים ונקודות מפתח. מסמכים גולמיים, שמות, מספרי תעודת זהות ופרטים רגישים לא נשלחים לשום מודל שפה.",
  },
  {
    q: "מה ההבדל בין FinGuide לרואה חשבון?",
    a: "FinGuide הוא כלי להבנה וניתוח — לא ייעוץ מס מורשה. אנחנו מסייעים לך להבין את המצב הפיננסי שלך ולהגיע עם שאלות ממוקדות לרואה החשבון שלך.",
  },
  {
    q: "כמה זמן לוקח הניתוח הראשוני?",
    a: "תהליך ה-onboarding לוקח כ-3 דקות. ניתוח תלוש שכר ראשוני לוקח כ-30 שניות. ניתוח מלא (פנסיה + ביטוח + תלושים) — כ-2 דקות.",
  },
  {
    q: "האם FinGuide תומך בעצמאיים?",
    a: "כרגע הפלטפורמה מותאמת בעיקר לשכירים. תמיכה בעצמאיים (חשבוניות, מע\"מ, מקדמות ביטוח לאומי) מתוכננת לרבעון הבא.",
  },
];

const aiLayers = [
  {
    num: "1",
    title: "Rule Engine",
    sub: "זיהוי חריגות, ביטוח כפול, מסמכים חסרים",
  },
  {
    num: "2",
    title: "Calculation Engine",
    sub: "תחזיות פנסיה, מגמות שכר, ציון פיננסי",
  },
  {
    num: "3",
    title: "LLM Layer — Claude AI",
    sub: "הסברים בעברית, המלצות, תשובות חופשיות",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem("token"));
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleStart = () =>
    navigate(hasToken ? APP_ROUTES.dashboard : APP_ROUTES.register);

  return (
    <div className="fg-landing">
      {/* ── NAV ── */}
      <nav className="fg-nav">
        <div className="fg-container fg-nav-inner">
          <a className="fg-nav-logo" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            <div className="fg-nav-logo-icon">FG</div>
            <span className="fg-nav-logo-name">Fin<span>Guide</span></span>
          </a>

          <ul className="fg-nav-links">
            <li><button className="fg-nav-link" onClick={() => document.getElementById("fg-pillars")?.scrollIntoView({ behavior: "smooth" })}>יכולות</button></li>
            <li><button className="fg-nav-link" onClick={() => document.getElementById("fg-how")?.scrollIntoView({ behavior: "smooth" })}>איך זה עובד</button></li>
            <li><button className="fg-nav-link" onClick={() => document.getElementById("fg-faq")?.scrollIntoView({ behavior: "smooth" })}>שאלות נפוצות</button></li>
          </ul>

          <div className="fg-nav-actions">
            <button className="fg-btn fg-btn-secondary fg-btn-sm" onClick={() => navigate(APP_ROUTES.login)}>
              התחברות
            </button>
            <button className="fg-btn fg-btn-primary fg-btn-sm" onClick={handleStart}>
              התחל בחינם
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="fg-section fg-hero">
        <div className="fg-container fg-hero-inner">
          {/* Content */}
          <div className="fg-hero-content">
            <div className="fg-hero-badge">
              <span className="fg-badge-dot" />
              מבוסס Claude AI + Multi-Agent Architecture
            </div>

            <h1 className="fg-hero-title">
              ניהול פיננסי<br />
              <mark>מונע בינה</mark><br />
              מלאכותית
            </h1>

            <p className="fg-hero-sub">
              FinGuide מנתח תלושי שכר, קרנות פנסיה וביטוחים — ומחזיר המלצות ברורות בעברית. 
              שלושה מודולי AI, סוכנים מקבילים, תוצאות אמיתיות.
            </p>

            <div className="fg-hero-actions">
              <button className="fg-btn fg-btn-primary fg-btn-lg" onClick={handleStart}>
                התחל בחינם
                <ArrowLeft size={18} />
              </button>
              <button className="fg-btn fg-btn-secondary fg-btn-lg" onClick={() => navigate(APP_ROUTES.integrationsEmail)}>
                <Mail size={18} />
                חיבור Gmail
              </button>
            </div>

            <div className="fg-hero-trust">
              {[
                "הצפנה מקצה לקצה",
                "ללא שמירת סיסמאות",
                "פרטיות מלאה",
              ].map((t) => (
                <div className="fg-trust-item" key={t}>
                  <div className="fg-trust-icon">✓</div>
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Visual */}
          <div className="fg-hero-visual">
            <div className="fg-floating-badge left">
              <span style={{ color: "var(--fg-success)" }}>↑</span>
              <span style={{ color: "var(--fg-ink-soft)", fontSize: 12 }}>
                חיסכון פנסיה <strong style={{ color: "var(--fg-ink)" }}>₪340/חודש</strong>
              </span>
            </div>

            <div className="fg-dashboard-mock">
              <div className="fg-mock-header">
                <span className="fg-mock-logo">FinGuide</span>
                <span style={{ fontSize: 12, color: "var(--fg-muted)" }}>דשבורד פיננסי</span>
              </div>

              <div className="fg-mock-score-ring">
                <div className="fg-ring-wrap">
                  <svg viewBox="0 0 100 100">
                    <defs>
                      <linearGradient id="fg-ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#5B4FF5" />
                        <stop offset="100%" stopColor="#2563EB" />
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="42" className="fg-ring-bg" />
                    <circle cx="50" cy="50" r="42" className="fg-ring-fill" />
                  </svg>
                  <div className="fg-ring-label">
                    <span className="fg-ring-score">87</span>
                    <span className="fg-ring-of">/100</span>
                  </div>
                </div>
                <span className="fg-mock-score-label">ציון פיננסי</span>
                <span className="fg-mock-score-sub">מצב פיננסי טוב</span>
              </div>

              <div className="fg-mock-mini-cards">
                <div className="fg-mini-card">
                  <div className="fg-mini-card-label">פנסיה חודשית</div>
                  <div className="fg-mini-card-value">₪8,400</div>
                  <div className="fg-mini-card-trend">↑ 6.2%</div>
                </div>
                <div className="fg-mini-card">
                  <div className="fg-mini-card-label">חיסכון שנתי</div>
                  <div className="fg-mini-card-value">₪4,080</div>
                  <div className="fg-mini-card-trend" style={{ color: "var(--fg-purple)" }}>✦ AI</div>
                </div>
              </div>
            </div>

            <div className="fg-floating-badge bottom">
              <Sparkles size={14} color="var(--fg-purple)" />
              <span style={{ color: "var(--fg-ink-soft)", fontSize: 12 }}>
                זוהתה פוליסה <strong style={{ color: "var(--fg-danger)" }}>כפולה</strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div className="fg-container">
        <div className="fg-stats-bar">
          {[
            { num: "₪1,240", label: "חיסכון ממוצע שזוהה בחודש" },
            { num: "87%", label: "מהמשתמשים מצאו פוליסה כפולה" },
            { num: "3 דקות", label: "ניתוח ראשוני מקיף" },
          ].map((s) => (
            <div className="fg-stat-item" key={s.label}>
              <div className="fg-stat-number">{s.num}</div>
              <div className="fg-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── THREE PILLARS ── */}
      <section id="fg-pillars" className="fg-section">
        <div className="fg-container">
          <div className="fg-section-head">
            <div className="fg-section-label">
              <Sparkles size={13} />
              שלושה מודולים, מחובר אחד לשני
            </div>
            <h2 className="fg-section-title">AI-powered financial management</h2>
            <p className="fg-section-sub">
              שלושה מודולי AI מנתחים את הפנסיה, הביטוח והתלושים שלך — ומחזירים תמונה פיננסית שלמה.
            </p>
          </div>
          <div className="fg-pillars-grid">
            {pillars.map((p) => (
              <article key={p.id} className={`fg-pillar-card ${p.id}`}>
                <div className="fg-pillar-icon-wrap">{p.icon}</div>
                <h3 className="fg-pillar-title">{p.title}</h3>
                <p className="fg-pillar-desc">{p.desc}</p>
                <ul className="fg-pillar-features">
                  {p.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="fg-section" style={{ paddingTop: 0 }}>
        <div className="fg-container">
          <div className="fg-section-head">
            <div className="fg-section-label">
              <Zap size={13} />
              יכולות ליבה
            </div>
            <h2 className="fg-section-title">כל מה שצריך במקום אחד</h2>
          </div>
          <div className="fg-features-grid">
            {features.map((f) => (
              <div key={f.title} className="fg-feature-card">
                <div className="fg-feature-icon">{f.icon}</div>
                <div className="fg-feature-body">
                  <h3 className="fg-feature-title">{f.title}</h3>
                  <p className="fg-feature-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="fg-how" className="fg-section" style={{ paddingTop: 0 }}>
        <div className="fg-container">
          <div className="fg-how-bg">
            <div className="fg-section-head" style={{ marginBottom: 0 }}>
              <div className="fg-section-label">
                <CheckCircle size={13} />
                תהליך פשוט
              </div>
              <h2 className="fg-section-title">איך זה עובד</h2>
              <p className="fg-section-sub">ארבעה שלבים מהרשמה לתוצאות</p>
            </div>
            <div className="fg-steps-grid">
              {steps.map((s) => (
                <div key={s.num} className="fg-step">
                  <div className="fg-step-num">{s.num}</div>
                  <h4 className="fg-step-title">{s.title}</h4>
                  <p className="fg-step-desc">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── AI EXPLANATION ── */}
      <section className="fg-section" style={{ paddingTop: 0 }}>
        <div className="fg-container">
          <div className="fg-ai-section">
            <div className="fg-ai-grid">
              <div>
                <div className="fg-ai-label">
                  <Bot size={13} />
                  ArchitectureAI
                </div>
                <h2 className="fg-ai-title">
                  Hybrid AI —<br />
                  מספרים מחישובים,<br />
                  הסברים מ-Claude
                </h2>
                <p className="fg-ai-desc">
                  ה-AI שלנו בנוי בשלוש שכבות. ה-LLM לא ממציא מספרים — הוא מסביר את מה שהחישובים כבר מצאו.
                </p>
                <div className="fg-ai-layers">
                  {aiLayers.map((l) => (
                    <div key={l.num} className="fg-ai-layer">
                      <div className="fg-ai-layer-num">{l.num}</div>
                      <div>
                        <div className="fg-ai-layer-text">{l.title}</div>
                        <div className="fg-ai-layer-sub">{l.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fg-ai-visual">
                <div className="fg-chat-bubble user">
                  כמה פנסיה אני צריך לקבל בפרישה?
                </div>
                <div className="fg-chat-bubble ai">
                  לפי התלושים שלך, הצבירה הצפויה עד גיל 67 היא **₪1.2M**. עם דמי ניהול נוכחיים של 0.8%, הקצבה החודשית הצפויה היא **₪7,800**.
                  <br /><br />
                  שינוי לקרן עם דמי ניהול 0.2% יגדיל את הקצבה ב-**₪680/חודש** — פרטים בדוח הפנסיה.
                  <div className="fg-chat-source">✦ Claude AI · מבוסס על נתוני הפנסיה שלך</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECURITY ── */}
      <section className="fg-section" style={{ paddingTop: 0 }}>
        <div className="fg-container">
          <div className="fg-security">
            <div>
              <div className="fg-section-label">
                <Shield size={13} />
                פרטיות ואבטחה
              </div>
              <h2 className="fg-security-title">
                הנתונים שלך<br />
                לא הולכים ל-AI
              </h2>
              <p className="fg-security-desc">
                מסמכים גולמיים, שמות ומספרי תעודת זהות לא נשלחים לשום מודל שפה. 
                ה-AI מקבל רק סיכומים מחושבים — מספרים ואחוזים בלבד.
              </p>
              <div className="fg-security-points">
                {[
                  "הצפנת AES-256 לכל הקבצים",
                  "OAuth read-only בלבד לגמייל",
                  "LLM מקבל DTOs — לא נתונים גולמיים",
                  "מחיקת נתונים לפי דרישה",
                  "ללא שיתוף עם צדדים שלישיים",
                ].map((p) => (
                  <div key={p} className="fg-security-point">
                    <div className="fg-security-point-icon">✓</div>
                    {p}
                  </div>
                ))}
              </div>
            </div>
            <div className="fg-security-visual">
              <div className="fg-security-shield">🔐</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--fg-ink)", marginBottom: 8 }}>
                  Zero-Trust Architecture
                </div>
                <div style={{ fontSize: 14, color: "var(--fg-muted)" }}>
                  כל request מאומת ומסונן לפני שמגיע ל-LLM
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 280 }}>
                {["User → Agent → Tool", "Tool → Service → MongoDB", "DTO → LLM → User"].map((flow) => (
                  <div key={flow} style={{
                    background: "white",
                    border: "1px solid var(--fg-border)",
                    borderRadius: "var(--fg-r-sm)",
                    padding: "10px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--fg-ink-soft)",
                    textAlign: "center",
                  }}>
                    {flow}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="fg-section" style={{ paddingTop: 0 }}>
        <div className="fg-container">
          <div className="fg-section-head">
            <div className="fg-section-label">⭐ ביקורות</div>
            <h2 className="fg-section-title">מה המשתמשים אומרים</h2>
          </div>
          <div className="fg-testimonials-grid">
            {testimonials.map((t) => (
              <div key={t.name} className="fg-testimonial-card">
                <div className="fg-testimonial-stars">★★★★★</div>
                <p className="fg-testimonial-text">"{t.text}"</p>
                <div className="fg-testimonial-author">
                  <div className="fg-testimonial-avatar">{t.initial}</div>
                  <div>
                    <div className="fg-testimonial-name">{t.name}</div>
                    <div className="fg-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="fg-faq" className="fg-section" style={{ paddingTop: 0 }}>
        <div className="fg-container">
          <div className="fg-section-head">
            <h2 className="fg-section-title">שאלות נפוצות</h2>
          </div>
          <div className="fg-faq-list">
            {faqs.map((faq, i) => (
              <div key={i} className={`fg-faq-item${openFaq === i ? " open" : ""}`}>
                <button
                  className="fg-faq-btn"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  type="button"
                >
                  {faq.q}
                  <span className="fg-faq-chevron">
                    <ChevronDown size={14} />
                  </span>
                </button>
                <div className="fg-faq-answer">{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="fg-section" style={{ paddingTop: 0, paddingBottom: "var(--fg-section-gap)" }}>
        <div className="fg-container">
          <div className="fg-cta-final">
            <div className="fg-cta-final-inner">
              <h2 className="fg-cta-title">
                מוכן להבין את<br />
                המצב הפיננסי שלך?
              </h2>
              <p className="fg-cta-sub">
                הרשמה חינמית. ניתוח ראשוני ב-3 דקות.
              </p>
              <button className="fg-btn-white" onClick={handleStart} type="button">
                התחל עכשיו — בחינם
                <ArrowLeft size={18} />
              </button>
              <p className="fg-cta-note">ללא כרטיס אשראי · ביטול בכל עת</p>
            </div>
          </div>
        </div>
      </section>

      <AppFooter variant="guest" />
    </div>
  );
}
