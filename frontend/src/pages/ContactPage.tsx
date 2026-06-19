import { useNavigate } from "react-router-dom";
import { Phone, Mail, Linkedin, ArrowUpRight } from "lucide-react";
import { APP_ROUTES } from "../types/navigation";
import AppFooter from "../components/AppFooter";

type Tone = "yellow" | "pink" | "mint";

interface ContactChannel {
  tone: Tone;
  label: string;
  value: string;
  display: string;
  href: string;
  icon: React.ReactNode;
  cta: string;
  external?: boolean;
}

/**
 * Monochrome brand glyphs that inherit the surrounding text color via `currentColor`.
 * Keeps the icons recognisable while staying on the Rapyd palette of the parent card.
 */
const CONTACTS: ContactChannel[] = [
  {
    tone: "yellow",
    label: "מייל ראשי",
    value: "Email",
    display: "FinGuide@Gmail.com",
    href: "mailto:FinGuide@Gmail.com",
    icon: <Mail aria-hidden="true" />,
    cta: "שלחו לנו מייל",
  },
  {
    tone: "pink",
    label: "טלפון",
    value: "Phone",
    display: "+972 50-123-4567",
    href: "tel:+972501234567",
    icon: <Phone aria-hidden="true" />,
    cta: "התקשרו עכשיו",
  },
  {
    tone: "mint",
    label: "לינקדאין",
    value: "LinkedIn",
    display: "FinGuide",
    href: "https://www.linkedin.com/company/FinGuide",
    icon: <Linkedin aria-hidden="true" />,
    cta: "עקבו אחרינו",
    external: true,
  },
];

export default function ContactPage() {
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem("token"));

  return (
    <div className="contact-page landing-page" dir="rtl">
      <header className="landing-nav landing-container">
        <button
          type="button"
          className="landing-logo contact-logo-btn"
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
              onClick={() => navigate(APP_ROUTES.documents)}
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

      <main className="contact-main">
        <section className="contact-hero">
          <div className="contact-hero-inner landing-container">
            <span className="contact-hero-eyebrow">Contact</span>
            <h1 className="contact-hero-title">
              בואו נדבר
            </h1>
            <p className="contact-hero-subtitle">
              שאלות, רעיונות, שיתופי פעולה — אנחנו תמיד כאן.
              <br />
              בחרו את הדרך הנוחה לכם.
            </p>
          </div>
        </section>

        <section className="contact-grid-section landing-container">
          <ul className="contact-grid" role="list">
            {CONTACTS.map((channel) => (
              <li key={channel.value} className={`contact-card tone-${channel.tone}`}>
                <span className="contact-card-icon" aria-hidden="true">
                  {channel.icon}
                </span>
                <p className="contact-card-label">{channel.label}</p>
                <p className="contact-card-value">{channel.display}</p>
                <a
                  className="contact-card-cta"
                  href={channel.href}
                  {...(channel.external
                    ? { target: "_blank", rel: "noreferrer noopener" }
                    : {})}
                >
                  <span>{channel.cta}</span>
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="contact-cta landing-container">
          <div className="contact-cta-card">
            <h2>מוכנים להתחיל?</h2>
            <p>
              יש לכם שאלה על FinGuide? צריכים עזרה? אנחנו כאן בשבילכם.
              שלחו לנו מייל ונחזור אליכם בהקדם — או הצטרפו עכשיו והתחילו לקבל
              תובנות פיננסיות חכמות.
            </p>
            <div className="contact-cta-actions">
              <a
                className="landing-primary contact-cta-btn"
                href="mailto:FinGuide@Gmail.com"
              >
                שלח מייל
                <ArrowUpRight aria-hidden="true" />
              </a>
              <button
                type="button"
                className="contact-cta-secondary"
                onClick={() =>
                  navigate(hasToken ? APP_ROUTES.dashboard : APP_ROUTES.register)
                }
              >
                הצטרף עכשיו
                <ArrowUpRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <AppFooter variant="guest" />
    </div>
  );
}
