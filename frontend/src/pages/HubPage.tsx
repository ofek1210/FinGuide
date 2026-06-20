import { useNavigate } from "react-router-dom";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";
import { APP_ROUTES } from "../types/navigation";

const PRODUCTS = [
  {
    icon: "📄",
    title: "תלושים ומסמכים",
    subtitle: "ניתוח תלושי שכר, מס הכנסה והחזרים",
    description:
      "הסוכן שלנו מנתח את תלושי השכר שלך, מזהה חריגות, מחשב החזרי מס ומספק המלצות אישיות.",
    route: APP_ROUTES.documents,
    gradient: "linear-gradient(135deg, #F3EEFF 0%, #EDE0FF 100%)",
    accent: "#9B7FE8",
    features: ["ניתוח OCR חכם", "זיהוי חריגות", "חישוב החזרי מס"],
    badge: "AI",
  },
  {
    icon: "🛡️",
    title: "ביטוח ופוליסות",
    subtitle: "ניתוח כיסויים, כפילויות וחיסכון",
    description:
      "הסוכן מנתח את פוליסות הביטוח שלך, מזהה כיסויים כפולים, חוסרים בכיסוי ומציע חיסכון.",
    route: APP_ROUTES.insurance,
    gradient: "linear-gradient(135deg, #FFEEF8 0%, #FFE0F5 100%)",
    accent: "#E879A8",
    features: ["ניתוח הר הביטוח", "גילוי כפילויות", "חיסכון בפרמיות"],
    badge: "AI",
  },
  {
    icon: "📈",
    title: "פנסיה וחיסכון",
    subtitle: "תחזית פרישה, ניהול קרנות ואופטימיזציה",
    description:
      "הסוכן מנתח את קרנות הפנסיה שלך, מסמלץ תרחישים לפרישה ומציע אסטרטגיה לחיסכון.",
    route: APP_ROUTES.pension,
    gradient: "linear-gradient(135deg, #EEFFF5 0%, #D8FFE9 100%)",
    accent: "#059669",
    features: ["סימולציית פרישה", "ניתוח דמי ניהול", "תחזית חיסכון"],
    badge: "AI",
  },
];

export default function HubPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--lg-bg, #FAF7FF)",
        direction: "rtl",
        fontFamily: "var(--lg-font-body, 'Plus Jakarta Sans', sans-serif)",
      }}
    >
      <PrivateTopbar />

      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(155,127,232,0.10)",
              border: "1px solid rgba(155,127,232,0.22)",
              borderRadius: 20,
              padding: "4px 14px",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 14 }}>✨</span>
            <span
              style={{ fontSize: 13, fontWeight: 600, color: "#7B5EA7" }}
            >
              הבינה המלאכותית שלך לניהול פיננסי
            </span>
          </div>

          <h1
            style={{
              fontFamily: "var(--lg-font-display, 'Fraunces', Georgia, serif)",
              fontSize: "clamp(2rem, 4vw, 2.8rem)",
              fontWeight: 700,
              color: "#1F1F1F",
              margin: "0 0 12px",
              lineHeight: 1.2,
            }}
          >
            תפריט העוזר האישי
          </h1>

          <p
            style={{
              fontSize: 17,
              color: "#7C6FA0",
              maxWidth: 520,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            בחר את הסוכן שלך — כל אחד מתמחה בתחום שונה ומספק המלצות
            מדויקות ואישיות
          </p>
        </div>

        {/* 3 Product Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 24,
            marginBottom: 64,
          }}
        >
          {PRODUCTS.map((product) => (
            <button
              key={product.route}
              onClick={() => navigate(product.route)}
              style={{
                background: "#fff",
                border: "1.5px solid rgba(184,157,255,0.20)",
                borderRadius: 28,
                padding: 0,
                cursor: "pointer",
                textAlign: "right",
                transition: "all 0.22s ease",
                boxShadow: "0 4px 24px rgba(155,127,232,0.08)",
                overflow: "hidden",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform =
                  "translateY(-4px)";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 12px 40px rgba(155,127,232,0.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform =
                  "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 4px 24px rgba(155,127,232,0.08)";
              }}
            >
              {/* Gradient top strip */}
              <div
                style={{
                  background: product.gradient,
                  padding: "32px 28px 24px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.70)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    flexShrink: 0,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {product.icon}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <h2
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#1F1F1F",
                        margin: 0,
                        fontFamily: "var(--lg-font-display, 'Fraunces', Georgia, serif)",
                      }}
                    >
                      {product.title}
                    </h2>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: product.accent,
                        background: "rgba(255,255,255,0.7)",
                        borderRadius: 6,
                        padding: "2px 6px",
                        letterSpacing: 0.5,
                      }}
                    >
                      {product.badge}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#7C6FA0",
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {product.subtitle}
                  </p>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "20px 28px 28px" }}>
                <p
                  style={{
                    fontSize: 14,
                    color: "#5D5477",
                    lineHeight: 1.6,
                    margin: "0 0 20px",
                  }}
                >
                  {product.description}
                </p>

                {/* Feature chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
                  {product.features.map((f) => (
                    <span
                      key={f}
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: product.accent,
                        background: `${product.gradient.split(",")[0].replace("linear-gradient(135deg, ", "")}`,
                        border: `1px solid ${product.accent}22`,
                        borderRadius: 20,
                        padding: "4px 12px",
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: product.accent,
                    }}
                  >
                    התחל ניתוח →
                  </span>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      background: product.gradient,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: product.accent,
                      fontSize: 18,
                    }}
                  >
                    ←
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Bottom info strip */}
        <div
          style={{
            background: "rgba(255,255,255,0.70)",
            border: "1px solid rgba(184,157,255,0.18)",
            borderRadius: 20,
            padding: "24px 32px",
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 28 }}>🔒</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 700, color: "#1F1F1F", marginBottom: 4, fontSize: 15 }}>
              הנתונים שלך מוגנים
            </div>
            <div style={{ color: "#7C6FA0", fontSize: 13, lineHeight: 1.5 }}>
              כל הניתוחים מתבצעים בצורה מאובטחת. אנחנו לא שומרים מידע רגיש מעבר לנדרש
              לצורך הניתוח.
            </div>
          </div>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
            {[
              { value: "SSL", label: "הצפנה" },
              { value: "GDPR", label: "תאימות" },
              { value: "24/7", label: "זמינות" },
            ].map((stat) => (
              <div key={stat.label} style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, color: "#9B7FE8", fontSize: 16 }}>{stat.value}</div>
                <div style={{ color: "#A89CC8", fontSize: 12 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <AppFooter variant="private" />
    </div>
  );
}
