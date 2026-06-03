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
    title: "קבלת התנאים",
    paragraphs: ["השימוש באתר מהווה הסכמה לתנאי שימוש אלו."],
    tone: "yellow",
  },
  {
    title: "שימוש מותר",
    paragraphs: ["המשתמש מתחייב להשתמש באתר בצורה חוקית והוגנת."],
    tone: "pink",
  },
  {
    title: "אחריות",
    paragraphs: [
      "FinGuide מספקת מידע וכלים למטרות מידע בלבד.",
      "המידע באתר אינו מהווה:",
    ],
    bullets: ["ייעוץ פיננסי", "ייעוץ השקעות", "ייעוץ משפטי", "המלצה לפעולה כלשהי"],
    tone: "mint",
  },
  {
    title: "קניין רוחני",
    paragraphs: [
      "כל הזכויות באתר, בעיצוב, בתוכן ובקוד שייכות ל-FinGuide.",
    ],
    tone: "purple",
  },
  {
    title: "הגבלת אחריות",
    paragraphs: [
      "FinGuide לא תישא באחריות לנזקים הנובעים מהסתמכות על מידע המופיע באתר.",
    ],
    tone: "yellow",
  },
  {
    title: "שינויים בשירות",
    paragraphs: [
      "אנו רשאים לעדכן את השירות או תנאי השימוש מעת לעת.",
    ],
    tone: "pink",
  },
  {
    title: "יצירת קשר",
    paragraphs: ["לשאלות ניתן לפנות אלינו דרך האתר."],
    tone: "mint",
  },
];

export default function TermsPage() {
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
            <span className="legal-hero-eyebrow">Terms</span>
            <h1 className="legal-hero-title">תנאי שימוש</h1>
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
