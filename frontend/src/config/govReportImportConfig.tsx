import type { ReactNode } from "react";

export type ImportFlowDomain = "pension" | "insurance";

export type ImportGuideStepConfig = {
  num: string;
  icon: string;
  title: string;
  desc: string;
  hasAction?: boolean;
};

export type GovReportImportConfig = {
  domain: ImportFlowDomain;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  siteUrl: string;
  landing: {
    heroEmoji: string;
    title: string;
    subtitle: ReactNode;
    ctaLabel: string;
    ctaSub: string;
    benefits: Array<{ icon: string; title: string; desc: string }>;
    infoCards?: Array<{
      emoji: string;
      title: string;
      desc: ReactNode;
    }>;
    trustNote: { title: string; desc: string };
  };
  guide: {
    stepBadge: string;
    title: string;
    subtitle: ReactNode;
    steps: ImportGuideStepConfig[];
    tip: { emoji: string; content: ReactNode };
    continueVisited: string;
    continueDefault: string;
    openSiteVisited: string;
    openSiteDefault: string;
  };
  upload: {
    stepBadge: string;
    title: string;
    subtitle: string;
    accept: string;
    fileHint: string;
    idleEmoji: string;
    idleTitle: string;
    idleSub: string;
    pickFileLabel: string;
    progressFallback: string;
    progressDotSize: number;
    afterUploadTitle: string;
    afterUploadItems: string[];
  };
};

export const PENSION_IMPORT_CONFIG: GovReportImportConfig = {
  domain: "pension",
  accentColor: "#6B4FA0",
  gradientFrom: "#6B4FA0",
  gradientTo: "#5A3E8F",
  siteUrl: "https://harkesher.mof.gov.il/ReportAnonymous/gamal",
  landing: {
    heroEmoji: "📈",
    title: "הסוכן האישי שלי לפנסיה וחיסכון",
    subtitle: (
      <>
        ניתוח מלא של קרנות הפנסיה, קופות הגמל וקרנות ההשתלמות שלך —
        ישירות מ<strong>הר הכסף</strong>, מאגר הנתונים הפנסיוניים הרשמי של מדינת ישראל.
      </>
    ),
    ctaLabel: "ייבוא מהר הכסף",
    ctaSub: "חינמי · מאובטח · ~2 דקות",
    benefits: [
      { icon: "📅", title: "תחזית פרישה", desc: "כמה תצבור עד הפרישה וכמה תקבל לחודש" },
      { icon: "💸", title: "דמי ניהול", desc: "האם אתה משלם יותר מדי? חיסכון פוטנציאלי עד פרישה" },
      { icon: "🔄", title: "ריכוז קרנות", desc: "כמה קרנות יש לך — האם כדאי לאחד אותן?" },
      { icon: "📊", title: "סימולציית תרחישים", desc: "מה יקרה אם תגדיל הפקדות או תפרוש מוקדם" },
    ],
    infoCards: [
      {
        emoji: "🏛️",
        title: "מה זה הר הכסף?",
        desc: (
          <>
            הר הכסף הוא שירות ממשלתי רשמי של משרד האוצר שמרכז את כל החסכונות הפנסיוניים שלך — פנסיה, גמל, השתלמות וביטוח מנהלים — ממקום אחד.{" "}
            <a href="https://harkesher.mof.gov.il/ReportAnonymous/gamal" target="_blank" rel="noopener noreferrer" style={{ color: "#6B4FA0", fontWeight: 700 }}>
              לאתר הרשמי ←
            </a>
          </>
        ),
      },
    ],
    trustNote: {
      title: "המידע שלך מאובטח",
      desc: "אנחנו לא ניגשים ישירות לחשבון שלך. אתה מוריד את הדוח בעצמך מהאתר הרשמי ומעלה אותו לניתוח.",
    },
  },
  guide: {
    stepBadge: "שלב 1 מתוך 2 — הכנת הדוח",
    title: "כיצד להוריד את דוח הפנסיה שלך?",
    subtitle: (
      <>
        הר הכסף מרכז <strong>את כל החסכונות הפנסיוניים שלך</strong> — פנסיה, גמל, השתלמות, ביטוח מנהלים.
        <br />
        פשוט עקוב אחרי ארבעת השלבים:
      </>
    ),
    steps: [
      { num: "1", icon: "🌐", title: "כנסו ישירות לאתר הר הכסף", desc: "לחצו על הכפתור — ייפתח אתר הר הכסף של משרד האוצר בלשונית חדשה.", hasAction: true },
      { num: "2", icon: "🔑", title: "התחברות עם תעודת זהות", desc: "היכנסו למערכת עם תעודת הזהות + תאריך לידה. ניתן להתחבר גם דרך MyGov." },
      { num: "3", icon: "📊", title: "הורידו את הדוח המלא", desc: 'בחרו "הדפסה / שמירה" ושמרו את הדוח ב-PDF. כל קרנות הפנסיה, הגמל וההשתלמות שלכם יופיעו שם.' },
      { num: "4", icon: "⬆️", title: "חזרו לכאן והעלו את הדוח", desc: "לאחר שהורדתם — לחצו על המשך ועלו את הקובץ. הסוכן ינתח את כל הקרנות." },
    ],
    tip: {
      emoji: "💡",
      content: (
        <>
          <strong>הר הכסף מציג את הנתונים בצורת טבלה.</strong> לחצו על &quot;הדפסה&quot; בדפדפן (Ctrl+P) ושמרו כ-PDF, או חפשו כפתור &quot;ייצוא&quot; בדף.
        </>
      ),
    },
    continueVisited: "הורדתי את הדוח — המשך להעלאה",
    continueDefault: "כבר יש לי דוח — המשך",
    openSiteVisited: "ביקרת באתר",
    openSiteDefault: "פתח את הר הכסף",
  },
  upload: {
    stepBadge: "שלב 2 מתוך 2 — העלאת הדוח",
    title: "העלה את דוח הפנסיה שלך",
    subtitle: "גרור את הדוח שהורדת מהר הכסף לכאן, או לחץ לבחירה. הסוכן ינתח את כל הקרנות אוטומטית.",
    accept: ".pdf,.xlsx,.xls",
    fileHint: "PDF · xlsx · xls · עד 10MB",
    idleEmoji: "📄",
    idleTitle: "גרור את דוח הר הכסף לכאן",
    idleSub: "PDF, xlsx, xls — מהר הכסף",
    pickFileLabel: "בחר קובץ",
    progressFallback: "הסוכן מנתח את הקרנות...",
    progressDotSize: 10,
    afterUploadTitle: "✦ מה הסוכן יזהה בדוח?",
    afterUploadItems: [
      "כל קרנות הפנסיה, גמל, השתלמות וביטוח מנהלים",
      "שיעורי דמי ניהול ממכל קרן",
      "גובה הצבירה הנוכחית בכל קרן",
      "חישוב תחזית פרישה ריאלית",
      "המלצות אישיות לחיסכון ואיחוד קרנות",
    ],
  },
};

export const INSURANCE_IMPORT_CONFIG: GovReportImportConfig = {
  domain: "insurance",
  accentColor: "#7B5EA7",
  gradientFrom: "#7B5EA7",
  gradientTo: "#6B4FA0",
  siteUrl: "https://www.gov.il/he/service/har-habituach",
  landing: {
    heroEmoji: "🛡️",
    title: "הסוכן האישי שלי לביטוח ופוליסות",
    subtitle: (
      <>
        ניתוח כל הפוליסות שלך, זיהוי כפילויות, פערים בכיסוי, ואיפה אפשר לחסוך —
        הכל ממקור אחד מהימן: <strong>הר הביטוח</strong>.
      </>
    ),
    ctaLabel: "ייבוא מהר הביטוח",
    ctaSub: "חינמי · מאובטח · לוקח ~2 דקות",
    benefits: [
      { icon: "♻️", title: "כפילויות", desc: "זיהוי פוליסות חופפות שגורמות לתשלום כפול" },
      { icon: "⚠️", title: "פערים בכיסוי", desc: "ביטוחים חיוניים שיש לך ולא אתה מכוסה בהם" },
      { icon: "💰", title: "חיסכון פוטנציאלי", desc: "כמה ניתן לחסוך בפרמיות ללא פגיעה בכיסוי" },
      { icon: "📊", title: "השוואה לשוק", desc: "האם אתה משלם יותר מהממוצע בשוק" },
    ],
    trustNote: {
      title: "המידע שלך מאובטח לחלוטין",
      desc: "הנתונים מגיעים ישירות מאתר המדינה הרשמי. אנחנו לא שומרים פרטי פוליסה רגישים — רק מה שנדרש לניתוח.",
    },
  },
  guide: {
    stepBadge: "שלב 1 מתוך 2 — הכנת הדוח",
    title: "כיצד להוריד את דוח הביטוח שלך?",
    subtitle: (
      <>
        <strong>הר הביטוח</strong> הוא שירות ממשלתי רשמי שמרכז את כל הפוליסות הביטוחיות שלך ממקור אחד.
        <br />
        פשוט עקוב אחרי ארבעת השלבים הבאים:
      </>
    ),
    steps: [
      { num: "1", icon: "🌐", title: "כנסו לאתר הר הביטוח הרשמי", desc: "לחצו על הכפתור למטה — ייפתח אתר המדינה הרשמי בלשונית חדשה.", hasAction: true },
      { num: "2", icon: "🔑", title: "התחברות עם תעודת זהות", desc: "היכנסו למערכת הר הביטוח עם תעודת הזהות שלכם. ניתן להתחבר גם דרך MyGov." },
      { num: "3", icon: "📊", title: "הורידו את הדוח בפורמט Excel", desc: 'בחרו "הורדת דוח ביטוחים" ושמרו את הקובץ (xlsx) במחשב שלכם.' },
      { num: "4", icon: "⬆️", title: "חזרו לכאן והעלו את הקובץ", desc: "לאחר שהורדתם — לחצו על המשך ועלו את קובץ ה-Excel. הסוכן ינתח הכל." },
    ],
    tip: {
      emoji: "💡",
      content: (
        <>
          <strong>לא מוצאים את אפשרות הורדת ה-Excel?</strong> חפשו &quot;יצוא נתונים&quot; או &quot;הורד דוח&quot; בתפריט. בחלק מהדפדפנים ייתכן שתצטרכו לאפשר קובץ הורדה.
        </>
      ),
    },
    continueVisited: "הורדתי את הקובץ — המשך להעלאה",
    continueDefault: "כבר יש לי את הקובץ — המשך",
    openSiteVisited: "ביקרת באתר",
    openSiteDefault: "פתח את הר הביטוח",
  },
  upload: {
    stepBadge: "שלב 2 מתוך 2 — העלאת הדוח",
    title: "העלה את קובץ הביטוח שלך",
    subtitle: "גרור את קובץ ה-Excel מהר הביטוח לכאן, או לחץ לבחירה. הסוכן ינתח אוטומטית.",
    accept: ".xlsx,.xls",
    fileHint: "פורמטים נתמכים: .xlsx .xls · עד 5MB",
    idleEmoji: "📊",
    idleTitle: "גרור את קובץ ה-Excel לכאן",
    idleSub: "או לחץ לבחירה מהמחשב",
    pickFileLabel: "בחר קובץ xlsx",
    progressFallback: "הסוכן מנתח את הפוליסות...",
    progressDotSize: 8,
    afterUploadTitle: "✦ מה קורה לאחר ההעלאה?",
    afterUploadItems: [
      "הסוכן סורק ומזהה את כל הפוליסות בקובץ",
      "מחשב את הפרמיה הכוללת החודשית שלך",
      "מאתר כפילויות ופוליסות חופפות",
      "מזהה פערים בכיסוי לפי הפרופיל שלך",
      "מייצר המלצות מותאמות אישית לחיסכון",
    ],
  },
};

export function getGovReportImportConfig(domain: ImportFlowDomain): GovReportImportConfig {
  return domain === "pension" ? PENSION_IMPORT_CONFIG : INSURANCE_IMPORT_CONFIG;
}
