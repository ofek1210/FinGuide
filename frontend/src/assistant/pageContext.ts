import { APP_ROUTES } from "../types/navigation";

// Human-readable Hebrew description of the screen the user is currently on.
// Fed to the AI as a hint ("the user is currently viewing X") so the floating
// chat is aware of context as it travels the site. Kept short and neutral —
// it is NOT used for deterministic intent detection on the backend.
const STATIC_PAGE_LABELS: Record<string, string> = {
  [APP_ROUTES.dashboard]: "לוח הבקרה הראשי",
  [APP_ROUTES.documents]: "עמוד המסמכים (העלאת וצפייה בתלושים)",
  [APP_ROUTES.documentsScan]: "מסך סטטוס סריקת מסמך",
  [APP_ROUTES.documentsScanComplete]: "מסך סיום סריקת מסמך",
  [APP_ROUTES.payslipHistory]: "היסטוריית תלושי השכר",
  [APP_ROUTES.findings]: "עמוד הממצאים (חריגות ופערים בתלושים)",
  [APP_ROUTES.taxAssistant]: "עוזר המס",
  [APP_ROUTES.financialHealth]: "מסך הבריאות הפיננסית",
  [APP_ROUTES.copilot]: "הקופיילוט הפיננסי",
  [APP_ROUTES.insights]: "עמוד התובנות",
  [APP_ROUTES.insurance]: "עמוד הביטוחים",
  [APP_ROUTES.notifications]: "מרכז ההתראות",
  [APP_ROUTES.settings]: "עמוד ההגדרות",
  [APP_ROUTES.integrationsEmail]: "עמוד חיבור תיבת המייל",
  [APP_ROUTES.help]: "עמוד העזרה",
  [APP_ROUTES.onboarding]: "תהליך ההיכרות (אונבורדינג)",
};

export function describePageContext(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (STATIC_PAGE_LABELS[path]) return STATIC_PAGE_LABELS[path];

  if (/^\/documents\/history\/[^/]+\/missing$/.test(path)) {
    return "השלמת שדות חסרים בתלוש שכר";
  }
  if (/^\/documents\/history\/[^/]+$/.test(path)) {
    return "פרטי תלוש שכר ספציפי";
  }
  if (/^\/documents\/[^/]+$/.test(path)) {
    return "פרטי מסמך ספציפי";
  }

  return null;
}
