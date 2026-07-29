import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { markWelcomeShown } from "../api/auth.api";
import { APP_ROUTES } from "../types/navigation";
import Loader from "../components/ui/Loader";
import "../components/welcome/welcome.css";

const FEATURES: Array<{
  emoji: string;
  title: string;
  description: string;
  tone: "yellow" | "pink" | "mint" | "purple";
}> = [
  {
    emoji: "📊",
    title: "מעקב אחר הצמיחה הפיננסית",
    description: "עקבו אחר חיסכון, השקעות, פנסיה ויעדים — במבט אחד ברור.",
    tone: "yellow",
  },
  {
    emoji: "🎯",
    title: "הגדרת יעדים פיננסיים",
    description: "תכננו אבני דרך עתידיות וראו את ההתקדמות מתקדמת לטובתכם.",
    tone: "pink",
  },
  {
    emoji: "💡",
    title: "תובנות חכמות",
    description: "קבלו המלצות מותאמות אישית לפי תלושים, היסטוריה ויעדים.",
    tone: "mint",
  },
  {
    emoji: "🔒",
    title: "הכל מסודר במקום אחד",
    description: "כל המידע הפיננסי שלכם במקום מאובטח ומוצפן. בלי לחפש.",
    tone: "purple",
  },
];

function extractFirstName(fullName: string | undefined | null): string {
  if (!fullName) return "חבר/ה";
  const trimmed = fullName.trim();
  if (!trimmed) return "חבר/ה";
  const [first] = trimmed.split(/\s+/);
  return first || "חבר/ה";
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const firstName = useMemo(() => extractFirstName(auth.user?.name), [auth.user?.name]);

  const [isContinuing, setIsContinuing] = useState(false);

  const handleContinue = useCallback(async () => {
    if (isContinuing) return;
    setIsContinuing(true);
    try {
      const res = await markWelcomeShown();
      await auth.refresh();
      const onboardingIncomplete =
        res.success && res.data?.user?.onboardingCompleted === false;
      navigate(onboardingIncomplete ? APP_ROUTES.onboarding : APP_ROUTES.hub, {
        replace: true,
      });
    } catch {
      navigate(APP_ROUTES.hub, { replace: true });
    }
  }, [auth, isContinuing, navigate]);

  return (
    <div className="welcome-page" dir="rtl">
      <main className="welcome-main">
        <section className="welcome-hero">
          <div className="welcome-hero-inner">
            <span className="welcome-hero-eyebrow">
              <span aria-hidden="true">✨</span> התחלה חדשה
            </span>
            <h1 className="welcome-hero-title">
              ברוכים הבאים למשפחת <strong>FinGuide</strong>
            </h1>
            <p className="welcome-hero-greeting">
              ברוך/ה הבא/ה, <strong>{firstName}</strong>{" "}
              <span aria-hidden="true">👋</span>
            </p>
            <p className="welcome-hero-sub">
              הצטרפת לקהילה שמשנה את הדרך שבה אנשים מבינים ומגדילים את הכסף שלהם.
            </p>
            <div className="welcome-hero-marquee" aria-hidden="true">
              <span>תלושים</span>
              <span className="welcome-marquee-dot">●</span>
              <span>פנסיה</span>
              <span className="welcome-marquee-dot">●</span>
              <span>חיסכון</span>
              <span className="welcome-marquee-dot">●</span>
              <span>בהירות</span>
              <span className="welcome-marquee-dot">●</span>
              <span>ביטחון</span>
            </div>
          </div>
        </section>

        <section className="welcome-features" aria-labelledby="welcome-features-title">
          <header className="welcome-features-header">
            <span className="welcome-features-eyebrow">
              <span aria-hidden="true">🚀</span> מה אפשר לעשות עם FinGuide
            </span>
            <h2 id="welcome-features-title" className="welcome-features-title">
              כל מה שצריך כדי לקחת שליטה — במקום אחד.
            </h2>
          </header>

          <ul className="welcome-features-grid" role="list">
            {FEATURES.map((feature) => (
              <li key={feature.title} className={`welcome-feature tone-${feature.tone}`}>
                <span className="welcome-feature-emoji" aria-hidden="true">
                  {feature.emoji}
                </span>
                <h3 className="welcome-feature-title">{feature.title}</h3>
                <p className="welcome-feature-description">{feature.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="welcome-cta" aria-label="המשך ל-FinGuide">
          <div className="welcome-cta-card">
            <h2 className="welcome-cta-title">מוכנים כשאת/ה מוכנ/ה, {firstName}.</h2>
            <p className="welcome-cta-sub">
              לוח הבקרה שלך מוכן. בואו נתחיל להפוך מספרים לבהירות.
            </p>
            <button
              type="button"
              className="welcome-cta-button"
              onClick={handleContinue}
              disabled={isContinuing}
            >
              {isContinuing ? (
                <Loader />
              ) : (
                <>
                  <span aria-hidden="true">🚀</span>
                  <span>המשך ל-FinGuide</span>
                </>
              )}
            </button>
            <p className="welcome-cta-fineprint">תראו את המסך הזה רק פעם אחת. ברוכים הבאים.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
