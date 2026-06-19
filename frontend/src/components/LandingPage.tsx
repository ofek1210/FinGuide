import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";
import AppFooter from "./AppFooter";

/* ── Product definitions ─────────────────────────────────────── */
const PRODUCTS = [
  {
    id: "payslips",
    emoji: "📄",
    color: "#9B7FE8",
    colorLight: "#F3EEFF",
    title: "תלושים ומסמכים",
    subtitle: "סוכן AI לשכר",
    desc: "מחבר את Gmail שלך, מייבא תלושים אוטומטית, מנתח שכר ברוטו/נטו, מזהה ניכויים חריגים ומכין המלצות מס לסוף שנה.",
    features: ["ייבוא Gmail אוטומטי", "ניתוח ניכויי שכר", "המלצות מס", "מגמות לאורך זמן"],
    route: "/documents",
  },
  {
    id: "insurance",
    emoji: "🛡️",
    color: "#7B5EA7",
    colorLight: "#EDE8F9",
    title: "ביטוח ופוליסות",
    subtitle: "סוכן AI לביטוח",
    desc: "מנתח את כל הפוליסות שלך מקובץ Excel של הר הביטוח, מגלה כיסויים כפולים, פערים בכיסוי, ומזהה הזדמנויות לחיסכון.",
    features: ["ייבוא הר הביטוח", "גילוי כפולים", "ניתוח פערים", "המלצות חיסכון"],
    route: "/insurance",
  },
  {
    id: "pension",
    emoji: "📈",
    color: "#6B4FA0",
    colorLight: "#EAE3F7",
    title: "פנסיה וחיסכון",
    subtitle: "סוכן AI לפנסיה",
    desc: "מנתח קרנות פנסיה, מחשב תחזית צבירה לפרישה, מגלה דמי ניהול יקרים, ומדמה תרחישים של שינוי תרומה או גיל פרישה.",
    features: ["תחזית פרישה", "ניתוח דמי ניהול", "השוואת קרנות", "סימולציות"],
    route: "/pension",
  },
];

/* ── Testimonials ────────────────────────────────────────────── */
const TESTIMONIALS = [
  { name: "נועה כ.", role: "מהנדסת תוכנה", text: "גיליתי שמעסיקי לא הפריש פנסיה ב-4 חודשים. FinGuide תפס את זה ב-2 דקות." },
  { name: "אמיר ל.", role: "מנהל שיווק", text: "חיסכתי ₪800 בחודש על ביטוחים כפולים שלא ידעתי שיש לי. מדהים." },
  { name: "שיר מ.", role: "רופאה", text: "תחזית הפנסיה שלי נראית הרבה יותר בהירה עכשיו. ממש מעצימה." },
];

/* ── FAQ ─────────────────────────────────────────────────────── */
const FAQS = [
  { q: "האם המידע שלי מאובטח?", a: "כן. כל הנתונים מוצפנים בתעבורה וב-rest. אנחנו לעולם לא מוכרים מידע ולא שולחים אותו לגורמים חיצוניים." },
  { q: "האם זה מחייב ייעוץ מקצועי?", a: "FinGuide מספקת ניתוח ותובנות, לא ייעוץ רגולטורי. לפני החלטות פיננסיות גדולות מומלץ להיוועץ ביועץ מורשה." },
  { q: "איך FinGuide שונה מכלים אחרים?", a: "אנחנו משלבים OCR, מנוע חוקים, מנוע חישובים, ו-LLM — כדי שהמספרים תמיד מגיעים מחישובים, לא מהמצאה של AI." },
  { q: "האם ניתן להשתמש ב-FinGuide בחינם?", a: "יש תקופת ניסיון חינמית מלאה. לאחר מכן מחירים גמישים לפי שימוש." },
];

/* ─────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FAF7FF",
      color: "#1F1F1F",
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      direction: "rtl",
      overflowX: "hidden",
    }}>

      {/* ── Background orbs ──────────────────────────────────── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: "45vw", height: "45vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(184,157,255,0.28) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: "35%", left: "-8%", width: "35vw", height: "35vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(155,127,232,0.16) 0%, transparent 65%)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "20%", width: "28vw", height: "28vw", borderRadius: "50%", background: "radial-gradient(circle, rgba(216,200,255,0.22) 0%, transparent 70%)" }} />
      </div>

      {/* ── Navbar ───────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        padding: "0 40px",
        background: scrolled ? "rgba(250,247,255,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        borderBottom: scrolled ? "1px solid rgba(184,157,255,0.2)" : "1px solid transparent",
        transition: "all 0.3s ease",
      }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 68 }}>
          {/* Logo */}
          <div style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, #9B7FE8 0%, #6B4FA0 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            FinGuide
          </div>

          {/* Center nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, position: "relative" }}>
            {/* Personal Assistant Menu */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 12,
                  background: menuOpen ? "rgba(184,157,255,0.18)" : "transparent",
                  border: "1px solid",
                  borderColor: menuOpen ? "rgba(184,157,255,0.4)" : "transparent",
                  color: "#3D3553", fontWeight: 600, fontSize: 14,
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.18s",
                }}
              >
                הסוכנים האישיים שלי
                <span style={{ transition: "transform 0.2s", transform: menuOpen ? "rotate(180deg)" : "none", fontSize: 10, opacity: 0.6 }}>▼</span>
              </button>

              {menuOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0,
                  background: "rgba(255,255,255,0.96)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(184,157,255,0.3)",
                  borderRadius: 20, boxShadow: "0 16px 48px rgba(155,127,232,0.2)",
                  padding: 8, minWidth: 300, zIndex: 200,
                }}>
                  {PRODUCTS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setMenuOpen(false); navigate(p.route); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 14,
                        width: "100%", padding: "12px 16px", borderRadius: 14,
                        background: "transparent", border: "none",
                        cursor: "pointer", textAlign: "right", fontFamily: "inherit",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = p.colorLight)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: 22, width: 36, height: 36, borderRadius: 10, background: p.colorLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.emoji}</span>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1F1F1F" }}>{p.title}</div>
                        <div style={{ fontSize: 11.5, color: "#7C6FA0", marginTop: 1 }}>{p.subtitle}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <NavLink onClick={() => navigate(APP_ROUTES.login)}>כניסה</NavLink>
          </div>

          {/* CTA */}
          <button
            onClick={() => navigate(APP_ROUTES.register)}
            style={{
              padding: "10px 22px", borderRadius: 14,
              background: "linear-gradient(135deg, #9B7FE8, #6B4FA0)",
              color: "#fff", fontWeight: 700, fontSize: 14,
              border: "none", cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 20px rgba(155,127,232,0.35)",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 28px rgba(155,127,232,0.45)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(155,127,232,0.35)"; }}
          >
            התחל בחינם ←
          </button>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto", padding: "80px 40px 64px", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 16px 6px 10px", borderRadius: 999,
          background: "rgba(184,157,255,0.15)",
          border: "1px solid rgba(184,157,255,0.35)",
          marginBottom: 28,
        }}>
          <span style={{ fontSize: 14 }}>✦</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#7B5EA7" }}>מבוסס AI רב-סוכני</span>
        </div>

        <h1 style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: "clamp(36px, 6vw, 68px)",
          fontWeight: 700, lineHeight: 1.1,
          letterSpacing: "-0.035em",
          color: "#1F1F1F",
          margin: "0 0 22px",
          maxWidth: 820, marginLeft: "auto", marginRight: "auto",
        }}>
          הכסף שלך ראוי לייעוץ{" "}
          <span style={{
            background: "linear-gradient(135deg, #9B7FE8 0%, #6B4FA0 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            חכם יותר
          </span>
        </h1>

        <p style={{
          fontSize: "clamp(15px, 2vw, 18px)", color: "#7C6FA0",
          lineHeight: 1.7, maxWidth: 600, margin: "0 auto 40px",
        }}>
          FinGuide מנתחת את תלושי השכר, הביטוחים והפנסיה שלך בעזרת AI מתקדם — ומוצאת כסף שכבר שלך ומחכה שתקחי אותו.
        </p>

        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate(APP_ROUTES.register)}
            style={{
              padding: "14px 32px", borderRadius: 16,
              background: "linear-gradient(135deg, #9B7FE8, #6B4FA0)",
              color: "#fff", fontWeight: 700, fontSize: 16,
              border: "none", cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 6px 28px rgba(155,127,232,0.40)",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
          >
            התחל ניתוח בחינם
          </button>
          <button
            onClick={() => navigate(APP_ROUTES.login)}
            style={{
              padding: "14px 28px", borderRadius: 16,
              background: "rgba(255,255,255,0.8)",
              color: "#3D3553", fontWeight: 600, fontSize: 15,
              border: "1px solid rgba(184,157,255,0.35)",
              cursor: "pointer", fontFamily: "inherit",
              backdropFilter: "blur(8px)",
              transition: "all 0.2s",
            }}
          >
            כניסה לחשבון
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 40, justifyContent: "center", marginTop: 56, flexWrap: "wrap" }}>
          {[["₪12,400", "ממוצע חיסכון שנתי"], ["3 דקות", "לניתוח מלא"], ["98%", "דיוק OCR"]].map(([val, lbl]) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 28, fontWeight: 700, color: "#9B7FE8", letterSpacing: "-0.03em" }}>{val}</div>
              <div style={{ fontSize: 12.5, color: "#7C6FA0", marginTop: 3 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3 Product Cards ──────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto", padding: "0 40px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(24px, 4vw, 38px)", fontWeight: 700, letterSpacing: "-0.03em", color: "#1F1F1F", margin: "0 0 12px" }}>
            שלושה סוכנים AI אישיים
          </h2>
          <p style={{ fontSize: 15.5, color: "#7C6FA0", margin: 0 }}>כל אחד מתמחה, כולם עובדים יחד</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          {PRODUCTS.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} onNavigate={() => navigate(p.route)} />
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(184,157,255,0.15)", borderBottom: "1px solid rgba(184,157,255,0.15)", padding: "72px 40px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(24px, 4vw, 38px)", fontWeight: 700, letterSpacing: "-0.03em", color: "#1F1F1F", marginBottom: 12 }}>
            איך זה עובד?
          </h2>
          <p style={{ fontSize: 15.5, color: "#7C6FA0", marginBottom: 56 }}>שלושה שלבים פשוטים</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 32 }}>
            {[
              { num: "01", title: "מחבר את המסמכים", desc: "Gmail, Excel מהר הביטוח, או העלאה ידנית של תלושים ודוחות פנסיה." },
              { num: "02", title: "AI מנתח הכל", desc: "מנוע חוקים + מנוע חישובים + Claude AI — כדי שהמספרים תמיד מדויקים." },
              { num: "03", title: "מקבל המלצות פעולה", desc: "תובנות ברורות, בעברית, עם המלצות מה לעשות עכשיו ומה לחקור עוד." },
            ].map(step => (
              <div key={step.num} style={{ textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
                  background: "linear-gradient(135deg, rgba(155,127,232,0.15), rgba(155,127,232,0.08))",
                  border: "1px solid rgba(184,157,255,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700, color: "#9B7FE8",
                }}>
                  {step.num}
                </div>
                <div style={{ fontWeight: 700, fontSize: 17, color: "#1F1F1F", marginBottom: 8 }}>{step.title}</div>
                <div style={{ fontSize: 14, color: "#7C6FA0", lineHeight: 1.6 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto", padding: "72px 40px" }}>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700, letterSpacing: "-0.03em", textAlign: "center", color: "#1F1F1F", marginBottom: 48 }}>
          מה המשתמשים אומרים
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {TESTIMONIALS.map((t, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.78)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(184,157,255,0.2)",
              borderRadius: 24, padding: "28px 24px",
              boxShadow: "0 4px 24px rgba(155,127,232,0.10)",
            }}>
              <div style={{ fontSize: 22, marginBottom: 14, color: "#9B7FE8" }}>"</div>
              <p style={{ fontSize: 14.5, color: "#3D3553", lineHeight: 1.7, margin: "0 0 20px" }}>{t.text}</p>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1F1F1F" }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: "#7C6FA0" }}>{t.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "0 40px 80px" }}>
        <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 700, letterSpacing: "-0.03em", textAlign: "center", color: "#1F1F1F", marginBottom: 40 }}>
          שאלות נפוצות
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(184,157,255,0.2)", borderRadius: 18,
              overflow: "hidden", transition: "box-shadow 0.2s",
              boxShadow: openFaq === i ? "0 4px 20px rgba(155,127,232,0.14)" : "none",
            }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%", padding: "18px 22px", background: "none", border: "none",
                  cursor: "pointer", textAlign: "right", fontFamily: "inherit",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 15, color: "#1F1F1F" }}>{faq.q}</span>
                <span style={{ color: "#9B7FE8", fontSize: 18, flexShrink: 0, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
              </button>
              {openFaq === i && (
                <div style={{ padding: "0 22px 18px", fontSize: 14, color: "#7C6FA0", lineHeight: 1.7 }}>{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, maxWidth: 1120, margin: "0 auto 80px", padding: "0 40px" }}>
        <div style={{
          background: "linear-gradient(135deg, rgba(155,127,232,0.12) 0%, rgba(184,157,255,0.18) 100%)",
          border: "1px solid rgba(184,157,255,0.35)",
          borderRadius: 32, padding: "56px 48px",
          textAlign: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(155,127,232,0.15), transparent 70%)", pointerEvents: "none" }} />
          <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 700, letterSpacing: "-0.03em", color: "#1F1F1F", margin: "0 0 16px" }}>
            מוכן/ה להתחיל לחסוך?
          </h2>
          <p style={{ fontSize: 16, color: "#7C6FA0", margin: "0 0 32px" }}>
            תוך 3 דקות תדע/י מה FinGuide יכולה לחשוף בשבילך.
          </p>
          <button
            onClick={() => navigate(APP_ROUTES.register)}
            style={{
              padding: "16px 40px", borderRadius: 18,
              background: "linear-gradient(135deg, #9B7FE8, #6B4FA0)",
              color: "#fff", fontWeight: 700, fontSize: 17,
              border: "none", cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 8px 32px rgba(155,127,232,0.45)",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
          >
            התחל ניתוח בחינם ←
          </button>
        </div>
      </section>

      <AppFooter variant="guest" />
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────── */

function NavLink({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px", borderRadius: 10, background: "none",
        border: "none", color: "#3D3553", fontWeight: 500, fontSize: 14,
        cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(184,157,255,0.15)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
    >
      {children}
    </button>
  );
}

function ProductCard({ product: p, onNavigate }: { product: typeof PRODUCTS[0]; index: number; onNavigate: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.75)",
        backdropFilter: "blur(16px)",
        border: `1px solid ${hovered ? "rgba(184,157,255,0.45)" : "rgba(184,157,255,0.22)"}`,
        borderRadius: 28, padding: "32px 28px",
        cursor: "pointer",
        boxShadow: hovered ? `0 12px 40px rgba(155,127,232,0.22)` : "0 4px 20px rgba(155,127,232,0.10)",
        transform: hovered ? "translateY(-4px)" : "none",
        transition: "all 0.25s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, fontSize: 24,
          background: p.colorLight, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, boxShadow: `0 4px 14px ${p.color}20`,
        }}>
          {p.emoji}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "#1F1F1F", letterSpacing: "-0.02em" }}>{p.title}</div>
          <div style={{ fontSize: 12.5, color: p.color, fontWeight: 600, marginTop: 2 }}>{p.subtitle}</div>
        </div>
      </div>

      <p style={{ fontSize: 14, color: "#5A527A", lineHeight: 1.65, margin: "0 0 20px" }}>{p.desc}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {p.features.map(f => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ color: p.color, fontSize: 12 }}>✓</span>
            <span style={{ color: "#5A527A" }}>{f}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 6, color: p.color, fontWeight: 700, fontSize: 13.5 }}>
        פתח את הסוכן <span style={{ transition: "transform 0.2s", transform: hovered ? "translateX(-4px)" : "none" }}>←</span>
      </div>
    </div>
  );
}
