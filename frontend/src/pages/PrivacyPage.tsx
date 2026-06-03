import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";
import AppFooter from "../components/AppFooter";

type Tone = "yellow" | "pink" | "mint" | "purple";

interface Section {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  tone: Tone;
}

const SECTIONS: Section[] = [
  {
    title: "מבוא",
    paragraphs: [
      "ב-FinGuide אנו מכבדים את פרטיות המשתמשים שלנו ופועלים לשמור על המידע האישי שלהם בצורה מאובטחת ואחראית.",
    ],
    tone: "yellow",
  },
  {
    title: "איזה מידע אנו אוספים",
    bullets: [
      "מידע שהמשתמש מזין באופן יזום",
      "נתוני שימוש באתר",
      "מידע טכני בסיסי כגון סוג דפדפן ומכשיר",
    ],
    tone: "pink",
  },
  {
    title: "כיצד אנו משתמשים במידע",
    bullets: [
      "שיפור חוויית המשתמש",
      "שיפור ביצועי המערכת",
      "פיתוח פיצ'רים חדשים",
      "אבטחת השירות",
    ],
    tone: "mint",
  },
  {
    title: "שיתוף מידע",
    paragraphs: ["FinGuide אינה מוכרת מידע אישי לצדדים שלישיים."],
    tone: "purple",
  },
  {
    title: "אבטחת מידע",
    paragraphs: [
      "אנו מפעילים אמצעי אבטחה מקובלים בתעשייה לצורך הגנה על המידע.",
    ],
    tone: "yellow",
  },
  {
    title: "זכויות המשתמש",
    paragraphs: ["למשתמשים קיימת הזכות לבקש:"],
    bullets: ["גישה למידע", "תיקון מידע", "מחיקת מידע"],
    tone: "pink",
  },
  {
    title: "יצירת קשר",
    paragraphs: ["לשאלות בנושא פרטיות ניתן ליצור קשר דרך האתר."],
    tone: "mint",
  },
];

export default function PrivacyPage() {
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem("token"));

  return (
    <div className="legal-page landing-page" dir="rtl">
      <header className="landing-nav landing-container">
        <button
          type="button"
          className="landing-logo legal-logo-btn"
          onClick={() => navigate(APP_ROUTES.home)}
          aria-label="FinGuide — חזרה לדף הבית"
        >
          <span>FinGuide</span>
        </button>
        <div className="landing-nav-actions">
          {hasToken ? (
            <button
              className="landing-primary landing-nav-primary"
              type="button"
              onClick={() => navigate(APP_ROUTES.dashboard)}
            >
              ללוח הבקרה
            </button>
          ) : (
            <>
              <button
                className="landing-secondary"
                type="button"
                onClick={() => navigate(APP_ROUTES.login)}
              >
                התחברות
              </button>
              <button
                className="landing-primary landing-nav-primary"
                type="button"
                onClick={() => navigate(APP_ROUTES.register)}
              >
                התחל עכשיו
              </button>
            </>
          )}
        </div>
      </header>

      <main className="legal-main">
        <section className="legal-hero">
          <div className="legal-hero-inner landing-container">
            <span className="legal-hero-eyebrow">Privacy</span>
            <h1 className="legal-hero-title">מדיניות פרטיות</h1>
            <p className="legal-hero-meta">
              <span className="legal-hero-meta-label">עודכן לאחרונה:</span>{" "}
              ינואר 2026
            </p>
          </div>
        </section>

        <section className="legal-section landing-container">
          <ol className="legal-list" role="list">
            {SECTIONS.map((s, idx) => (
              <li key={s.title} className={`legal-block tone-${s.tone}`}>
                <span className="legal-block-num">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="legal-block-body">
                  <h2 className="legal-block-title">{s.title}</h2>
                  {s.paragraphs?.map((p, i) => (
                    <p key={i} className="legal-block-paragraph">
                      {p}
                    </p>
                  ))}
                  {s.bullets ? (
                    <ul className="legal-block-bullets">
                      {s.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <AppFooter variant="guest" />
    </div>
  );
}
