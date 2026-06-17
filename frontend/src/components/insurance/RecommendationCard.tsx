import { Bot, CheckCircle2, XCircle } from "lucide-react";
import type { RecommendationItem } from "../../api/recommendations.api";
import ImportanceBadge from "./ImportanceBadge";
import PriceRangeBar from "./PriceRangeBar";

const KIND_PROS: Record<string, string[]> = {
  life: ["מגן על המשפחה במקרה חרום", "סכום הכיסוי ניתן להתאמה", "פרמיות נמוכות בגיל צעיר"],
  health: ["גישה לטיפולים פרטיים מהירים", "כיסוי תרופות יקרות", "ניתוחים בבתי חולים מובחרים"],
  disability: ["מבטיח הכנסה רציפה גם בחוסר כושר", "מכסה עד 75% מהשכר", "חיוני לעובד ראשי"],
  apartment: ["הגנה מפני אש, מים וגניבה", "נדרש לרוב על ידי הבנק למשכנתא", "עלות נמוכה יחסית"],
  car: ["חובה חוקית (חובה)", "מקיף מכסה נזק לרכב שלך", "כיסוי גנבה ותאונות"],
  pension_increase: ["חיסכון פטור ממס", "מעסיק מוסיף על כל שקל שלך", "ריבית דריבית לאורך שנים"],
};

const KIND_CONS: Record<string, string[]> = {
  life: ["עלות עולה עם הגיל", "לא תמיד נחוץ ללא תלויים"],
  health: ["עלות חודשית קבועה", "כיסוי מוגבל למצבים קודמים"],
  disability: ["הגדרת 'חוסר כושר' משתנה בין חברות", "תקופת המתנה לפני פיצוי"],
  apartment: ["לא כולל נזקי רעידת אדמה בסיסי", "יש לבדוק היטב את החרגות"],
  car: ["מקיף יקר לרכב ישן — אולי לא כדאי", "השתתפות עצמית"],
  pension_increase: ["כסף נעול עד גיל 67", "תשואה תלויה בשוק ההון"],
};

type Props = {
  recommendation: RecommendationItem;
  onDismiss: (id: string) => void;
  onPurchased: (id: string) => void;
};

export default function RecommendationCard({ recommendation, onDismiss, onPurchased }: Props) {
  const pros = KIND_PROS[recommendation.kind] ?? [];
  const cons = KIND_CONS[recommendation.kind] ?? [];

  return (
    <article className="recommendation-card ai-rec-card">
      <header className="ai-rec-card-header">
        <div className="ai-rec-card-title-row">
          <ImportanceBadge importance={recommendation.importance} />
          <h3>{recommendation.title}</h3>
        </div>
        <span className="ai-rec-badge"><Bot size={11} /> ממצא AI</span>
      </header>

      <div className="ai-rec-reasoning">
        <p className="ai-rec-reasoning-label">מדוע AI מזהה צורך זה:</p>
        <ul>
          {recommendation.reasoning.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      {(pros.length > 0 || cons.length > 0) && (
        <div className="ai-rec-pros-cons">
          {pros.length > 0 && (
            <div className="ai-rec-pros">
              <span className="ai-rec-pros-label"><CheckCircle2 size={12} /> יתרונות</span>
              <ul>{pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
          {cons.length > 0 && (
            <div className="ai-rec-cons">
              <span className="ai-rec-cons-label"><XCircle size={12} /> חסרונות</span>
              <ul>{cons.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {recommendation.priceRange.average > 0 ? (
        <PriceRangeBar range={recommendation.priceRange} />
      ) : (
        <p className="dashboard-muted">הערכת עלות: לפי שכר ומעסיק</p>
      )}

      <div className="recommendation-actions">
        <button type="button" className="ai-rec-primary-btn" onClick={() => onPurchased(recommendation._id)}>
          ✓ יש לי כבר
        </button>
        <button type="button" className="ai-rec-dismiss-btn" onClick={() => onDismiss(recommendation._id)}>
          לא רלוונטי
        </button>
      </div>
    </article>
  );
}

