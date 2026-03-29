import { useState } from "react";
import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";

/**
 * צילום מסך להצגה בכרטיס (קובץ תחת `public/landing/screenshots/`).
 */
export const LANDING_DASHBOARD_PREVIEW_IMAGE =
  "/landing/screenshots/image.png";

export type LandingConsultingGrowthSectionProps = {
  /** נתיב לתמונה תחת `public`. אם לא מועבר — מנסים את הקבוע למעלה. */
  previewSrc?: string;
  /** דורס את כל אזור התצוגה */
  previewSlot?: ReactNode;
};

/**
 * סקשן בסגנון Frame 2 (Figma): כותרת + כרטיס כהה.
 * ברירת מחדל: מקום לצילום מסך מהאפליקציה — לא גרף חי.
 */
export default function LandingConsultingGrowthSection({
  previewSrc,
  previewSlot,
}: LandingConsultingGrowthSectionProps) {
  const imageSrc = previewSrc ?? LANDING_DASHBOARD_PREVIEW_IMAGE;

  return (
    <section
      className="landing-consulting"
      dir="rtl"
      aria-labelledby="landing-consulting-title"
    >
      <div className="landing-consulting-inner landing-container">
        <header className="section-header">
          <h2 id="landing-consulting-title">ממסמכים לבהירות — במקום אחד</h2>
          <p>
            תלושי שכר, פנסיה ומסמכי מס — הכול נקרא ומסוכם בשפה פשוטה, בלי
            ללכת לאיבוד בין שורות וקודי שכר.
          </p>
        </header>

        <div className="landing-growth-card-wrap">
          <div className="landing-growth-card-glow" aria-hidden="true" />
          <div className="landing-growth-card">
            <div className="landing-growth-card-header">
              <div className="landing-growth-card-heading">
                <p className="landing-growth-kicker">מתוך המערכת</p>
                <p className="landing-growth-subtitle">
                  לוח בקרה שמרכז{" "}
                  <span className="landing-growth-em">תלושים, תובנות והתראות</span>
                </p>
                <p className="landing-growth-stat">מהעלאה לתובנות שאפשר לפעול לפיהן</p>
                <p className="landing-growth-meta">
                  צילום מסך מלוח הבקרה — כך נראה הממשק אחרי שמעלים מסמכים.
                </p>
              </div>
            </div>

            <div className="landing-growth-preview-shell">
              {previewSlot ?? (
                <LandingDashboardPreview imageSrc={imageSrc} />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingDashboardPreview({ imageSrc }: { imageSrc: string }) {
  const [showPlaceholder, setShowPlaceholder] = useState(false);

  if (showPlaceholder) {
    return (
      <div className="landing-growth-preview-placeholder">
        <div className="landing-growth-preview-placeholder-inner">
          <span className="landing-growth-preview-icon" aria-hidden="true">
            <ImageIcon strokeWidth={1.5} />
          </span>
          <p className="landing-growth-preview-title">מקום לצילום מסך מהאתר</p>
          <p className="landing-growth-preview-text">
            צלמו את המסך בלוח הבקרה (או במסך שמייצג הכי טוב את FinGuide), שמרו
            כ־PNG או WebP, והוסיפו לפרויקט תחת:
          </p>
          <code className="landing-growth-preview-code-block">
            public
            {imageSrc}
          </code>
          <p className="landing-growth-preview-hint">
            אפשר לשנות נתיב ב־
            <code className="landing-growth-preview-code">previewSrc</code> או
            בקבוע <code className="landing-growth-preview-code">LANDING_DASHBOARD_PREVIEW_IMAGE</code>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-growth-preview-frame">
      <img
        src={imageSrc}
        alt="צילום מסך מלוח הבקרה ב־FinGuide"
        className="landing-growth-preview-img"
        loading="lazy"
        decoding="async"
        onError={() => setShowPlaceholder(true)}
      />
    </div>
  );
}
