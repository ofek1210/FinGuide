import { Link } from "react-router-dom";
import { APP_ROUTES } from "../../types/navigation";

export default function PublicFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-top">
          <div className="foot-brand">
            <div className="brand">
              <span className="dot">F</span>
              <b>
                Fin<span style={{ color: "var(--lav-300)" }}>Guide</span>
              </b>
            </div>
            <p>
              הכסף שמגיע לך, בלי בירוקרטיה. ניתוח פיננסי חכם מבוסס AI — תלושים, פנסיה
              וזכויות במקום אחד.
            </p>
          </div>
          <div className="fcol">
            <h4>מוצר</h4>
            <Link to={`${APP_ROUTES.home}#products`}>ניתוח תלושים</Link>
            <Link to={`${APP_ROUTES.home}#products`}>אופטימיזציית פנסיה</Link>
            <Link to={`${APP_ROUTES.home}#products`}>מימוש זכויות</Link>
            <Link to={`${APP_ROUTES.home}#products`}>תמחור</Link>
          </div>
          <div className="fcol">
            <h4>חברה</h4>
            <Link to={APP_ROUTES.team}>הכר את הצוות</Link>
            <Link to={APP_ROUTES.careers}>קריירה</Link>
            <Link to={APP_ROUTES.contact}>צור קשר</Link>
          </div>
          <div className="fcol">
            <h4>משפטי</h4>
            <Link to={APP_ROUTES.terms}>תנאי שימוש</Link>
            <Link to={APP_ROUTES.privacy}>מדיניות פרטיות</Link>
          </div>
        </div>
        <div className="foot-bot">
          <span>© 2026 FinGuide. כל הזכויות שמורות.</span>
          <span>נבנה באהבה בישראל 🇮🇱</span>
        </div>
      </div>
    </footer>
  );
}
