import { Link } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

type FooterVariant = "guest" | "private";

interface AppFooterProps {
  variant: FooterVariant;
}

export default function AppFooter({ variant }: AppFooterProps) {
  return (
    <footer
      dir="rtl"
      style={{
        borderTop: "1px solid var(--border-hair)",
        background: "var(--surface-card)",
        padding: "40px var(--gutter) 24px",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Newsletter strip */}
      {variant === "guest" && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 16,
          borderBottom: "1px solid var(--border-hair)",
          paddingBottom: 32, marginBottom: 32,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-strong)", marginBottom: 4 }}>הישארו מעודכנים</div>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>טיפים פיננסיים ועדכוני מוצר ישירות למייל</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              placeholder="המייל שלך"
              style={{
                padding: "9px 14px", borderRadius: "var(--r-btn)",
                border: "1px solid var(--border-soft)",
                fontSize: 13.5, fontFamily: "inherit",
                background: "var(--surface-sunken)", color: "var(--text-body)",
                outline: "none", width: 220,
              }}
            />
            <button style={{
              padding: "9px 18px", borderRadius: "var(--r-btn)",
              background: "var(--ink)", color: "#fff",
              border: "none", fontFamily: "inherit",
              fontWeight: 700, fontSize: 13.5, cursor: "pointer",
            }}>
              הרשמה
            </button>
          </div>
        </div>
      )}

      {/* Columns */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 32,
        marginBottom: 40,
      }}>
        {/* Brand column */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-.04em", background: "var(--grad-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: 10 }}>
            FinGuide
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 200 }}>
            הפלטפורמה החכמה לניהול פיננסי אישי בישראל.
          </p>
        </div>

        <div>
          <p style={{ margin: "0 0 14px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-faint)" }}>המוצר</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
            {variant === "private" ? (
              <>
                <FooterLink to={APP_ROUTES.hub}>דף הבית</FooterLink>
                <FooterLink to={APP_ROUTES.documents}>תלושים ומסמכים</FooterLink>
                <FooterLink to={APP_ROUTES.insurance}>ביטוח ופוליסות</FooterLink>
                <FooterLink to={APP_ROUTES.pension}>פנסיה וחיסכון</FooterLink>
                <FooterLink to={APP_ROUTES.findings}>ממצאים</FooterLink>
              </>
            ) : (
              <>
                <FooterLink to={APP_ROUTES.home}>דף הבית</FooterLink>
                <FooterLink to={APP_ROUTES.login}>התחברות</FooterLink>
                <FooterLink to={APP_ROUTES.register}>התחל עכשיו</FooterLink>
              </>
            )}
          </ul>
        </div>

        <div>
          <p style={{ margin: "0 0 14px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-faint)" }}>משאבים</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
            <FooterLink to={APP_ROUTES.faq}>שאלות נפוצות</FooterLink>
            <FooterLink to={APP_ROUTES.privacy}>מדיניות פרטיות</FooterLink>
            <FooterLink to={APP_ROUTES.terms}>תנאי שימוש</FooterLink>
          </ul>
        </div>

        <div>
          <p style={{ margin: "0 0 14px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-faint)" }}>החברה</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
            <FooterLink to={APP_ROUTES.team}>הצוות שלנו</FooterLink>
            <FooterLink to={APP_ROUTES.careers}>קריירה</FooterLink>
            <FooterLink to={APP_ROUTES.contact}>צור קשר</FooterLink>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        borderTop: "1px solid var(--border-hair)",
        paddingTop: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>© 2026 FinGuide. כל הזכויות שמורות.</span>
        <div style={{ display: "flex", gap: 20 }}>
          <Link to={APP_ROUTES.privacy} style={{ fontSize: 12.5, color: "var(--text-faint)", textDecoration: "none" }}>פרטיות</Link>
          <Link to={APP_ROUTES.terms} style={{ fontSize: 12.5, color: "var(--text-faint)", textDecoration: "none" }}>תנאים</Link>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        style={{ fontSize: 13.5, color: "var(--text-muted)", textDecoration: "none", fontWeight: 500, transition: "color var(--dur-fast) var(--ease)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
      >
        {children}
      </Link>
    </li>
  );
}
