import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { markWelcomeShown } from "../api/auth.api";
import { APP_ROUTES } from "../types/navigation";
import Loader from "../components/ui/Loader";
import { clearWelcomeBackPending } from "../utils/welcomeBackSession";

type AnimalFact = {
  name: string;
  emoji: string;
  fact: string;
  image?: string;
};

const FALLBACK_FACTS: AnimalFact[] = [
  {
    name: "Octopus",
    emoji: "🐙",
    fact: "Octopuses have three hearts and blue blood — built for the deep ocean.",
  },
  {
    name: "Dolphin",
    emoji: "🐬",
    fact: "Dolphins use unique whistles, almost like names, to identify each other.",
  },
  {
    name: "Otter",
    emoji: "🦦",
    fact: "Sea otters hold hands while they sleep so the current doesn't drift them apart.",
  },
  {
    name: "Elephant",
    emoji: "🐘",
    fact: "Elephants can recognize themselves in a mirror — a sign of self-awareness.",
  },
  {
    name: "Honeybee",
    emoji: "🐝",
    fact: "A honeybee dances in figure-eights to tell the hive exactly where to find flowers.",
  },
  {
    name: "Penguin",
    emoji: "🐧",
    fact: "Emperor penguins huddle and rotate positions so every bird gets a turn in the warm center.",
  },
  {
    name: "Axolotl",
    emoji: "🦎",
    fact: "Axolotls can regrow entire limbs, parts of the heart, and even sections of the brain.",
  },
  {
    name: "Whale",
    emoji: "🐋",
    fact: "A blue whale's heart is the size of a small car — and you could hear it from two miles away.",
  },
  {
    name: "Hummingbird",
    emoji: "🐦",
    fact: "Hummingbirds are the only birds that can truly fly backwards.",
  },
  {
    name: "Pangolin",
    emoji: "🦔",
    fact: "Pangolins are covered in scales made of keratin — the same material as your fingernails.",
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
    title: "Track Your Financial Growth",
    description: "Monitor savings, investments, pensions, and financial goals — in one clear view.",
    tone: "yellow",
  },
  {
    emoji: "🎯",
    title: "Set Financial Goals",
    description: "Plan future milestones and watch the progress bar move in your favor every month.",
    tone: "pink",
  },
  {
    emoji: "💡",
    title: "Get Smart Insights",
    description: "Receive personalized recommendations tailored to your payslips, history, and goals.",
    tone: "mint",
  },
  {
    emoji: "🔒",
    title: "Keep Everything Organized",
    description: "All your financial information lives in one secure, encrypted place. No more digging.",
    tone: "purple",
  },
];

function pickRandomFallback(): AnimalFact {
  return FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
}

function extractFirstName(fullName: string | undefined | null): string {
  if (!fullName) return "Friend";
  const trimmed = fullName.trim();
  if (!trimmed) return "Friend";
  const [first] = trimmed.split(/\s+/);
  return first || "Friend";
}

const ANIMAL_OPTIONS: Array<{ slug: string; name: string; emoji: string }> = [
  { slug: "dog", name: "Dog", emoji: "🐶" },
  { slug: "cat", name: "Cat", emoji: "🐱" },
  { slug: "panda", name: "Panda", emoji: "🐼" },
  { slug: "fox", name: "Fox", emoji: "🦊" },
  { slug: "bird", name: "Bird", emoji: "🐦" },
  { slug: "koala", name: "Koala", emoji: "🐨" },
  { slug: "red_panda", name: "Red Panda", emoji: "🦊" },
  { slug: "raccoon", name: "Raccoon", emoji: "🦝" },
  { slug: "kangaroo", name: "Kangaroo", emoji: "🦘" },
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
          name: "Cat",
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
      await markWelcomeShown();
    } catch {
      // even if persistence fails we still let the user move on
    }
    // New-user welcome has its own greeting; suppress the returning-user
    // welcome-back screen for this session so the user doesn't see both.
    clearWelcomeBackPending();
    await auth.refresh();
    const next = auth.user?.onboardingCompleted === false ? APP_ROUTES.onboarding : APP_ROUTES.dashboard;
    navigate(next, { replace: true });
  }, [auth, isContinuing, navigate]);

  return (
    <div className="welcome-page" dir="ltr">
      <main className="welcome-main">
        <section className="welcome-hero">
          <div className="welcome-hero-inner">
            <span className="welcome-hero-eyebrow">
              <span aria-hidden="true">✨</span> A New Beginning
            </span>
            <h1 className="welcome-hero-title">
              Welcome To The <strong>FinGuide</strong> Family
            </h1>
            <p className="welcome-hero-greeting">
              Welcome, <strong>{firstName}</strong> <span aria-hidden="true">👋</span>
            </p>
            <p className="welcome-hero-sub">
              You just joined a community that's reshaping how people understand and grow their money.
            </p>
            <div className="welcome-hero-marquee" aria-hidden="true">
              <span>PAYSLIPS</span>
              <span className="welcome-marquee-dot">●</span>
              <span>PENSIONS</span>
              <span className="welcome-marquee-dot">●</span>
              <span>SAVINGS</span>
              <span className="welcome-marquee-dot">●</span>
              <span>CLARITY</span>
              <span className="welcome-marquee-dot">●</span>
              <span>CONFIDENCE</span>
            </div>
          </div>
        </section>

        <section className="welcome-founder" aria-labelledby="welcome-founder-title">
          <header className="welcome-founder-header">
            <span className="welcome-founder-eyebrow">
              <span aria-hidden="true">💬</span> A Personal Message From Our Founder
            </span>
            <h2 id="welcome-founder-title" className="welcome-founder-title">
              From the founder's desk to yours.
            </h2>
          </header>

          <div className="welcome-founder-grid">
            <figure className="welcome-founder-portrait">
              <div className="welcome-founder-portrait-frame">
                <img
                  src="/team/CEO.png"
                  alt="Segev Partush — Founder & CEO of FinGuide"
                  loading="eager"
                  decoding="async"
                  width={1313}
                  height={1198}
                />
              </div>
              <figcaption className="welcome-founder-portrait-caption">
                <span className="welcome-founder-portrait-name">Segev Partush</span>
                <span className="welcome-founder-portrait-role">Founder &amp; CEO · FinGuide</span>
              </figcaption>
            </figure>

            <article className="welcome-founder-content">
              <p className="welcome-founder-greeting">Hi <strong>{firstName}</strong>,</p>
              <p className="welcome-founder-lead">
                I'm <strong>Segev Partush</strong>, Founder &amp; CEO of FinGuide.
              </p>
              <p>
                The idea for FinGuide was born during my military service, when I realized how difficult
                it was to understand pensions, savings, investments, and financial planning — all in one
                simple place.
              </p>
              <p>
                Like many people, I found myself asking questions that should have had simple answers:
              </p>
              <ul className="welcome-founder-questions" role="list">
                <li>Where is my money?</li>
                <li>Am I saving enough?</li>
                <li>What should I do next?</li>
              </ul>
              <p>FinGuide was created to solve exactly that problem.</p>
              <p className="welcome-founder-mission">
                Our mission is simple: <strong>help people make smarter financial decisions with confidence.</strong>
              </p>
              <p>
                We're excited to have you with us and can't wait to help you take control of your
                financial future.
              </p>
              <p className="welcome-founder-closing">Welcome to the family.</p>

              <footer className="welcome-founder-signature">
                <span className="welcome-founder-signature-name">Segev Partush</span>
                <span className="welcome-founder-signature-role">Founder &amp; CEO</span>
              </footer>
            </article>
          </div>
        </section>

        <section className="welcome-features" aria-labelledby="welcome-features-title">
          <header className="welcome-features-header">
            <span className="welcome-features-eyebrow">
              <span aria-hidden="true">🚀</span> What You Can Do With FinGuide
            </span>
            <h2 id="welcome-features-title" className="welcome-features-title">
              Everything you need to take control — in one place.
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
                <span aria-hidden="true">🪄</span> Before You Get Started...
              </span>
              <h2 id="welcome-animal-title" className="welcome-animal-title">
                A little something to brighten your day.
              </h2>
            </header>

            <div className="welcome-animal-body">
              {isFactLoading ? (
                <div className="welcome-animal-loading">
                  <Loader />
                  <span>Fetching a fun fact just for you…</span>
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
                      <span aria-hidden="true">{animalFact.emoji}</span> Did you know?
                    </p>
                    <h3 className="welcome-animal-name">{animalFact.name}</h3>
                    <p className="welcome-animal-fact">{animalFact.fact}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="welcome-cta" aria-label="Continue to FinGuide">
          <div className="welcome-cta-card">
            <h2 className="welcome-cta-title">Ready when you are, {firstName}.</h2>
            <p className="welcome-cta-sub">
              Your dashboard is set up. Let's start turning numbers into clarity.
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
                  <span>Continue To FinGuide</span>
                </>
              )}
            </button>
            <p className="welcome-cta-fineprint">
              You'll only see this screen once. Welcome aboard.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
