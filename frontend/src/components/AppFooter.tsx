import { Link } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

type FooterVariant = "guest" | "private";

const COPYRIGHT = "© 2025 FinGuide. העוזר הפיננסי המבוסס על בינה מלאכותית.";

interface AppFooterProps {
  variant: FooterVariant;
}

export default function AppFooter({ variant }: AppFooterProps) {
  if (variant === "guest") {
    return (
      <footer className="app-footer app-footer-guest" dir="rtl">
        <nav className="app-footer-nav" aria-label="קישורי ניווט">
          <Link to={APP_ROUTES.home}>דף הבית</Link>
          <Link to={APP_ROUTES.login}>התחברות</Link>
          <Link to={APP_ROUTES.register}>התחל עכשיו</Link>
        </nav>
        <p className="app-footer-copyright">{COPYRIGHT}</p>
      </footer>
    );
  }

  return (
    <footer className="app-footer app-footer-private" dir="rtl">
      <nav className="app-footer-nav" aria-label="קישורי ניווט">
        <Link to={APP_ROUTES.dashboard}>לוח בקרה</Link>
        <Link to={APP_ROUTES.documents}>מסמכים</Link>
        <Link to={APP_ROUTES.payslipHistory}>היסטוריית תלושים</Link>
        <Link to={APP_ROUTES.findings}>ממצאים</Link>
        <Link to={APP_ROUTES.assistant}>עוזר AI</Link>
        <Link to={APP_ROUTES.settings}>הגדרות</Link>
        <Link to={APP_ROUTES.help}>עזרה</Link>
        <Link to={APP_ROUTES.status}>מצב מערכת</Link>
      </nav>
      <p className="app-footer-copyright">{COPYRIGHT}</p>
    </footer>
  );
}
