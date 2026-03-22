import { useCallback, useState } from "react";
import { Check, Monitor, Smartphone, Tablet } from "lucide-react";
import PlatformBottomArt from "./PlatformBottomArt";

/** שמות קבצים — שימו PNG/WebP ב־public/landing/screenshots/ */
export const PLATFORM_SCREENSHOT_PATHS = {
  desktop: "/landing/screenshots/dashboard-desktop.png",
  tablet: "/landing/screenshots/dashboard-tablet.png",
  phone: "/landing/screenshots/dashboard-phone.png",
} as const;

const highlights = [
  "סיכום מצב, מגמות והתראות במקום אחד",
  "היסטוריית תלושים ומסמכים עם פירוט ברור",
  "עוזר AI שמבין את הנתונים שלכם מהמסמכים",
] as const;

const bottomBlocks = [
  {
    title: "אבטחה ושקט נפשי",
    text: "הצפנה, שליטה במידע ומחיקה בכל עת — בלי לוותר על נוחות.",
    artVariant: "left" as const,
  },
  {
    title: "פשטות מול מורכבות",
    text: "מושגים פיננסיים מורכבים מתורגמים לשפה שאפשר להבין וליישם.",
    artVariant: "center" as const,
  },
  {
    title: "הכל מתחיל מהמסמכים",
    text: "תלושים, דוחות ומסמכי מס — מעלים פעם אחת ומקבלים תמונה מלאה.",
    artVariant: "right" as const,
  },
] as const;

type LayerKey = keyof typeof PLATFORM_SCREENSHOT_PATHS;

function IsoScreen({
  layer,
  label,
  className,
  FallbackIcon,
}: {
  layer: LayerKey;
  label: string;
  className: string;
  FallbackIcon: typeof Monitor;
}) {
  const src = PLATFORM_SCREENSHOT_PATHS[layer];
  const [showFallback, setShowFallback] = useState(false);

  const onError = useCallback(() => {
    setShowFallback(true);
  }, []);

  return (
    <div className={`platform-iso-layer ${className}`}>
      <div className="platform-iso-frame">
        {!showFallback ? (
          <img
            src={src}
            alt={label}
            className="platform-iso-img"
            loading="lazy"
            decoding="async"
            onError={onError}
          />
        ) : (
          <div className="platform-iso-fallback" aria-hidden="true">
            <FallbackIcon strokeWidth={1.25} />
            <span>הוסיפו צילום מסך: {src.replace("/landing/screenshots/", "")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LandingPlatformShowcase() {
  return (
    <section className="landing-platform landing-container" aria-labelledby="platform-showcase-title">
      <div className="landing-platform-grid">
        <div className="landing-platform-copy">
          <p className="landing-platform-eyebrow">הפלטפורמה</p>
          <h2 id="platform-showcase-title" className="landing-platform-title">
            נבנתה כדי לתת לכם
            <br />
            <span className="landing-platform-title-accent">שקיפות פיננסית</span>
          </h2>
          <p className="landing-platform-lead">
            FinGuide מאחדת את תלושי השכר, המסמכים והתובנות שלכם בממשק אחד — נקי,
            מהיר ומותאם לעבודה יומיומית.
          </p>
          <h3 className="landing-platform-subhead">לוח בקרה שמרכז הכל</h3>
          <ul className="landing-platform-list">
            {highlights.map((item) => (
              <li key={item}>
                <span className="landing-platform-check" aria-hidden="true">
                  <Check strokeWidth={2.5} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="landing-platform-visual" aria-hidden="true">
          <div className="platform-iso">
            <div className="platform-iso-glow" />
            <div className="platform-iso-stack">
              <IsoScreen
                layer="desktop"
                label="לוח בקרה במחשב"
                className="platform-iso-layer--desktop"
                FallbackIcon={Monitor}
              />
              <IsoScreen
                layer="tablet"
                label="לוח בקרה בטאבלט"
                className="platform-iso-layer--tablet"
                FallbackIcon={Tablet}
              />
              <IsoScreen
                layer="phone"
                label="לוח בקרה בנייד"
                className="platform-iso-layer--phone"
                FallbackIcon={Smartphone}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="landing-platform-bottom">
        {bottomBlocks.map((b) => (
          <div key={b.title} className="landing-platform-bottom-card">
            <h3>{b.title}</h3>
            <p>{b.text}</p>
            <div className={`landing-platform-bottom-art landing-platform-bottom-art--${b.artVariant}`}>
              <PlatformBottomArt variant={b.artVariant} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
