import {
  ArrowUpRight,
  BarChart3,
  FileText,
  Mail,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";
import AppFooter from "./AppFooter";
import HeroMediaAnimation from "./HeroMediaAnimation";
import LandingPlatformShowcase from "./LandingPlatformShowcase";

const features = [
  {
    title: "תובנות ברורות",
    description:
      "קבלו תובנות אישיות, פירוטים והמלצות לשיפור המצב הפיננסי שלכם.",
    icon: <BarChart3 aria-hidden="true" />,
    tone: "violet",
  },
  {
    title: "ניתוח AI",
    description:
      "הבינה המלאכותית שלנו לומדת את המסמכים שלכם ומתרגמת נתונים לשפה פשוטה.",
    icon: <Wand2 aria-hidden="true" />,
    tone: "cyan",
  },
  {
    title: "העלאת מסמכים",
    description:
      "גררו והעלו את תלושי השכר, דוחות פנסיה ושאר המסמכים בקלות ובמהירות.",
    icon: <FileText aria-hidden="true" />,
    tone: "blue",
  },
] as const;

const securityPoints = [
  "הצפנה מקצה לקצה",
  "תאימות GDPR",
  "שליטה מלאה על המידע שלכם",
] as const;

export default function LandingPage() {
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem("token"));

  return (
    <div className="landing-page" dir="rtl">
      <header className="landing-nav landing-container">
        <div className="landing-logo">
          <span className="landing-logo-badge" aria-hidden="true">
            <Sparkles />
          </span>
          <span>FinGuide</span>
        </div>
        <div className="landing-nav-actions">
          <button className="landing-link" type="button" onClick={() => navigate(APP_ROUTES.login)}>
            התחברות
          </button>
          <button className="landing-primary landing-nav-primary" type="button" onClick={() => navigate(APP_ROUTES.register)}>
            התחל עכשיו
          </button>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero landing-container">
          <div className="hero-media" aria-hidden="true">
            <div className="hero-media-inner">
              <HeroMediaAnimation />
            </div>
          </div>
          <div className="hero-content">
            <div className="hero-pill">
              <Sparkles aria-hidden="true" />
              ניתוח פיננסי מבוסס בינה מלאכותית
            </div>
            <h1 className="hero-title">
              הבינו את המצב הפיננסי שלכם
              <br />
              <span>בעזרת AI</span>
            </h1>
            <p className="hero-subtitle">
              העלו את תלושי השכר, דוחות הפנסיה ומסמכי המס שלכם. הבינה
              המלאכותית שלנו מפרקת מושגים פיננסיים מורכבים להסברים פשוטים
              וברורים שתוכלו להבין.
            </p>
            <div className="hero-actions">
              <button
                className="landing-primary hero-primary-btn"
                type="button"
                onClick={() =>
                  navigate(hasToken ? APP_ROUTES.documents : APP_ROUTES.register)
                }
              >
                העלאת תלוש שכר
                <ArrowUpRight aria-hidden="true" />
              </button>
              <button
                className="landing-secondary hero-secondary-btn"
                type="button"
                onClick={() => navigate(APP_ROUTES.integrationsEmail)}
              >
                <Mail aria-hidden="true" />
                חיבור תיבת מייל
              </button>
            </div>
            <div className="hero-badges">
              <span className="hero-badge">
                <span className="badge-dot" />
                אבטחה ברמת בנק
              </span>
              <span className="hero-badge">
                <span className="badge-dot is-accent" />
                תובנות מבוססות AI
              </span>
            </div>
          </div>
        </section>

        <section className="landing-features landing-container">
          <header className="section-header">
            <h2>איך FinGuide עוזר לכם</h2>
            <p>כלים פשוטים ועוצמתיים להבנת המסמכים הפיננסיים שלכם</p>
          </header>
          <div className="features-grid">
            {features.map((feature) => (
              <article
                key={feature.title}
                className={`feature-card tone-${feature.tone}`}
              >
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <LandingPlatformShowcase />

        <section className="landing-security landing-container">
          <div className="security-card">
            <span className="security-icon" aria-hidden="true">
              <ShieldCheck />
            </span>
            <h2>הפרטיות הפיננסית שלכם חשובה לנו</h2>
            <p>
              אנו משתמשים בהצפנה ברמת בנק כדי להגן על המסמכים שלכם. המידע
              שלכם לעולם לא משותף עם צדדים שלישיים ותוכלו למחוק אותו בכל עת.
            </p>
            <div className="security-points">
              {securityPoints.map((point) => (
                <span key={point} className="security-point">
                  {point}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-cta landing-container">
          <h2>מוכנים להבין את המצב הפיננסי שלכם?</h2>
          <p>הצטרפו לאלפים שכבר השיגו בהירות במצבם הפיננסי.</p>
          <button
            className="landing-primary landing-cta-btn"
            type="button"
            onClick={() => navigate(APP_ROUTES.register)}
          >
            התחילו בחינם
          </button>
        </section>
      </main>

      <AppFooter variant="guest" />
    </div>
  );
}
