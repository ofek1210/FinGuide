import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { markWelcomeShown } from "../api/auth.api";
import { APP_ROUTES } from "../types/navigation";
import Loader from "../components/ui/Loader";
import { clearWelcomeBackPending } from "../utils/welcomeBackSession";
import "../components/welcome/welcome.css";

type AnimalFact = {
  name: string;
  emoji: string;
  fact: string;
  image?: string;
};

const FALLBACK_FACTS: AnimalFact[] = [
  {
    name: "תמנון",
    emoji: "🐙",
    fact: "לתמנונים יש שלושה לבבות ודם כחול — מותאמים לעומקי האוקיינוס.",
  },
  {
    name: "דולפין",
    emoji: "🐬",
    fact: "דולפינים משתמשים בשריקות ייחודיות, כמעט כמו שמות, כדי לזהות אחד את השני.",
  },
  {
    name: "לוטרה",
    emoji: "🦦",
    fact: "לוטרות ים אוחזות ידיים בזמן שינה כדי שהזרם לא ירחיק אותן זו מזו.",
  },
  {
    name: "פיל",
    emoji: "🐘",
    fact: "פילים מזהים את עצמם במראה — סימן לתודעה עצמית.",
  },
  {
    name: "דבורת דבש",
    emoji: "🐝",
    fact: "דבורת דבש מבצעת ריקוד בצורת שמונה כדי לספר לכוורת בדיוק איפה למצוא פרחים.",
  },
  {
    name: "פינגווין",
    emoji: "🐧",
    fact: "פינגוויני קיסר מתקהלים ומחליפים מקום כדי שכל אחד יקבל תור במרכז החם.",
  },
  {
    name: "אקסולוטל",
    emoji: "🦎",
    fact: "אקסולוטלים יכולים לגדל מחדש גפיים שלמות, חלקים מהלב ואפילו קטעים מהמוח.",
  },
  {
    name: "לווייתן",
    emoji: "🐋",
    fact: "לב של לווייתן כחול בגודל של מכונית קטנה — ואפשר לשמוע אותו משני קילומטרים.",
  },
  {
    name: "יונק",
    emoji: "🐦",
    fact: "יונקים הם הציפורים היחידות שיכולות לעוף אחורה באמת.",
  },
  {
    name: "פנגולין",
    emoji: "🦔",
    fact: "פנגולינים מכוסים בקשקשים מקרטין — אותו חומר שמציפורני הידיים.",
  },
];

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

function pickRandomFallback(): AnimalFact {
  return FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
}

function extractFirstName(fullName: string | undefined | null): string {
  if (!fullName) return "חבר/ה";
  const trimmed = fullName.trim();
  if (!trimmed) return "חבר/ה";
  const [first] = trimmed.split(/\s+/);
  return first || "חבר/ה";
}

const ANIMAL_OPTIONS: Array<{ slug: string; name: string; emoji: string }> = [
  { slug: "dog", name: "כלב", emoji: "🐶" },
  { slug: "cat", name: "חתול", emoji: "🐱" },
  { slug: "panda", name: "פanda", emoji: "🐼" },
  { slug: "fox", name: "שועל", emoji: "🦊" },
  { slug: "bird", name: "ציפור", emoji: "🐦" },
  { slug: "koala", name: "קואלה", emoji: "🐨" },
  { slug: "red_panda", name: "פanda אדום", emoji: "🦊" },
  { slug: "raccoon", name: "דביבון", emoji: "🦝" },
  { slug: "kangaroo", name: "קenguru", emoji: "🦘" },
];

async function fetchAnimalFact(signal: AbortSignal): Promise<AnimalFact> {
  const pick = ANIMAL_OPTIONS[Math.floor(Math.random() * ANIMAL_OPTIONS.length)];

  try {
    const response = await fetch(`https://some-random-api.com/animal/${pick.slug}`, {
      signal,
    });
    if (response.ok) {
      const payload = (await response.json()) as {
        fact?: string;
        image?: string;
      };
      if (payload && typeof payload.fact === "string" && payload.fact.trim()) {
        return {
          name: pick.name,
          emoji: pick.emoji,
          fact: payload.fact.trim(),
          image: typeof payload.image === "string" ? payload.image : undefined,
        };
      }
    }
  } catch {
    // fall through to next provider
  }

  try {
    const catResponse = await fetch("https://catfact.ninja/fact", { signal });
    if (catResponse.ok) {
      const payload = (await catResponse.json()) as { fact?: string };
      if (payload && typeof payload.fact === "string" && payload.fact.trim()) {
        return {
          name: "חתול",
          emoji: "🐱",
          fact: payload.fact.trim(),
        };
      }
    }
  } catch {
    // fall through to local fallback
  }

  return pickRandomFallback();
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const firstName = useMemo(() => extractFirstName(auth.user?.name), [auth.user?.name]);

  const [animalFact, setAnimalFact] = useState<AnimalFact | null>(null);
  const [isFactLoading, setIsFactLoading] = useState(true);
  const [isContinuing, setIsContinuing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchAnimalFact(controller.signal)
      .then((fact) => {
        if (!controller.signal.aborted) {
          setAnimalFact(fact);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAnimalFact(pickRandomFallback());
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsFactLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const handleContinue = useCallback(async () => {
    if (isContinuing) return;
    setIsContinuing(true);
    try {
      const res = await markWelcomeShown();
      clearWelcomeBackPending();
      await auth.refresh();
      const onboardingIncomplete =
        res.success && res.data?.user?.onboardingCompleted === false;
      navigate(onboardingIncomplete ? APP_ROUTES.onboarding : APP_ROUTES.hub, {
        replace: true,
      });
    } catch {
      clearWelcomeBackPending();
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

        <section className="welcome-founder" aria-labelledby="welcome-founder-title">
          <header className="welcome-founder-header">
            <span className="welcome-founder-eyebrow">
              <span aria-hidden="true">💬</span> מכתב אישי מהמייסד
            </span>
            <h2 id="welcome-founder-title" className="welcome-founder-title">
              מהמשרד של המייסד — אליך.
            </h2>
          </header>

          <div className="welcome-founder-grid">
            <figure className="welcome-founder-portrait">
              <div className="welcome-founder-portrait-frame">
                <img
                  src="/team/CEO.png"
                  alt="Segev Partush — מייסד ומנכ״ל FinGuide"
                  loading="eager"
                  decoding="async"
                  width={1313}
                  height={1198}
                />
              </div>
              <figcaption className="welcome-founder-portrait-caption">
                <span className="welcome-founder-portrait-name">Segev Partush</span>
                <span className="welcome-founder-portrait-role">מייסד ומנכ״ל · FinGuide</span>
              </figcaption>
            </figure>

            <article className="welcome-founder-content">
              <p className="welcome-founder-greeting">
                שלום <strong>{firstName}</strong>,
              </p>
              <p className="welcome-founder-lead">
                אני <strong>Segev Partush</strong>, מייסד ומנכ״ל FinGuide.
              </p>
              <p>
                הרעיון ל-FinGuide נולד בזמן שירותי הצבאי, כשהבנתי כמה קשה להבין
                פנסיה, חיסכון, השקעות ותכנון פיננסי — הכל במקום אחד פשוט.
              </p>
              <p>כמו הרבה אנשים, מצאתי את עצמי שואל שאלות שאמורות היו לקבל תשובות פשוטות:</p>
              <ul className="welcome-founder-questions" role="list">
                <li>איפה הכסף שלי?</li>
                <li>האם אני חוסך/ת מספיק?</li>
                <li>מה כדאי לעשות הלאה?</li>
              </ul>
              <p>FinGuide נוצר בדיוק כדי לפתור את הבעיה הזו.</p>
              <p className="welcome-founder-mission">
                המשימה שלנו פשוטה:{" "}
                <strong>לעזור לאנשים לקבל החלטות פיננסיות חכמות יותר — בביטחון.</strong>
              </p>
              <p>
                אנחנו מתרגשים שאת/ה איתנו, ולא יכולים לחכות לעזור לך לקחת שליטה
                על העתיד הפיננסי שלך.
              </p>
              <p className="welcome-founder-closing">ברוכים הבאים למשפחה.</p>

              <footer className="welcome-founder-signature">
                <span className="welcome-founder-signature-name">Segev Partush</span>
                <span className="welcome-founder-signature-role">מייסד ומנכ״ל</span>
              </footer>
            </article>
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

        <section className="welcome-animal" aria-labelledby="welcome-animal-title">
          <div className="welcome-animal-card">
            <header className="welcome-animal-header">
              <span className="welcome-animal-eyebrow">
                <span aria-hidden="true">🪄</span> לפני שמתחילים...
              </span>
              <h2 id="welcome-animal-title" className="welcome-animal-title">
                משהו קטן לשמח את היום.
              </h2>
            </header>

            <div className="welcome-animal-body">
              {isFactLoading ? (
                <div className="welcome-animal-loading">
                  <Loader />
                  <span>מביאים עובדה מעניינת בשבילך…</span>
                </div>
              ) : animalFact ? (
                <div className="welcome-animal-content">
                  {animalFact.image ? (
                    <div className="welcome-animal-image">
                      <img
                        src={animalFact.image}
                        alt={animalFact.name}
                        loading="lazy"
                        decoding="async"
                        onError={(event) => {
                          (event.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  ) : null}
                  <div className="welcome-animal-text">
                    <p className="welcome-animal-question">
                      <span aria-hidden="true">{animalFact.emoji}</span> ידעת/י?
                    </p>
                    <h3 className="welcome-animal-name">{animalFact.name}</h3>
                    <p className="welcome-animal-fact">{animalFact.fact}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
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
