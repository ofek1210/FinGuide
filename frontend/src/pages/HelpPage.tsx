import { useNavigate } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { APP_ROUTES } from "../types/navigation";

const faqs = [
  {
    question: "איך מעלים מסמך חדש?",
    answer: "נכנסים למסך מסמכים, בוחרים קובץ PDF (עד 10MB) ולוחצים על העלאה. המסמך יופיע ברשימה והסטטוס יתעדכן בהמשך.",
  },
  {
    question: "איזה קבצים נתמכים כרגע?",
    answer: "בשלב זה נתמכים קבצי PDF בלבד.",
  },
  {
    question: "איך מגיעים למסמכים שלי?",
    answer: "מהתפריט העליון בחרו \"מסמכים\" או מלוח הבקרה \"צפייה במסמכים\". שם תראו את כל הקבצים שהועלו.",
  },
  {
    question: "למה אני לא רואה ממצאים?",
    answer: "אם אין מסמכים בחשבון, יוצג מצב ריק. אחרי העלאה, יופיעו ממצאים והתובנות במסך \"ממצאים והתראות\".",
  },
  {
    question: "איך מתנתקים?",
    answer: "מכל מסך מחובר לחצו על התמונה/אותיות שלכם בפינה השמאלית ובחרו \"התנתקות\".",
  },
] as const;

export default function HelpPage() {
  const navigate = useNavigate();

  return (
    <div className="feature-page dashboard-page" dir="rtl">
      <div className="dashboard-shell">
        <PrivateTopbar />

        <section className="dashboard-card">
          <h1 className="feature-page-title">עזרה ושאלות נפוצות</h1>
          <p className="feature-page-subtitle">
            הסבר קצר על זרימת העבודה במסמכים ובכלי ה-AI.
          </p>
        </section>

        <section className="dashboard-card help-list">
          {faqs.map((item) => (
            <article key={item.question} className="help-item">
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </section>

        <section className="dashboard-card feature-page-actions">
          <button
            className="dashboard-hero-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.documents)}
          >
            מעבר למסמכים
          </button>
          <button
            className="dashboard-hero-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.settings)}
          >
            מעבר להגדרות
          </button>
          <button
            className="dashboard-hero-action"
            type="button"
            onClick={() => navigate(APP_ROUTES.status)}
          >
            מצב מערכת
          </button>
        </section>

        <AppFooter variant="private" />
      </div>
    </div>
  );
}
