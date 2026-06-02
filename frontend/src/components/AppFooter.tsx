import { Link } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

type FooterVariant = "guest" | "private";

interface AppFooterProps {
  variant: FooterVariant;
}

export default function AppFooter({ variant }: AppFooterProps) {
  return (
    <footer className="app-footer" dir="rtl">
      <div className="app-footer-newsletter">
        <span className="app-footer-newsletter-label">הירשם לעדכונים פיננסיים</span>
        <a href="#" className="app-footer-newsletter-btn">הרשמה</a>
      </div>

      <div className="app-footer-columns">
        <div className="app-footer-col">
          <p className="app-footer-col-heading">המוצר</p>
          <ul>
            {variant === "private" && (
              <>
                <li><Link to={APP_ROUTES.dashboard}>לוח בקרה</Link></li>
                <li><Link to={APP_ROUTES.payslipHistory}>היסטוריית תלושים</Link></li>
                <li><Link to={APP_ROUTES.assistant}>עוזר AI</Link></li>
                <li><Link to={APP_ROUTES.findings}>ממצאים</Link></li>
              </>
            )}
            {variant === "guest" && (
              <>
                <li><Link to={APP_ROUTES.home}>דף הבית</Link></li>
                <li><Link to={APP_ROUTES.login}>התחברות</Link></li>
                <li><Link to={APP_ROUTES.register}>התחל עכשיו</Link></li>
              </>
            )}
          </ul>
        </div>

        <div className="app-footer-col">
          <p className="app-footer-col-heading">משאבים</p>
          <ul>
            <li><Link to={APP_ROUTES.help}>שאלות נפוצות</Link></li>
            <li><a href="#">מדיניות פרטיות</a></li>
            <li><a href="#">תנאי שימוש</a></li>
          </ul>
        </div>

        <div className="app-footer-col">
          <p className="app-footer-col-heading">החברה</p>
          <ul>
            <li><a href="#">אודות</a></li>
            <li><a href="#">צור קשר</a></li>
            {variant === "private" && (
              <li><Link to={APP_ROUTES.status}>מצב מערכת</Link></li>
            )}
          </ul>
        </div>
      </div>

      <div className="app-footer-bottom">
        <span>© 2026 FinGuide. כל הזכויות שמורות.</span>
        <div className="app-footer-bottom-links">
          <a href="#">פרטיות</a>
          <a href="#">תנאים</a>
        </div>
      </div>
    </footer>
  );
}
