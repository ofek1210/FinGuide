import { useNavigate } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import { APP_ROUTES } from "../types/navigation";

const faqs = [
  {
    question: "איך מעלים מסמך חדש?",
    answer: "נכנסים למסך מסמכים, בוחרים קובץ PDF ולוחצים על העלאה.",
  },
  {
    question: "איזה קבצים נתמכים כרגע?",
    answer: "בשלב זה נתמכים קבצי PDF בלבד.",
  },
  {
    question: "למה אני לא רואה ממצאים?",
    answer: "אם אין מסמכים בחשבון, יוצג מצב ריק. אחרי העלאה, יופיעו ממצאים.",
  },
  {
    question: "איך מתנתקים?",
    answer: "מכל מסך מחובר דרך כפתור התנתקות בחלק העליון.",
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
      </div>
    </div>
  );
}
