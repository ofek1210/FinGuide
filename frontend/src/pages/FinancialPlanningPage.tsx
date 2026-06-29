import { useEffect, useState } from "react";
import {
  Sparkles, AlertTriangle, TrendingUp, BarChart3, Scale, Shield,
  FileText, ArrowLeft, type LucideIcon,
} from "lucide-react";
import PrivateTopbar from "../components/PrivateTopbar";
import AppFooter from "../components/AppFooter";

/* מרכז תכנון פיננסי — Financial Planning Center (setup-state dashboard).
   Faithful to ui_kits/app/FinancialPlanning.jsx — health score, cash-flow
   stats, AI problem list with fix plans, investments+forecast, budget 50/30/20,
   and three setup cards. Design-system tokens, Heebo, RTL. */

const card: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-soft)" };

function Btn({ children, variant = "primary", size = "md", fullWidth, iconLeft, onClick }: { children: React.ReactNode; variant?: "primary" | "secondary"; size?: "sm" | "md"; fullWidth?: boolean; iconLeft?: React.ReactNode; onClick?: () => void }) {
  const pad = size === "sm" ? "9px 16px" : "12px 22px";
  const fs = size === "sm" ? 13.5 : 15;
  const primary = variant === "primary";
  return (
    <button type="button" onClick={onClick}
      style={{ width: fullWidth ? "100%" : undefined, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: pad, borderRadius: "var(--r-pill)", border: primary ? "none" : "1px solid var(--border-soft)", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: fs, color: primary ? "#fff" : "var(--ink)", background: primary ? "var(--ink)" : "var(--card)", boxShadow: primary ? "var(--shadow-ink)" : "var(--shadow-soft)", transition: "transform .2s var(--ease)" }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
      {iconLeft}{children}
    </button>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "lavender" | "mint" | "peach" | "butter" }) {
  const map: Record<string, [string, string, string]> = {
    lavender: ["var(--lav-100)", "var(--lav-600)", "var(--lav-200)"],
    mint: ["var(--mint-soft)", "var(--mint-ink)", "var(--mint)"],
    peach: ["var(--peach-soft)", "var(--peach-ink)", "var(--peach)"],
    butter: ["var(--butter-soft)", "var(--butter-ink)", "var(--butter)"],
  };
  const [bg, fg, ring] = map[tone];
  return <span style={{ fontSize: 11.5, fontWeight: 800, color: fg, background: bg, border: `1px solid ${ring}`, borderRadius: "var(--r-pill)", padding: "4px 11px" }}>{children}</span>;
}

/* progress ring */
function FPRing({ value, size, sw, color, track = "var(--hair)" }: { value: number; size: number; sw: number; color: string; track?: string }) {
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(value, 100) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1.3s cubic-bezier(.22,.61,.36,1)" }} />
    </svg>
  );
}

/* donut */
function FPDonut({ size = 150, sw = 22, segments }: { size?: number; sw?: number; segments: { label: string; pct: number; color: string }[] }) {
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hair)" strokeWidth={sw} />
      {segments.filter(s => s.pct > 0).map((s, i) => {
        const len = (s.pct / 100) * circ;
        const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${len} ${circ}`} strokeDashoffset={-acc} strokeLinecap="butt" style={{ transition: "stroke-dasharray 1.1s var(--ease)" }} />;
        acc += len;
        return el;
      })}
    </svg>
  );
}

type ProfileKey = "שמרני" | "מאוזן" | "אנרגטי";
const PROFILES: Record<ProfileKey, { ret: string; alloc: [string, number, string][] }> = {
  שמרני: { ret: "3%–6%", alloc: [["מניות", 20, "var(--lav-600)"], ["נדל״ן", 10, "var(--mint-ink)"], ["אג״ח קונצרני", 25, "var(--peach-ink)"], ["אג״ח ממשלתי", 30, "var(--butter-ink)"], ["מזומן", 15, "var(--text-faint)"]] },
  מאוזן: { ret: "5%–10%", alloc: [["מניות", 35, "var(--lav-600)"], ["נדל״ן", 20, "var(--mint-ink)"], ["אג״ח קונצרני", 20, "var(--peach-ink)"], ["אג״ח ממשלתי", 15, "var(--butter-ink)"], ["מזומן", 10, "var(--text-faint)"]] },
  אנרגטי: { ret: "8%–14%", alloc: [["מניות", 55, "var(--lav-600)"], ["נדל״ן", 15, "var(--mint-ink)"], ["אג״ח קונצרני", 15, "var(--peach-ink)"], ["אג״ח ממשלתי", 10, "var(--butter-ink)"], ["מזומן", 5, "var(--text-faint)"]] },
};

export default function FinancialPlanningPage() {
  const [openP, setOpenP] = useState<number | null>(null);
  const [profile, setProfile] = useState<ProfileKey>("מאוזן");
  const [budgetOpen, setBudgetOpen] = useState(false);

  useEffect(() => {
    if (document.getElementById("fp-anim")) return;
    const st = document.createElement("style");
    st.id = "fp-anim";
    st.textContent =
      "@keyframes fpIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
      "@keyframes fpBar{from{height:0}}@keyframes fpSeg{from{width:0}}" +
      "@media (prefers-reduced-motion:reduce){[class^=fp-an]{animation:none!important}}";
    document.head.appendChild(st);
  }, []);

  const score = 21;
  const alloc = PROFILES[profile].alloc;

  const sectionHead = (title: string, badge: string, badgeTone: "lavender" | "mint", Icon: LucideIcon) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--lav-100)", color: "var(--lav-600)", display: "grid", placeItems: "center", flex: "none" }}><Icon size={18} /></span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>{title}</h2>
      </div>
      <Badge tone={badgeTone}>{badge}</Badge>
    </div>
  );

  const problems: { tone: "peach" | "lav"; title: string; sub: string; plan: string[]; cta: string }[] = [
    { tone: "peach", title: "ציון בריאות פיננסי נמוך", sub: "הציון שלך הוא 21/100 — מצביע על פערים בתכנון.", plan: ["השלמת פרופיל הסיכון", "הזנת הוצאות חודשיות", "בדיקת זכויות מס שלא נוצלו"], cta: "התחל תוכנית תיקון" },
    { tone: "lav", title: "לא הוגדר פרופיל סיכון", sub: "ללא פרופיל סיכון אי אפשר להתאים לך מסלול השקעות.", plan: ["מענה על 3 שאלות קצרות", "קבלת הקצאת נכסים מומלצת", "התאמת תחזית הצבירה"], cta: "הגדר פרופיל סיכון" },
    { tone: "lav", title: "לא הוזנו הוצאות חודשיות", sub: "בלי נתוני הוצאות אי אפשר לחשב תקציב ותזרים מדויקים.", plan: ["הזנת הוצאות קבועות", "הזנת הוצאות משתנות", "קבלת ניתוח 50/30/20"], cta: "הזן הוצאות" },
  ];
  const pTone: Record<string, [string, string, string]> = { peach: ["var(--peach-soft)", "var(--peach-ink)", "rgba(218,111,68,.28)"], lav: ["var(--lav-100)", "var(--lav-600)", "var(--border-soft)"] };

  const recs: { title: string; body: string; tone: keyof typeof rTone }[] = [
    { title: "הגדלת החשיפה למניות לטווח ארוך", body: "אם שיעור ההפקדה נמוך מ‑7%, כל אחוז נוסף מוסיף משמעותית לצבירה העתידית.", tone: "peach" },
    { title: "פתיחת קרן השתלמות", body: "אחד מכלי החיסכון הטובים בישראל — פטור ממס רווחי הון אחרי 6 שנים.", tone: "lav" },
    { title: "קרן מחקה S&P 500", body: "חשיפה לשוק האמריקאי בעלות נמוכה (דמי ניהול 0.1%–0.3%). מתאים לטווח ארוך.", tone: "butter" },
    { title: "קרן נדל״ן (REIT) גלובלית", body: "חשיפה לנדל״ן ללא רכישה ישירה — תשואת דיבידנד ממוצעת 3%–5%.", tone: "mint" },
  ];
  const rTone = { peach: "var(--peach-ink)", lav: "var(--lav-600)", butter: "var(--butter-ink)", mint: "var(--mint-ink)" };
  const projection: [string, string, number][] = [["20 שנים", "₪609,104", 100], ["10 שנים", "₪195,723", 42], ["5 שנים", "₪79,780", 20]];

  const budgetSeg = [
    { label: "חיסכון", pct: 100, color: "var(--mint-ink)" },
    { label: "הוצאות קבועות", pct: 0, color: "var(--lav-600)" },
    { label: "הוצאות משתנות", pct: 0, color: "var(--peach-ink)" },
  ];

  const RISK: { key: ProfileKey; Icon: LucideIcon; sub: string }[] = [
    { key: "שמרני", Icon: Shield, sub: "הגנה על הקרן, סיכון נמוך" },
    { key: "מאוזן", Icon: Scale, sub: "איזון בין צמיחה ליציבות" },
    { key: "אנרגטי", Icon: TrendingUp, sub: "מיקוד בצמיחה לטווח ארוך" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-page)", color: "var(--text-body)", fontFamily: "var(--font-body)", direction: "rtl" }}>
      <PrivateTopbar />
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 24px 84px" }}>
        {/* header */}
        <div className="fp-an" style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap", marginBottom: 18, animation: "fpIn .55s var(--ease) both" }}>
          <div style={{ position: "relative", width: 92, height: 92, flex: "none" }}>
            <FPRing value={score} size={92} sw={8} color="var(--peach-ink)" />
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-.04em", lineHeight: 1, color: "var(--ink)" }}>{score}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", marginTop: 2 }}>ציון פיננסי</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1 style={{ margin: 0, fontSize: "clamp(26px,3.2vw,38px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.05, color: "var(--text-strong)" }}>מרכז תכנון פיננסי</h1>
            <p style={{ margin: "8px 0 0", fontSize: 15.5, color: "var(--text-muted)", lineHeight: 1.55, maxWidth: 540, fontWeight: 500 }}>
              כאן הכל לראות את התמונה הפיננסית המלאה שלך — תקציב, חיסכון, השקעות ויעדים. ככל שתזין יותר נתונים, התובנות יהפכו מדויקות יותר.
            </p>
          </div>
        </div>

        {/* score banner */}
        <div className="fp-an" style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 18px", borderRadius: "var(--radius)", background: "var(--grad-prism)", border: "1px solid var(--border-soft)", marginBottom: 24, animation: "fpIn .55s .05s var(--ease) both" }}>
          <span style={{ color: "var(--lav-600)", flex: "none", marginTop: 1 }}><Sparkles size={17} /></span>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.55, fontWeight: 500 }}>
            <b style={{ fontWeight: 800 }}>ציון {score}/100</b> — הציון מורכב מניצול זכויות מס, יעילות פנסיה, כיסוי ביטוחי ותכנון תקציב. עדיין חסרים נתונים — השלמתם תעלה את הציון ותדייק את ההמלצות.
          </p>
        </div>

        {/* cash-flow stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
          {([
            { l: "תזרים חודשי", v: "₪3,666.51", sub: "אחרי הוצאות", c: "var(--mint-ink)", trend: true },
            { l: "נטו", v: "₪3,666.51", sub: "להפקדה בפועל", c: "var(--ink)", trend: false },
            { l: "ברוטו", v: "₪4,072.05", sub: "סך הכנסות", c: "var(--ink)", trend: false },
          ] as const).map((s, i) => (
            <div key={s.l} className="fp-an" style={{ ...card, padding: "18px 20px", animation: `fpIn .5s ${0.1 + i * 0.05}s var(--ease) both` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 700 }}>{s.l}</span>
                <span style={{ color: s.trend ? "var(--mint-ink)" : "var(--text-faint)", display: "inline-flex" }}>{s.trend ? <TrendingUp size={15} /> : <BarChart3 size={15} />}</span>
              </div>
              <div style={{ fontSize: 27, fontWeight: 900, letterSpacing: "-.03em", color: s.c, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", fontWeight: 600, marginTop: 6 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* AI problems */}
        <div className="fp-an" style={{ ...card, padding: "22px 24px", marginBottom: 22, animation: "fpIn .5s .2s var(--ease) both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: "var(--peach-soft)", color: "var(--peach-ink)", display: "grid", placeItems: "center" }}><AlertTriangle size={18} /></span>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "-.02em", color: "var(--text-strong)" }}>בעיות פיננסיות ותוכנית תיקון</h2>
            </div>
            <span style={{ fontSize: 11, fontWeight: 900, color: "var(--lav-600)", background: "var(--lav-100)", border: "1px solid var(--border-soft)", borderRadius: 999, padding: "4px 11px" }}>AI</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-muted)", fontWeight: 600, margin: "0 2px 14px" }}>
            <span style={{ color: "var(--lav-600)", display: "inline-flex" }}><Sparkles size={13} /></span>
            זוהו <b style={{ color: "var(--ink)" }}>3 בעיות</b> — לחץ על כל אחת לתוכנית תיקון
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {problems.map((p, i) => {
              const [bg, fg, bd] = pTone[p.tone];
              const open = openP === i;
              return (
                <div key={i} style={{ border: `1px solid ${bd}`, borderRadius: "var(--r-md)", background: bg, overflow: "hidden" }}>
                  <button onClick={() => setOpenP(open ? null : i)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", background: "none", border: "none", cursor: "pointer", textAlign: "start", fontFamily: "inherit" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, flex: "none", background: "var(--card)", color: fg, display: "grid", placeItems: "center" }}>{p.tone === "peach" ? <AlertTriangle size={16} /> : <Sparkles size={16} />}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--ink)" }}>{p.title}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, lineHeight: 1.45 }}>{p.sub}</div>
                    </div>
                    <span style={{ color: fg, flex: "none", transform: open ? "rotate(90deg)" : "none", transition: "transform .25s var(--ease)" }}><ArrowLeft size={16} /></span>
                  </button>
                  {open && (
                    <div style={{ padding: "0 56px 15px 15px", animation: "fpIn .3s var(--ease) both" }}>
                      <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--r-sm)", padding: "13px 15px" }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-faint)", letterSpacing: ".05em", marginBottom: 9 }}>תוכנית תיקון</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                          {p.plan.map((step, j) => (
                            <div key={j} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "var(--text-body)", fontWeight: 500 }}>
                              <span style={{ width: 19, height: 19, borderRadius: "50%", flex: "none", background: bg, color: fg, display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 900 }}>{j + 1}</span>
                              {step}
                            </div>
                          ))}
                        </div>
                        <Btn variant="primary" size="sm">{p.cta}</Btn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* investments + budget */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
          {/* LEFT — investments & forecast */}
          <div className="fp-an" style={{ ...card, padding: "22px 24px", animation: "fpIn .5s .25s var(--ease) both" }}>
            {sectionHead("השקעות ותחזיות", "תחזית", "lavender", BarChart3)}
            <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--lav-50)", border: "1px solid var(--border-soft)", marginBottom: 16 }}>
              <span style={{ color: "var(--lav-600)", flex: "none", marginTop: 1 }}><Sparkles size={15} /></span>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5, fontWeight: 500 }}>על בסיס פרופיל הסיכון וההפקדה החודשית, המערכת ממליצה על <b style={{ fontWeight: 800 }}>מסלול השקעות {profile}</b> ומחשבת כיצד הכסף יצמח לאורך שנים בריבית דריבית.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 5 }}>פרופיל</div>
                <div style={{ display: "flex", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", borderRadius: 999, padding: 3 }}>
                  {(Object.keys(PROFILES) as ProfileKey[]).map(k => (
                    <button key={k} onClick={() => setProfile(k)} title={k} style={{ flex: 1, padding: "6px 2px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 800, background: profile === k ? "var(--card)" : "transparent", color: profile === k ? "var(--lav-600)" : "var(--text-muted)", boxShadow: profile === k ? "var(--shadow-soft)" : "none", transition: "all .18s" }}>{k}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 5 }}>תשואה צפויה</div>
                <div style={{ padding: "8px 12px", borderRadius: "var(--r-sm)", background: "var(--mint-soft)", border: "1px solid var(--mint)", fontSize: 14.5, fontWeight: 900, color: "var(--mint-ink)", textAlign: "center" }}>{PROFILES[profile].ret}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 5 }}>הפקדה חודשית</div>
                <div style={{ padding: "8px 12px", borderRadius: "var(--r-sm)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", fontSize: 14.5, fontWeight: 900, color: "var(--ink)", textAlign: "center" }}>₪1,100</div>
              </div>
            </div>
            <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", marginBottom: 9 }}>
              {alloc.map(([label, pct, color], i) => (
                <div key={label} className="fp-anseg" title={`${label} ${pct}%`} style={{ width: `${pct}%`, background: color, animation: `fpSeg .8s ${0.1 + i * 0.06}s var(--ease) both` }} />
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px", marginBottom: 20 }}>
              {alloc.map(([label, pct, color]) => (
                <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: color }} />{label} {pct}%
                </span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {recs.map(r => (
                <div key={r.title} style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: "var(--r-md)", background: "var(--surface-sunken)", border: "1px solid var(--border-hair)", borderInlineStart: `3px solid ${rTone[r.tone]}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)", marginBottom: 3 }}>{r.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{r.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "var(--text-strong)" }}>תחזית צבירה</h3>
              <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600 }}>בהפקדת ₪1,100/חודש בתשואה ממוצעת</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, alignItems: "end", height: 150 }}>
              {projection.map(([yrs, amount, h], i) => (
                <div key={yrs} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "-.02em", color: i === 0 ? "var(--lav-600)" : "var(--ink-soft)", marginBottom: 7 }}>{amount}</div>
                  <div className="fp-anbar" style={{ width: "100%", maxWidth: 78, height: `${h}%`, minHeight: 24, borderRadius: "6px 6px 0 0", background: i === 0 ? "var(--grad-brand)" : "var(--lav-200)", animation: `fpBar .9s ${0.2 + i * 0.1}s var(--ease) both` }} />
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, marginTop: 9 }}>{yrs}</div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — budget analysis */}
          <div className="fp-an" style={{ ...card, padding: "22px 24px", animation: "fpIn .5s .3s var(--ease) both" }}>
            {sectionHead("ניתוח תקציב", "תקציב", "mint", TrendingUp)}
            <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--lav-50)", border: "1px solid var(--border-soft)", marginBottom: 18 }}>
              <span style={{ color: "var(--lav-600)", flex: "none", marginTop: 1 }}><Sparkles size={15} /></span>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5, fontWeight: 500 }}>ניתוח התקציב מחושב אוטומטית מההכנסות וההוצאות. <b style={{ fontWeight: 800 }}>כלל 50/30/20</b> הוא בנצ׳מרק מקובל לחלוקה בריאה של ההכנסה.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 18 }}>
              <div style={{ position: "relative", width: 150, height: 150, flex: "none" }}>
                <FPDonut size={150} sw={22} segments={budgetSeg} />
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: "-.03em", color: "var(--ink)", lineHeight: 1 }}>₪3,666.51</div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 700, marginTop: 3 }}>חודשי</div>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
                {budgetSeg.map(s => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flex: "none" }} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--text-body)", fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 900, color: s.pct > 0 ? "var(--ink)" : "var(--text-faint)" }}>{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: "14px 16px", borderRadius: "var(--r-md)", background: "var(--butter-soft)", border: "1px solid var(--butter)", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 900, color: "var(--butter-ink)", marginBottom: 11 }}><Scale size={15} /> כלל 50/30/20</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[["צרכים", "₪1,833", "50%"], ["רצונות", "₪1,100", "30%"], ["חיסכון", "₪733", "20%"]].map(([l, v, p]) => (
                  <div key={l} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-.02em", color: "var(--ink)" }}>{v}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 700, marginTop: 2 }}>{l} · {p}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 11, padding: "13px 15px", borderRadius: "var(--r-md)", background: "var(--mint-soft)", border: "1px solid var(--mint)", marginBottom: 16 }}>
              <span style={{ color: "var(--mint-ink)", flex: "none", marginTop: 1 }}><TrendingUp size={16} /></span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)", marginBottom: 2 }}>יש לך עודף להשקעה</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>אתה חוסך יותר מ‑20% מההכנסה — שקול להפנות את העודף לצמיחה לטווח ארוך.</div>
              </div>
            </div>
            <div style={{ border: "1px solid var(--border-hair)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
              <button onClick={() => setBudgetOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 15px", background: "var(--surface-sunken)", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>
                עדכון הוצאות חודשיות
                <span style={{ color: "var(--text-muted)", transform: budgetOpen ? "rotate(90deg)" : "none", transition: "transform .25s var(--ease)" }}><ArrowLeft size={15} /></span>
              </button>
              {budgetOpen && (
                <div style={{ padding: "14px 15px", display: "flex", flexDirection: "column", gap: 12, animation: "fpIn .3s var(--ease) both" }}>
                  {[["הוצאות קבועות", "דיור, חשבונות, ביטוחים…"], ["הוצאות משתנות", "מזון, תחבורה, פנאי…"]].map(([l, ph]) => (
                    <div key={l}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 5 }}>{l}</div>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-soft)", borderRadius: "var(--r-sm)", background: "var(--card)", padding: "0 12px" }}>
                        <span style={{ color: "var(--text-faint)", fontWeight: 800, fontSize: 14 }}>₪</span>
                        <input placeholder={ph} style={{ flex: 1, border: "none", outline: "none", padding: "10px 8px", fontFamily: "inherit", fontSize: 14, color: "var(--ink)", background: "transparent" }} />
                      </div>
                    </div>
                  ))}
                  <Btn variant="primary" size="sm">עדכן תקציב</Btn>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* setup cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          <div className="fp-an" style={{ ...card, padding: "22px 24px", display: "flex", flexDirection: "column", animation: "fpIn .5s .35s var(--ease) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
              <span style={{ color: "var(--lav-600)" }}><FileText size={18} /></span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--text-strong)" }}>דוח חודשי AI</h3>
            </div>
            <div style={{ display: "grid", placeItems: "center", padding: "8px 0 18px" }}>
              <span style={{ width: 52, height: 52, borderRadius: 14, background: "var(--lav-50)", color: "var(--lav-600)", display: "grid", placeItems: "center" }}><FileText size={26} /></span>
            </div>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6, textAlign: "center", flex: 1 }}>סיכום חודשי מותאם אישית: ניתוח שכר ופנסיה, מצב מול היעדים והמלצות למימוש זכויות וחיסכון — הכל בעברית פשוטה.</p>
            <Btn variant="primary" size="sm" fullWidth>צור דוח חודשי</Btn>
          </div>

          <div className="fp-an" style={{ ...card, padding: "22px 24px", display: "flex", flexDirection: "column", animation: "fpIn .5s .4s var(--ease) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
              <span style={{ color: "var(--mint-ink)" }}><TrendingUp size={18} /></span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--text-strong)" }}>יעדים פיננסיים</h3>
            </div>
            <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: "16px 0" }}>
              <div>
                <span style={{ width: 52, height: 52, borderRadius: 14, background: "var(--surface-sunken)", color: "var(--text-faint)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Sparkles size={24} /></span>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-muted)" }}>אין יעדים עדיין</div>
                <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 4 }}>הוסף יעד ראשון כדי לעקוב אחר ההתקדמות</div>
              </div>
            </div>
            <Btn variant="secondary" size="sm" fullWidth iconLeft={<span style={{ fontWeight: 900 }}>+</span>}>הוסף יעד</Btn>
          </div>

          <div className="fp-an" style={{ ...card, padding: "22px 24px", display: "flex", flexDirection: "column", animation: "fpIn .5s .45s var(--ease) both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
              <span style={{ color: "var(--peach-ink)" }}><Shield size={18} /></span>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "var(--text-strong)" }}>פרופיל סיכון</h3>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>הפרופיל קובע איך המערכת ממליצה להשקיע. בחר את רמת הסיכון המתאימה לך.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {RISK.map(r => {
                const on = profile === r.key;
                const Icon = r.Icon;
                return (
                  <button key={r.key} onClick={() => setProfile(r.key)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: "var(--r-md)", cursor: "pointer", fontFamily: "inherit", textAlign: "start", border: `1.5px solid ${on ? "var(--lav-400)" : "var(--border-hair)"}`, background: on ? "var(--lav-50)" : "var(--card)", transition: "all .18s var(--ease)" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 9, flex: "none", background: on ? "var(--lav-100)" : "var(--surface-sunken)", color: on ? "var(--lav-600)" : "var(--text-muted)", display: "grid", placeItems: "center" }}><Icon size={17} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--ink)" }}>{r.key}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>{r.sub}</div>
                    </div>
                    <span style={{ width: 17, height: 17, borderRadius: "50%", flex: "none", border: `2px solid ${on ? "var(--lav-600)" : "var(--border-soft)"}`, display: "grid", placeItems: "center" }}>
                      {on && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--lav-600)" }} />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 9, padding: "11px 13px", borderRadius: "var(--r-sm)", background: "var(--butter-soft)", border: "1px solid var(--butter)", marginBottom: 14 }}>
              <span style={{ color: "var(--butter-ink)", flex: "none", marginTop: 1 }}><Sparkles size={14} /></span>
              <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5, fontWeight: 500 }}>פרופיל <b style={{ fontWeight: 800 }}>{profile}</b> — תשואה צפויה {PROFILES[profile].ret} בשנה.</div>
            </div>
            <Btn variant="primary" size="sm" fullWidth>שמור פרופיל</Btn>
          </div>
        </div>
      </main>
      <AppFooter variant="private" />
    </div>
  );
}
