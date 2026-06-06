import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Linkedin } from "lucide-react";
import { APP_ROUTES } from "../types/navigation";
import AppFooter from "../components/AppFooter";

type Tone = "yellow" | "pink" | "mint" | "purple";

interface TeamMember {
  name: string;
  role: string;
  description: string;
  image: string;
  tone: Tone;
  linkedin?: string;
}

const TEAM: TeamMember[] = [
  {
    name: "Segev Partush",
    role: "Co-Founder & CEO",
    description: "Leading company strategy, business growth, and execution.",
    image: "/team/SegevPartush.jpg",
    tone: "yellow",
  },
  {
    name: "Ofek Dil",
    role: "Co-Founder & CTO",
    description: "Driving the technical vision and platform architecture.",
    image: "/team/OfekDil.png",
    tone: "pink",
  },
  {
    name: "Emily Belensky",
    role: "Co-Founder & Head of Reliability Engineering",
    description: "Building scalable, resilient, and highly available systems.",
    image: "/team/EmilyBelensky.jpeg",
    tone: "mint",
  },
  {
    name: "Shahar Mayster",
    role: "Co-Founder & Chief Marketing Officer (CMO)",
    description:
      "Leading marketing strategy, brand growth, customer acquisition, and community engagement.",
    image: "/team/ShaharMayster.jpeg",
    tone: "purple",
  },
  {
    name: "Ofir Raz",
    role: "Co-Founder & Chief Product Officer",
    description:
      "Defining product strategy and turning customer needs into impactful solutions.",
    image: "/team/OfirRaz.jpeg",
    tone: "yellow",
  },
];

export default function TeamPage() {
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem("token"));

  return (
    <div className="team-page landing-page" dir="ltr">
      <header className="landing-nav landing-container" dir="rtl">
        <button
          type="button"
          className="landing-logo team-logo-btn"
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

      <main className="team-main">
        <section className="team-hero">
          <div className="team-hero-inner landing-container">
            <span className="team-hero-eyebrow">Meet The Team</span>
            <h1 className="team-hero-title">
              The people behind <strong>FinGuide</strong>
            </h1>
            <p className="team-hero-subtitle">
              Building reliable, scalable, and user-focused
              <br />
              financial technology.
            </p>
          </div>
        </section>

        <section className="team-founder landing-container" dir="rtl" aria-labelledby="founder-letter-title">
          <header className="team-founder-header">
            <span className="team-founder-eyebrow">
              <span aria-hidden="true">💬</span> דבר המנכ"ל
            </span>
            <h2 id="founder-letter-title" className="team-founder-subtitle">
              הסיפור שמאחורי <strong>FinGuide</strong>
            </h2>
          </header>

          <div className="team-founder-grid">
            <figure className="team-founder-portrait">
              <div className="team-founder-portrait-frame">
                <img
                  src="/team/CEO.png"
                  alt="Segev Partush — Founder & CEO of FinGuide"
                  width={1313}
                  height={1198}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <figcaption className="team-founder-portrait-caption">
                <span className="team-founder-portrait-name">Segev Partush</span>
                <span className="team-founder-portrait-role">Founder &amp; CEO</span>
              </figcaption>
            </figure>

            <article className="team-founder-content">
              <p className="team-founder-lead">
                כמו הרבה רעיונות טובים, גם <strong>FinGuide</strong> לא התחיל במשרד
                או בחדר ישיבות. הוא התחיל בתקופה שבה שירתתי כקצין בצה"ל.
              </p>

              <p>
                באותן שנים התחלתי להיחשף לעולם הפיננסי האישי — פנסיה, קרנות, הפקדות,
                ביטוחים ותלושי שכר — וגיליתי שאני לא באמת מבין מה קורה עם הכסף שלי.
                ככל שניסיתי ללמוד יותר, כך הבנתי כמה התחום הזה מורכב עבור רוב האנשים.
              </p>

              <ul className="team-founder-issues" role="list">
                <li>יותר מדי מידע.</li>
                <li>יותר מדי מושגים.</li>
                <li>יותר מדי החלטות.</li>
                <li>ומעט מאוד כלים שבאמת עוזרים להבין מה נכון לעשות.</li>
              </ul>

              <p>באותו רגע עלתה לי שאלה פשוטה:</p>

              <blockquote className="team-founder-quote">
                <span className="team-founder-quote-mark" aria-hidden="true">"</span>
                <p>למה קבלת החלטות פיננסיות צריכה להיות כל כך מסובכת?</p>
              </blockquote>

              <p className="team-founder-pivot">
                <strong>השאלה הזאת הפכה לרעיון.</strong>
              </p>

              <p>
                בהמשך, במהלך לימודי מדעי המחשב, פגשתי אנשים מוכשרים שחלקו את אותה
                הסקרנות, אותה תשוקה לטכנולוגיה ואותו הרצון לבנות משהו בעל משמעות.
                מהר מאוד הפכנו מקבוצת סטודנטים לצוות עם חזון משותף — כל אחד הביא
                איתו עולם אחר של ידע, יצירתיות וחשיבה, ויחד התחלנו לבנות את מה
                שהפך להיות FinGuide.
              </p>

              <aside className="team-founder-manifesto" aria-label="Founding principle">
                <p>
                  בין אם בשטח ובין אם בעולם הטכנולוגיה,
                  <strong> העיקרון נשאר זהה</strong>:
                </p>
                <ul role="list">
                  <li>להסתגל במהירות</li>
                  <li>לקבל החלטות באחריות</li>
                  <li>לבצע ללא פשרות</li>
                </ul>
              </aside>

              <h3 className="team-founder-mini-heading">
                <span className="team-founder-mini-emoji" aria-hidden="true">🎯</span>
                מה אנחנו בונים
              </h3>
              <p>
                היום אנחנו לא רק מפתחים מוצר. אנחנו בונים פלטפורמה חכמה שעוזרת
                לאנשים להבין את האפשרויות שלהם, לקבל החלטות טובות יותר ולחסוך
                זמן, כסף וכאב ראש.
              </p>
              <ul className="team-founder-stickers" role="list">
                <li className="team-sticker tone-yellow">בלי מונחים מסובכים</li>
                <li className="team-sticker tone-pink">בלי שעות של מחקר</li>
                <li className="team-sticker tone-mint">בלי ניחושים</li>
              </ul>

              <h3 className="team-founder-mini-heading">
                <span className="team-founder-mini-emoji" aria-hidden="true">💡</span>
                במה אנחנו מאמינים
              </h3>
              <div className="team-founder-beliefs">
                <div className="team-belief tone-yellow">
                  <span className="team-belief-num">01</span>
                  <h4>פשטות מעל הכל</h4>
                  <p>טכנולוגיה טובה צריכה להרגיש פשוטה.</p>
                </div>
                <div className="team-belief tone-pink">
                  <span className="team-belief-num">02</span>
                  <h4>אנשים לפני פיצ'רים</h4>
                  <p>כל החלטה מתחילה בצורך אמיתי של משתמש.</p>
                </div>
                <div className="team-belief tone-mint">
                  <span className="team-belief-num">03</span>
                  <h4>ללמוד כל הזמן</h4>
                  <p>אנחנו בונים, טועים, משפרים וחוזרים שוב.</p>
                </div>
                <div className="team-belief tone-purple">
                  <span className="team-belief-num">04</span>
                  <h4>לעשות אימפקט</h4>
                  <p>לא רק לבנות מוצר. לבנות משהו שבאמת עוזר.</p>
                </div>
              </div>

              <h3 className="team-founder-mini-heading">
                <span className="team-founder-mini-emoji" aria-hidden="true">🔥</span>
                וזה רק ההתחלה
              </h3>
              <p>
                FinGuide עדיין בתחילת הדרך — אבל החזון שלנו גדול: להפוך את קבלת
                ההחלטות הפיננסיות לחכמה, נגישה ופשוטה יותר עבור כולם.
              </p>
              <p className="team-founder-closing">
                אנחנו מאמינים שטכנולוגיה צריכה לעבוד בשביל אנשים — לא להפך.
                והמסע הכי גדול מתחיל מרעיון אחד טוב, ומצוות שמוכן לעבוד קשה
                כדי להפוך אותו למציאות.
              </p>

              <footer className="team-founder-signature">
                <div className="team-founder-signature-id">
                  <span className="team-founder-signature-name">Segev Partush</span>
                  <span className="team-founder-signature-role">
                    Founder &amp; CEO · FinGuide
                  </span>
                </div>
                <p className="team-founder-signature-tagline">
                  <span aria-hidden="true">🚀</span> Building the future of smarter financial decisions
                </p>
              </footer>
            </article>
          </div>

        </section>

        <section className="team-chapter landing-container" dir="rtl" aria-labelledby="team-chapter-title">
          <span className="team-chapter-eyebrow">Meet The Team</span>
          <h2 id="team-chapter-title" className="team-chapter-title">
            <span>5 מייסדים.</span>
            <strong>חזון אחד.</strong>
          </h2>
          <p className="team-chapter-sub">
            האנשים שמאחורי הקלעים — והכוח שמניע את FinGuide קדימה.
          </p>
          <span className="team-chapter-rule" aria-hidden="true" />
        </section>

        <section className="team-banner landing-container" aria-label="Team photo">
          <div className="team-banner-frame">
            <img
              src="/team/EveryBody.png"
              alt="כל חברי הצוות של FinGuide ביחד במשרד"
              width={1919}
              height={820}
              loading="lazy"
              decoding="async"
            />
            <span className="team-banner-tag team-banner-tag-tl">FOUNDERS</span>
            <span className="team-banner-tag team-banner-tag-br">EST. 2026</span>
          </div>
        </section>

        <section className="team-grid-section landing-container" dir="rtl">
          <ul className="team-grid" role="list">
            {TEAM.map((member) => (
              <li
                key={member.name}
                className={`team-card tone-${member.tone}`}
              >
                <figure className="team-card-portrait">
                  <img
                    src={member.image}
                    alt={`${member.name} — ${member.role}`}
                    loading="lazy"
                    decoding="async"
                  />
                </figure>
                <div className="team-card-body">
                  <p className="team-card-role">{member.role}</p>
                  <h2 className="team-card-name">{member.name}</h2>
                  <p className="team-card-description">{member.description}</p>
                  {member.linkedin ? (
                    <a
                      className="team-card-linkedin"
                      href={member.linkedin}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`LinkedIn — ${member.name}`}
                    >
                      <Linkedin aria-hidden="true" />
                      <span>LinkedIn</span>
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="team-cta landing-container" dir="rtl">
          <div className="team-cta-card">
            <h2>בונים ביחד את עתיד הניהול הפיננסי האישי</h2>
            <p>
              נשמח להכיר אנשים שמתלהבים מנתונים, מ-AI, ומלהפוך מסמכים פיננסיים
              לבהירות אמיתית. אם זה אתם — נשמח לדבר.
            </p>
            <button
              className="landing-primary team-cta-btn"
              type="button"
              onClick={() =>
                navigate(hasToken ? APP_ROUTES.dashboard : APP_ROUTES.register)
              }
            >
              להצטרפות ל-FinGuide
              <ArrowUpRight aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>

      <AppFooter variant="guest" />
    </div>
  );
}
