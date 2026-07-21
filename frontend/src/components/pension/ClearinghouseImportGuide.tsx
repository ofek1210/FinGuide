/**
 * ClearinghouseImportGuide — how to order the paid pension clearinghouse Excel report.
 * Zigzag stepper copied from InsuranceImportGuide; opens swiftness.co.il on step 1.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft, Check, Clock, CreditCard, Download, FileSpreadsheet, Globe,
  KeyRound, Lightbulb, Upload, type LucideIcon,
} from "lucide-react";

type GuideStep = { icon: LucideIcon; title: string; body: string; action?: string; doneLabel?: string };

const STEPS: GuideStep[] = [
  {
    icon: Globe,
    title: "כנסו לאתר המסלקה הפנסיונית הרשמי",
    body: "לחצו על הכפתור למטה — ייפתח אתר סוויפטנס (משרד האוצר) בלשונית חדשה.",
    action: "פתחו את המסלקה",
    doneLabel: "ביקרת באתר",
  },
  {
    icon: KeyRound,
    title: "התחברות והזדהות",
    body: "היכנסו עם תעודת הזהות שלכם. לאחר ההזדהות תוכלו להזמין דוח מרוכז מכל הגופים.",
  },
  {
    icon: CreditCard,
    title: "הזמינו דוח מכל הגופים (~15 ₪)",
    body: "בחרו «בקשת חוסך למידע פנסיוני מכל הגופים». העלות כ-14–15 ₪ (חד‑פעמי). לאחר התשלום הבקשה נשלחת לכל הגופים.",
  },
  {
    icon: Clock,
    title: "המתינו עד 24 שעות",
    body: "הדוח לא מגיע מיד — לרוב תוך מספר שעות ועד 24 שעות. בינתיים אפשר להשתמש בסוכן התלושים ובסוכן הביטוח.",
  },
  {
    icon: FileSpreadsheet,
    title: "הורידו את קובץ ה‑Excel",
    body: "כשהדוח מוכן — הורידו את קובץ Excel (3 גיליונות: מוצרים, הפקדות, כיסויים ביטוחיים) ושמרו במחשב.",
  },
  {
    icon: Download,
    title: "חזרו לכאן והעלו את הקובץ",
    body: "לאחר שהורדתם — לחצו על המשך ועלו את ה‑Excel. דוח אחד מזין את סוכן הפנסיה, סוכן הגמל וכיסויים פנסיוניים בסוכן הביטוח.",
  },
];

type Anchor = { cx: number; top: number; bottom: number } | null;

export default function ClearinghouseImportGuide({
  onBack,
  onContinue,
  onVisitSite,
  compact = false,
}: {
  onBack?: () => void;
  onContinue: () => void;
  onVisitSite: () => void;
  compact?: boolean;
}) {
  useEffect(() => {
    if (document.getElementById("ch-guide-anim")) return;
    const st = document.createElement("style");
    st.id = "ch-guide-anim";
    st.textContent =
      "@keyframes gdRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
      "@keyframes gdPop{0%{transform:scale(.5);opacity:0}60%{transform:scale(1.18)}100%{transform:scale(1);opacity:1}}" +
      "@keyframes gdComet{from{stroke-dashoffset:440}to{stroke-dashoffset:0}}" +
      "@keyframes gdBtnPulse{0%{box-shadow:var(--shadow-card)}50%{box-shadow:0 8px 28px rgba(124,95,214,.35)}100%{box-shadow:var(--shadow-card)}}" +
      "@media (prefers-reduced-motion:reduce){.gd-comet{animation:none!important;opacity:0!important}}";
    document.head.appendChild(st);
  }, []);

  const total = STEPS.length;
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const completed = done.size;
  const allDone = completed === total;
  const nextIdx = STEPS.findIndex((_, i) => !done.has(i));

  const toggle = (i: number) =>
    setDone(prev => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const handleVisit = () => {
    if (!done.has(0)) onVisitSite();
    toggle(0);
  };

  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [geo, setGeo] = useState<{ w: number; h: number; anchors: Anchor[] }>({ w: 0, h: 0, anchors: [] });
  useLayoutEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wr = wrap.getBoundingClientRect();
      const anchors: Anchor[] = cardRefs.current.map(el => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { cx: r.left + r.width / 2 - wr.left, top: r.top - wr.top, bottom: r.bottom - wr.top };
      });
      setGeo({ w: wr.width, h: wr.height, anchors });
    };
    measure();
    const t = setTimeout(measure, 80);
    window.addEventListener("resize", measure);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); };
  }, [done]);

  const connectorPath = (i: number): string | null => {
    const a = geo.anchors;
    const cur = a[i];
    if (!cur) return null;
    const prev = i === 0 ? { cx: geo.w / 2, bottom: 0 } : a[i - 1];
    if (!prev) return null;
    const mid = (prev.bottom + cur.top) / 2;
    return `M${prev.cx} ${prev.bottom} C ${prev.cx} ${mid} ${cur.cx} ${mid} ${cur.cx} ${cur.top}`;
  };

  const R = 21;
  const CIRC = 2 * Math.PI * R;
  const pad = compact ? "24px 20px 48px" : "36px 24px 88px";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: pad }}>
      {onBack && (
        <button type="button" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, color: "var(--text-muted)", marginBottom: 16, padding: 0 }}>
          <ArrowLeft size={15} strokeWidth={2.4} style={{ transform: "scaleX(-1)" }} />
          חזרה
        </button>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 30, animation: "gdRise .5s var(--ease) both" }}>
        <div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 13px", borderRadius: 999, background: "var(--lav-100)", border: "1px solid rgba(124,95,214,.22)", color: "var(--lav-600)", fontSize: 12.5, fontWeight: 800, marginBottom: 14 }}>
            הכנת דוח המסלקה (~15 ₪)
          </span>
          <h2 style={{ margin: 0, fontSize: compact ? "clamp(22px,2.8vw,30px)" : "clamp(27px,3.4vw,38px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.06, color: "var(--text-strong)" }}>
            כיצד להזמין את דוח המסלקה הפנסיונית?
          </h2>
          <p style={{ margin: "10px 0 0", fontSize: 15, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.6, maxWidth: 480 }}>
            <b style={{ color: "var(--ink)", fontWeight: 800 }}>המסלקה הפנסיונית</b> מרכזת את כל החסכונות, הגמל והכיסויים הביטוחיים שלך ממקור אחד. עקבו אחרי השלבים:
          </p>
        </div>
        <div style={{ position: "relative", flex: "none", width: 64, height: 64, marginTop: 4 }}>
          <svg width="64" height="64" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={R} fill="none" stroke="var(--hair)" strokeWidth="5" />
            <circle cx="28" cy="28" r={R} fill="none" stroke="var(--lav-600)" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - completed / total)} transform="rotate(-90 28 28)"
              style={{ transition: "stroke-dashoffset .6s var(--ease)" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 900, color: "var(--ink)", letterSpacing: "-.02em", whiteSpace: "nowrap", direction: "ltr" }}>{completed}/{total}</div>
        </div>
      </div>

      <div ref={wrapRef} style={{ position: "relative" }}>
        {geo.w > 0 && (
          <svg viewBox={`0 0 ${geo.w} ${geo.h}`} width={geo.w} height={geo.h} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "visible" }}>
            {STEPS.map((_, i) => {
              const d = connectorPath(i);
              if (!d) return null;
              const isFilled = done.has(i);
              const isActive = i === nextIdx;
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke="var(--hair)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 8" />
                  {isFilled && <path d={d} fill="none" stroke="var(--lav-600)" strokeWidth="2.8" strokeLinecap="round" style={{ transition: "opacity .4s" }} />}
                  {isActive && !allDone && (
                    <path className="gd-comet" d={d} fill="none" stroke="var(--lav-500)" strokeWidth="3.4" strokeLinecap="round"
                      pathLength={440} strokeDasharray="34 440" style={{ animation: "gdComet 1.9s linear infinite", filter: "drop-shadow(0 0 5px rgba(124,95,214,.45))" }} />
                  )}
                </g>
              );
            })}
          </svg>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 36 : 50, position: "relative", zIndex: 1 }}>
          {STEPS.map((s, i) => {
            const isDone = done.has(i);
            const isNext = i === nextIdx && !allDone;
            const isUpcoming = !isDone && !isNext;
            const right = i % 2 === 0;
            const Icon = s.icon;
            return (
              <div
                key={i}
                ref={el => { cardRefs.current[i] = el; }}
                style={{
                  width: "80%", alignSelf: right ? "flex-start" : "flex-end", textAlign: "right",
                  borderRadius: "var(--radius)", padding: "20px 22px",
                  animation: `gdRise .5s var(--ease) ${0.08 + i * 0.07}s both`,
                  transition: "border-color .35s var(--ease), background .4s var(--ease), opacity .45s var(--ease), transform .45s var(--ease), box-shadow .4s var(--ease)",
                  background: isDone ? "var(--card)" : "rgba(255,255,255,0.55)",
                  WebkitBackdropFilter: isDone ? "none" : "blur(14px) saturate(150%)",
                  backdropFilter: isDone ? "none" : "blur(14px) saturate(150%)",
                  border: `1px solid ${isNext ? "rgba(124,95,214,.4)" : isDone ? "var(--border-hair)" : "rgba(255,255,255,.55)"}`,
                  boxShadow: isDone ? "var(--shadow-soft)" : isUpcoming ? "0 4px 18px rgba(40,38,52,.05)" : "0 8px 30px rgba(40,38,52,.08), inset 0 1px 0 rgba(255,255,255,.6)",
                  opacity: isDone ? 0.72 : isUpcoming ? 0.4 : 1,
                  transform: isUpcoming ? "scale(.97)" : "scale(1)",
                  filter: isUpcoming ? "saturate(.7)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8, flexDirection: "row", justifyContent: "flex-start" }}>
                  <span style={{ flex: "none", width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", fontFamily: "var(--font-body)", fontWeight: 900, fontSize: 14,
                    background: isDone ? "var(--lav-600)" : isNext ? "var(--lav-100)" : "var(--surface-sunken)",
                    color: isDone ? "#fff" : isNext ? "var(--lav-600)" : "var(--text-muted)",
                    border: isNext ? "1px solid rgba(124,95,214,.3)" : "none", transition: "all .3s var(--ease)" }}>
                    {isDone ? <span style={{ display: "grid", placeItems: "center", animation: "gdPop .35s var(--ease)" }}><Check size={17} strokeWidth={2.8} /></span> : i + 1}
                  </span>
                  <span style={{ color: isDone ? "var(--lav-600)" : "var(--lav-500)", display: "inline-flex", transition: "color .3s" }}><Icon size={19} /></span>
                  <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, letterSpacing: "-.01em", color: "var(--text-strong)", textDecorationLine: isDone ? "line-through" : "none", textDecorationColor: "var(--text-faint)" }}>{s.title}</h3>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.55 }}>{s.body}</p>
                {s.action ? (
                  <button type="button" onClick={handleVisit} style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: "var(--r-sm)", border: `1px solid ${isDone ? "var(--lav-600)" : "var(--border-soft)"}`, background: isDone ? "var(--lav-100)" : "var(--card)", color: isDone ? "var(--lav-600)" : "var(--ink)", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 13.5, cursor: "pointer", transition: "all .2s var(--ease)" }}>
                    {isDone ? <Check size={15} strokeWidth={2.6} /> : <Globe size={15} />}
                    {isDone ? s.doneLabel : s.action}
                  </button>
                ) : (
                  <button type="button" onClick={() => toggle(i)} style={{ marginTop: 13, display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13, color: isDone ? "var(--lav-600)" : "var(--text-muted)", transition: "color .2s" }}>
                    <span style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${isDone ? "var(--lav-600)" : "var(--border-soft)"}`, background: isDone ? "var(--lav-600)" : "transparent", color: "#fff", display: "grid", placeItems: "center", transition: "all .2s" }}>{isDone ? <Check size={11} strokeWidth={3} /> : null}</span>
                    {isDone ? "בוצע" : "סמן כבוצע"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 13, marginTop: 26, padding: "16px 18px", borderRadius: "var(--radius)", background: "var(--butter-soft)", border: "1px solid rgba(185,139,22,.2)" }}>
        <span style={{ color: "var(--butter-ink)", flex: "none", marginTop: 1, display: "inline-flex" }}><Lightbulb size={19} /></span>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.55 }}>
          <b style={{ fontWeight: 800 }}>הדוח לא מגיע מיד?</b> הגופים מעדכנים את המסלקה — לעיתים תוך שעות, ולפעמים עד 24 שעות. בינתיים אפשר להמשיך עם סוכן התלושים וסוכן הביטוח.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
        <button
          type="button"
          onClick={onContinue}
          style={{ position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 28px", borderRadius: "var(--r-md)", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 15.5, color: "#fff",
            background: allDone ? "var(--lav-600)" : "var(--ink)",
            boxShadow: "var(--shadow-card)",
            transition: "background .4s var(--ease)",
            animation: allDone ? "gdBtnPulse 2.4s ease-in-out infinite" : "none" }}
        >
          <span style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: `${(completed / total) * 100}%`, background: "rgba(255,255,255,.14)", transition: "width .55s var(--ease)", pointerEvents: "none" }} />
          <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 9 }}>
            {allDone ? <Check size={18} strokeWidth={2.8} /> : <Upload size={17} />}
            {allDone ? "הכל מוכן — המשך להעלאה" : "הדוח מוכן — המשך להעלאה"}
          </span>
        </button>
      </div>
    </div>
  );
}
