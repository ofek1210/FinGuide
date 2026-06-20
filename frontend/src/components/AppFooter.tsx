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
                <li><Link to={APP_ROUTES.hub}>דף הבית</Link></li>
                <li><Link to={APP_ROUTES.documents}>תלושים ומסמכים</Link></li>
                <li><Link to={APP_ROUTES.insurance}>ביטוח ופוליסות</Link></li>
                <li><Link to={APP_ROUTES.pension}>פנסיה וחיסכון</Link></li>
                <li><Link to={APP_ROUTES.payslipHistory}>היסטוריית תלושים</Link></li>
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
            <li><Link to={APP_ROUTES.faq}>שאלות נפוצות</Link></li>
            <li><Link to={APP_ROUTES.privacy}>מדיניות פרטיות</Link></li>
            <li><Link to={APP_ROUTES.terms}>תנאי שימוש</Link></li>
          </ul>
        </div>

        <div className="app-footer-col">
          <p className="app-footer-col-heading">החברה</p>
          <ul>
            <li><Link to={APP_ROUTES.team}>הצוות שלנו</Link></li>
            <li><Link to={APP_ROUTES.careers}>קריירה</Link></li>
            <li><Link to={APP_ROUTES.contact}>צור קשר</Link></li>
          </ul>
        </div>
      </div>

      <div className="app-footer-bottom">
        <span>© 2026 FinGuide. כל הזכויות שמורות.</span>
        <div className="app-footer-bottom-links">
          <Link to={APP_ROUTES.privacy}>פרטיות</Link>
          <Link to={APP_ROUTES.terms}>תנאים</Link>
        </div>
      </div>
    </footer>
  );
}
