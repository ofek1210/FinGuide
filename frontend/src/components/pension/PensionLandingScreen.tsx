import { useEffect } from "react";
import { CalendarClock, Download, Landmark, Layers, LineChart, Lock, Percent, TrendingUp, type LucideIcon } from "lucide-react";
import { PENSION_SITE_URL } from "../../config/govReportImportConfig";

/* ============================================================
   PensionLandingScreen — opening / empty state for the pension
   agent, ported from the canonical Claude Design PensionImport
   screen. Mint-dominant with the signature consolidation motif:
   pension funds orbit a central growth emblem. Design-system
   throughout — Heebo weights, crisp radii, soft shadows, lucide
   line icons (no emoji).
   ============================================================ */

const G = "47,156,98"; // pension green (var(--mint-ink)) as rgb for translucent tints

type PensionLandingScreenProps = {
  onImport: () => void;
  onManual: () => void;
};

/** Orbiting fund chips — each rides a rotating ring; the inner chip
    counter-rotates (same negative delay) so its label stays upright. */
const ORBITS = [
  { label: "פנסיה", color: "var(--mint-ink)", r: 124, dur: 20, start: 0 },
  { label: "גמל", color: "var(--lav-600)", r: 124, dur: 20, start: 120 },
  { label: "השתלמות", color: "var(--butter-ink)", r: 124, dur: 20, start: 240 },
];

const FEATURES: Array<{ Icon: LucideIcon; title: string; body: string }> = [
  { Icon: LineChart, title: "סימולציית תרחישים", body: "מה יקרה אם תגדיל הפקדות או תפרוש מוקדם." },
  { Icon: Layers, title: "ריכוז קרנות", body: "כמה קרנות יש לך — והאם כדאי לאחד אותן." },
  { Icon: Percent, title: "דמי ניהול", body: "האם אתה משלם יותר מדי? חיסכון פוטנציאלי עד פרישה." },
  { Icon: CalendarClock, title: "תחזית פרישה", body: "כמה תצבור עד הפרישה וכמה תקבל לחודש." },
];

export default function PensionLandingScreen({ onImport, onManual }: PensionLandingScreenProps) {
  useEffect(() => {
    if (document.getElementById("pi-anim")) return;
    const st = document.createElement("style");
    st.id = "pi-anim";
    st.textContent =
      "@keyframes piPulse{0%{transform:scale(.7);opacity:.55}80%,100%{transform:scale(1.55);opacity:0}}" +
      "@keyframes piDraw{from{stroke-dashoffset:120}to{stroke-dashoffset:0}}" +
      "@keyframes piSpin{to{transform:rotate(360deg)}}" +
      "@keyframes piSpinR{to{transform:rotate(-360deg)}}" +
      "@keyframes piBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}" +
      "@media (prefers-reduced-motion:reduce){.pi-orbit,.pi-pulse,.pi-draw,.pi-bob{animation:none!important}}";
    document.head.appendChild(st);
  }, []);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "30px 24px 84px" }}>
      {/* ============ HERO ============ */}
      <div style={{ position: "relative", textAlign: "center", padding: "32px 0 26px" }}>
        {/* orbit system */}
        <div style={{ position: "relative", width: 284, height: 284, margin: "0 auto 30px" }}>
          {/* faint orbit guide ring */}
          <span style={{ position: "absolute", inset: 16, borderRadius: "50%", border: `1px dashed rgba(${G},.2)` }} />

          {/* orbiting fund chips */}
          {ORBITS.map(o => {
            const delay = `${-(o.start / 360) * o.dur}s`;
            return (
              <div key={o.label} className="pi-orbit" style={{ position: "absolute", inset: 0, animation: `piSpin ${o.dur}s linear infinite`, animationDelay: delay }}>
                <div style={{ position: "absolute", top: `calc(50% - ${o.r}px)`, left: "50%", transform: "translateX(-50%)" }}>
                  {/* counter-rotate so the label stays upright (same delay keeps it synced) */}
                  <div className="pi-orbit" style={{ animation: `piSpinR ${o.dur}s linear infinite`, animationDelay: delay }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 999, background: "var(--card)", border: "1px solid var(--border-hair)", boxShadow: "var(--shadow-soft)", fontSize: 12.5, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap" }}>
                      <span style={{ width: 11, height: 11, borderRadius: "50%", background: o.color }} />{o.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* central growth emblem */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 96, height: 96 }}>
            <span className="pi-pulse" style={{ position: "absolute", inset: 0, borderRadius: 26, border: "2px solid var(--mint-ink)", animation: "piPulse 2.8s ease-out infinite" }} />
            <span className="pi-bob" style={{ position: "relative", display: "grid", placeItems: "center", width: 96, height: 96, borderRadius: 26, overflow: "hidden", background: "linear-gradient(155deg,#1E5638,#0E3D27)", boxShadow: "var(--shadow-card)", animation: "piBob 3.4s ease-in-out infinite" }}>
              {/* self-drawing growth line */}
              <svg viewBox="0 0 48 48" width="52" height="52" fill="none">
                <path d="M8 36h32" stroke="rgba(143,214,168,.4)" strokeWidth="2" strokeLinecap="round" />
                <path className="pi-draw" d="M9 33l8-7 7 5 14-15" stroke="#8FD6A8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={120} strokeDasharray={120} style={{ animation: "piDraw 2.2s var(--ease) infinite" }} />
                <path d="M31 16h7v7" stroke="#8FD6A8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </div>

        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "var(--mint-soft)", color: "var(--mint-ink)", fontSize: 13, fontWeight: 800, marginBottom: 20 }}>
          <TrendingUp size={14} strokeWidth={2.4} />סוכן עוזר פנסיוני
        </span>
        <h1 style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.06, margin: "0 0 16px", color: "var(--text-strong)" }}>
          הסוכן האישי שלי<br />לפנסיה וחיסכון.
        </h1>
        <p style={{ fontSize: 17.5, color: "var(--text-muted)", lineHeight: 1.6, fontWeight: 500, margin: "0 auto 30px", maxWidth: 540 }}>
          ניתוח מלא של קרנות הפנסיה, קופות הגמל וקרנות ההשתלמות שלך — ישירות מ<b style={{ color: "var(--mint-ink)", fontWeight: 800 }}>הר הכסף</b>, מאגר הנתונים הפנסיוניים הרשמי של מדינת ישראל.
        </p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <button
            onClick={onImport}
            style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 30px", borderRadius: "var(--r-btn)", background: "var(--mint-ink)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 16.5, boxShadow: `0 14px 30px -12px rgba(${G},.55)`, transition: "transform .2s var(--ease), box-shadow .2s var(--ease)" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
          >
            <Download size={18} strokeWidth={2.3} />ייבוא מהר הכסף
          </button>
          <span style={{ fontSize: 13, color: "var(--text-faint)", fontWeight: 600 }}>חינמי · מאובטח · ~2 דקות</span>
          <button onClick={onManual} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 700, color: "var(--mint-ink)", textDecoration: "underline", textUnderlineOffset: 3, padding: 0 }}>
            הזן נתונים ידנית במקום זאת
          </button>
        </div>
      </div>

      {/* ============ capabilities ============ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(195px,1fr))", gap: 16, marginTop: 26 }}>
        {FEATURES.map(f => (
          <div
            key={f.title}
            style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", padding: 22, boxShadow: "var(--shadow-soft)", transition: "transform .3s var(--ease), border-color .3s var(--ease)", cursor: "default" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.borderColor = `rgba(${G},.4)`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = "var(--border-hair)"; }}
          >
            <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--mint-soft)", color: "var(--mint-ink)", display: "grid", placeItems: "center", marginBottom: 16 }}>
              <f.Icon size={22} strokeWidth={2.1} />
            </span>
            <h3 style={{ margin: "0 0 7px", fontSize: 16, fontWeight: 800, letterSpacing: "-.01em", color: "var(--text-strong)" }}>{f.title}</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{f.body}</p>
          </div>
        ))}
      </div>

      {/* ============ what is Har HaKesef ============ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 20, padding: "20px 22px", borderRadius: "var(--radius)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)" }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, flex: "none", background: "var(--card)", color: "var(--lav-600)", display: "grid", placeItems: "center", boxShadow: "var(--shadow-soft)" }}>
          <Landmark size={20} strokeWidth={2} />
        </span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, color: "var(--text-strong)" }}>מה זה הר הכסף?</div>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            הר הכסף הוא שירות ממשלתי רשמי של משרד האוצר שמרכז את כל החסכונות הפנסיוניים שלך — פנסיה, גמל, השתלמות וביטוח מנהלים — ממקום אחד.{" "}
            <a href={PENSION_SITE_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--mint-ink)", fontWeight: 800, textDecoration: "none" }}>לאתר הרשמי ←</a>
          </div>
        </div>
      </div>

      {/* ============ security note ============ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginTop: 14, padding: "20px 22px", borderRadius: "var(--radius)", background: "var(--mint-soft)", border: `1px solid rgba(${G},.18)` }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, flex: "none", background: "var(--card)", color: "var(--mint-ink)", display: "grid", placeItems: "center", boxShadow: "var(--shadow-soft)" }}>
          <Lock size={20} strokeWidth={2} />
        </span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, color: "var(--text-strong)" }}>המידע שלך מאובטח</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.55 }}>אנחנו לא ניגשים ישירות לחשבון שלך. אתה מוריד את הדוח בעצמך מהאתר הרשמי ומעלה אותו לניתוח.</div>
        </div>
      </div>
    </main>
  );
}
