import { Link } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

type FooterVariant = "guest" | "private";

interface AppFooterProps {
  variant: FooterVariant;
}

const COL_HEAD: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 11.5,
  fontWeight: 800,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.45)",
};

export default function AppFooter({ variant }: AppFooterProps) {
  return (
    <footer
      dir="rtl"
      style={{
        position: "relative",
        overflow: "hidden",
        background: "radial-gradient(120% 90% at 88% 4%,#26242F,#16151B 60%,#0E0D12)",
        color: "#fff",
        padding: "44px var(--gutter) 26px",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* dotted texture + glow, matching the opportunity band */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.055) 1px,transparent 1px)", backgroundSize: "22px 22px", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 360, height: 360, borderRadius: "50%", insetInlineStart: -120, bottom: -160, background: "radial-gradient(circle,rgba(155,127,232,.22),transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative" }}>
        {/* Newsletter strip */}
        {variant === "guest" && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 16,
            borderBottom: "1px solid rgba(255,255,255,.1)",
            paddingBottom: 32, marginBottom: 32,
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#fff", marginBottom: 4 }}>הישארו מעודכנים</div>
              <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.6)" }}>טיפים פיננסיים ועדכוני מוצר ישירות למייל</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                placeholder="המייל שלך"
                style={{
                  padding: "9px 14px", borderRadius: "var(--r-btn)",
                  border: "1px solid rgba(255,255,255,.16)",
                  fontSize: 13.5, fontFamily: "inherit",
                  background: "rgba(255,255,255,.06)", color: "#fff",
                  outline: "none", width: 220,
                }}
              />
              <button style={{
                padding: "9px 18px", borderRadius: "var(--r-btn)",
                background: "#fff", color: "var(--ink)",
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
            <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-.04em", background: "linear-gradient(96deg,#CDB6FF,#F8D2BE 70%,#F6E4A8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: 10 }}>
              FinGuide
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.6, maxWidth: 200 }}>
              הפלטפורמה החכמה לניהול פיננסי אישי בישראל.
            </p>
          </div>

          <div>
            <p style={COL_HEAD}>המוצר</p>
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
            <p style={COL_HEAD}>משאבים</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
              <FooterLink to={APP_ROUTES.faq}>שאלות נפוצות</FooterLink>
              <FooterLink to={APP_ROUTES.privacy}>מדיניות פרטיות</FooterLink>
              <FooterLink to={APP_ROUTES.terms}>תנאי שימוש</FooterLink>
            </ul>
          </div>

          <div>
            <p style={COL_HEAD}>החברה</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
              <FooterLink to={APP_ROUTES.team}>הצוות שלנו</FooterLink>
              <FooterLink to={APP_ROUTES.careers}>קריירה</FooterLink>
              <FooterLink to={APP_ROUTES.contact}>צור קשר</FooterLink>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,.1)",
          paddingTop: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
        }}>
          <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)" }}>© 2026 FinGuide. כל הזכויות שמורות.</span>
          <div style={{ display: "flex", gap: 20 }}>
            <Link to={APP_ROUTES.privacy} style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)", textDecoration: "none" }}>פרטיות</Link>
            <Link to={APP_ROUTES.terms} style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)", textDecoration: "none" }}>תנאים</Link>
          </div>
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
        style={{ fontSize: 13.5, color: "rgba(255,255,255,.7)", textDecoration: "none", fontWeight: 500, transition: "color var(--dur-fast) var(--ease)" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.7)"; }}
      >
        {children}
      </Link>
    </li>
  );
}
