import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { APP_ROUTES } from "../types/navigation";
import AppFooter from "../components/AppFooter";

interface QA {
  q: string;
  a: string;
  tone: "yellow" | "pink" | "mint" | "purple";
}

const FAQ: QA[] = [
  {
    q: "מה זה FinGuide?",
    a: "FinGuide היא פלטפורמה חכמה המסייעת למשתמשים לקבל החלטות פיננסיות בצורה פשוטה וברורה.",
    tone: "yellow",
  },
  {
    q: "האם השירות חינמי?",
    a: "כן. ניתן להשתמש בפלטפורמה ללא עלות.",
    tone: "pink",
  },
  {
    q: "האם FinGuide מספק ייעוץ פיננסי?",
    a: "לא. המידע המוצג נועד למטרות מידע בלבד ואינו מהווה ייעוץ פיננסי, השקעות או המלצה מכל סוג.",
    tone: "mint",
  },
  {
    q: "האם המידע שלי נשמר?",
    a: "אנו שומרים רק מידע הנדרש לצורך תפעול ושיפור השירות בהתאם למדיניות הפרטיות שלנו.",
    tone: "purple",
  },
  {
    q: "האם ניתן למחוק את המידע שלי?",
    a: "כן. ניתן לפנות אלינו ולבקש מחיקת מידע אישי בהתאם לחוקי הגנת הפרטיות.",
    tone: "yellow",
  },
  {
    q: 'איך אפשר ליצור קשר?',
    a: 'דרך עמוד יצירת הקשר או באמצעות כתובת הדוא"ל המופיעה באתר.',
    tone: "pink",
  },
];

export default function FAQPage() {
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
            <span className="legal-hero-eyebrow">FAQ</span>
            <h1 className="legal-hero-title">שאלות נפוצות</h1>
            <p className="legal-hero-subtitle">
              יש לכם שאלה? כנראה שכבר ענינו עליה.
            </p>
          </div>
        </section>

        <section className="faq-section landing-container">
          <ul className="faq-list" role="list">
            {FAQ.map((item, idx) => (
              <li key={item.q} className={`faq-item tone-${item.tone}`}>
                <details className="faq-details">
                  <summary className="faq-summary">
                    <span className="faq-index">{String(idx + 1).padStart(2, "0")}</span>
                    <span className="faq-question">{item.q}</span>
                    <ChevronDown className="faq-chevron" aria-hidden="true" />
                  </summary>
                  <div className="faq-answer">
                    <p>{item.a}</p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <section className="legal-cta landing-container">
          <div className="legal-cta-card">
            <h2>כבר מוכנים להתחיל?</h2>
            <p>
              צרו את החשבון שלכם בחינם ותתחילו לקבל תובנות פיננסיות חכמות —
              ללא התחייבות, ללא כרטיס אשראי.
            </p>
            <button
              type="button"
              className="landing-primary legal-cta-btn"
              onClick={() =>
                navigate(hasToken ? APP_ROUTES.dashboard : APP_ROUTES.register)
              }
            >
              התחל עכשיו
              <ArrowUpRight aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>

      <AppFooter variant="guest" />
    </div>
  );
}
