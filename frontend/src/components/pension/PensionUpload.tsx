/**
 * PensionUpload — step 2/2 of the pension import flow: drop / pick the הר הכסף
 * report (PDF or Excel). Mirrors the insurance upload dropzone but green, with
 * a source toggle (הר הכסף / דוח תקופתי) and PDF support.
 *
 * Wired to the real backend via `onUpload` (→ uploadPensionFile). State is
 * derived from the live flow props; success is sticky until the user continues.
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, FileText, PiggyBank, Sparkles, Upload } from "lucide-react";

const G = "47,156,98";
const ACCEPT = ".pdf,.xlsx,.xls";
const CHECKLIST = [
  "הסוכן סורק ומזהה את כל הקרנות בדוח",
  "מחשב צבירה צפויה וקצבה בגיל פרישה",
  "משווה דמי ניהול מול ממוצע השוק",
  "מזהה מסלולי סיכון שאינם מתאימים לגיל",
  "מייצר המלצות מותאמות לחיסכון בפרמיות",
];

type Source = "har_hakesef" | "quarterly_report";

export default function PensionUpload({
  onBack, onContinue, onUpload, uploading, uploadMsg, uploadProgressStep, progressSteps,
  isDragging, setIsDragging, importedCount, importSource, onSourceChange,
}: {
  onBack: () => void;
  onContinue: () => void;
  onUpload: (file: File) => void;
  uploading: boolean;
  uploadMsg: { type: "success" | "error"; text: string } | null;
  uploadProgressStep: number | null;
  progressSteps: string[];
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  importedCount: number | null;
  importSource: Source;
  onSourceChange: (s: Source) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (document.getElementById("pu-anim")) return;
    const st = document.createElement("style");
    st.id = "pu-anim";
    st.textContent =
      "@keyframes puRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}" +
      "@keyframes puPop{0%{transform:scale(.5);opacity:0}60%{transform:scale(1.16)}100%{transform:scale(1);opacity:1}}" +
      "@keyframes puSpin{to{transform:rotate(360deg)}}" +
      "@keyframes puShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-4px)}40%,80%{transform:translateX(4px)}}" +
      "@keyframes puFlow{from{background-position:200% 0}to{background-position:-200% 0}}" +
      "@media (prefers-reduced-motion:reduce){.pu-spin{animation:none!important}.pu-bar{animation:none!important}}";
    document.head.appendChild(st);
  }, []);

  const isError = uploadMsg?.type === "error";
  const isSuccess = uploadMsg?.type === "success";
  const busy = uploading;
  const phase: "idle" | "drag" | "busy" | "success" | "error" =
    isError ? "error" : busy ? "busy" : isSuccess ? "success" : isDragging ? "drag" : "idle";

  const pick = () => { if (!busy) inputRef.current?.click(); };
  const handleFiles = (files: FileList | null) => { const f = files?.[0]; if (f) { setFileName(f.name); onUpload(f); } };

  const stepCount = Math.max(progressSteps.length, 1);
  const pct = uploadProgressStep != null ? Math.round(((uploadProgressStep + 1) / stepCount) * 100) : 8;
  const busyLabel = uploadProgressStep != null ? (progressSteps[uploadProgressStep] ?? "מנתח את הדוח…") : "מעלה את הקובץ…";

  const SOURCES: { id: Source; label: string; sub: string }[] = [
    { id: "har_hakesef", label: "הר הכסף", sub: "Excel / PDF מהמסלקה" },
    { id: "quarterly_report", label: "דוח תקופתי", sub: "PDF מהגוף המנהל" },
  ];

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "36px 24px 88px" }}>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13.5, color: "var(--text-muted)", marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={15} strokeWidth={2.4} style={{ transform: "scaleX(-1)" }} /> חזרה
      </button>

      {/* header */}
      <div style={{ marginBottom: 22, animation: "puRise .5s var(--ease) both" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 13px", borderRadius: 999, background: "var(--mint-soft)", border: `1px solid rgba(${G},.22)`, color: "var(--mint-ink)", fontSize: 12.5, fontWeight: 800, marginBottom: 14 }}>
          שלב 2 מתוך 2 — העלאת הדוח
        </span>
        <h1 style={{ margin: 0, fontSize: "clamp(27px,3.4vw,38px)", fontWeight: 900, letterSpacing: "-.035em", lineHeight: 1.06, color: "var(--text-strong)" }}>העלה את דוח הפנסיה שלך</h1>
        <p style={{ margin: "10px 0 0", fontSize: 15.5, color: "var(--text-muted)", fontWeight: 500, lineHeight: 1.6, maxWidth: 480 }}>
          גרור את קובץ ה‑PDF / Excel מהר הכסף לכאן, או לחץ לבחירה. הסוכן ינתח אוטומטית.
        </p>
      </div>

      {/* source toggle */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {SOURCES.map(opt => {
          const on = importSource === opt.id;
          return (
            <button key={opt.id} type="button" onClick={() => onSourceChange(opt.id)}
              style={{ flex: "1 1 180px", padding: "12px 16px", borderRadius: "var(--r-md)", textAlign: "right", cursor: "pointer", fontFamily: "inherit", border: on ? "2px solid var(--mint-ink)" : "1px solid var(--border-soft)", background: on ? "var(--mint-soft)" : "var(--card)", transition: "all .18s var(--ease)" }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-strong)" }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{opt.sub}</div>
            </button>
          );
        })}
      </div>

      {/* upload panel */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border-hair)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-card)", padding: 22, animation: "puRise .5s var(--ease) .06s both" }}>
        <div
          onClick={() => phase !== "busy" && phase !== "success" && pick()}
          onDragOver={e => { e.preventDefault(); if (phase !== "busy" && phase !== "success") setIsDragging(true); }}
          onDragLeave={e => { e.preventDefault(); setIsDragging(false); }}
          onDrop={e => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
          style={{
            position: "relative", overflow: "hidden", borderRadius: "var(--r-md)",
            border: `2px dashed ${phase === "drag" ? "var(--mint-ink)" : phase === "error" ? "rgba(214,69,69,.5)" : "var(--border-soft)"}`,
            background: phase === "drag" ? "var(--mint-soft)" : "var(--surface-sunken)",
            backgroundImage: `radial-gradient(rgba(${G},.06) 1px,transparent 1px)`, backgroundSize: "16px 16px",
            padding: "54px 28px", textAlign: "center",
            cursor: phase === "busy" || phase === "success" ? "default" : "pointer",
            transition: "border-color .25s var(--ease), background .25s var(--ease)",
          }}
        >
          <input ref={inputRef} type="file" accept={ACCEPT} style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />

          <div style={{ width: 64, height: 64, margin: "0 auto 18px", borderRadius: 16, display: "grid", placeItems: "center",
            background: phase === "success" ? "var(--mint-soft)" : phase === "error" ? "rgba(214,69,69,.1)" : "var(--card)",
            color: phase === "error" ? "#C23B3B" : "var(--mint-ink)",
            boxShadow: "var(--shadow-soft)", border: "1px solid var(--border-hair)" }}>
            {phase === "busy" ? (
              <span className="pu-spin" style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid var(--mint-soft)`, borderTopColor: "var(--mint-ink)", animation: "puSpin .8s linear infinite", display: "block" }} />
            ) : phase === "success" ? (
              <span style={{ display: "grid", placeItems: "center", animation: "puPop .4s var(--ease)" }}><Check size={34} strokeWidth={2.6} /></span>
            ) : phase === "error" ? (
              <AlertTriangle size={30} />
            ) : (
              <PiggyBank size={32} />
            )}
          </div>

          {phase === "idle" || phase === "drag" ? (
            <>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: "-.02em", marginBottom: 6, color: "var(--text-strong)" }}>גרור את הדוח לכאן</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500, marginBottom: 18 }}>או לחץ לבחירה מהמחשב</div>
              <button onClick={e => { e.stopPropagation(); pick(); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 26px", borderRadius: "var(--r-md)", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 15, color: "#fff", background: "var(--mint-ink)", boxShadow: "var(--shadow-soft)", transition: "filter .2s" }}
                onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.07)"; }}
                onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}>
                <FileText size={17} /> בחר קובץ
              </button>
              <div style={{ fontSize: 12.5, color: "var(--text-faint)", fontWeight: 600, marginTop: 16 }}>פורמטים נתמכים: PDF, .xls, .xlsx · עד 10MB</div>
            </>
          ) : phase === "busy" ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4, color: "var(--text-strong)" }}>{busyLabel}</div>
              <div style={{ fontSize: 13.5, color: "var(--text-muted)", fontWeight: 600, marginBottom: 18, direction: "ltr" }}>{fileName}</div>
              <div style={{ maxWidth: 340, margin: "0 auto", height: 8, borderRadius: 999, background: "var(--hair)", overflow: "hidden" }}>
                <div className="pu-bar" style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,var(--mint-ink),#7BE6A3,var(--mint-ink))", backgroundSize: "200% 100%", borderRadius: 999, transition: "width .5s var(--ease)", animation: "puFlow 1.4s linear infinite" }} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-faint)", fontWeight: 700, marginTop: 10 }}>כמעט שם — מזהה קרנות</div>
            </>
          ) : phase === "success" ? (
            <>
              <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: "-.02em", marginBottom: 6, color: "var(--ink)" }}>הדוח נותח בהצלחה</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>
                {importedCount != null
                  ? <>זוהו <b style={{ color: "var(--mint-ink)", fontWeight: 800 }}>{importedCount} קרנות</b>{fileName ? <> בקובץ <span style={{ direction: "ltr", unicodeBidi: "isolate" }}>{fileName}</span></> : null}</>
                  : uploadMsg?.text}
              </div>
              <button onClick={e => { e.stopPropagation(); pick(); }} style={{ marginTop: 12, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13, color: "var(--text-muted)", textDecorationLine: "underline" }}>החלף קובץ</button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-.02em", marginBottom: 6, color: "#C23B3B" }}>לא הצלחנו לקרוא את הקובץ</div>
              <div style={{ fontSize: 13.5, color: "var(--text-muted)", fontWeight: 500, marginBottom: 18, maxWidth: 360, marginInline: "auto", lineHeight: 1.5 }}>ודא שזהו הדוח המקורי שהורד מהר הכסף (PDF או Excel).</div>
              <button onClick={e => { e.stopPropagation(); pick(); }}
                style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "12px 24px", borderRadius: "var(--r-md)", border: "1px solid var(--border-soft)", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 14.5, color: "var(--ink)", background: "var(--card)" }}>
                <Upload size={16} /> נסה קובץ אחר
              </button>
            </>
          )}
        </div>

        {phase === "error" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14, padding: "13px 16px", borderRadius: "var(--r-sm)", background: "rgba(214,69,69,.07)", border: "1px solid rgba(214,69,69,.22)", animation: "puShake .4s var(--ease)" }}>
            <span style={{ color: "#C23B3B", flex: "none", display: "inline-flex" }}><AlertTriangle size={17} /></span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#A93232" }}>{uploadMsg?.text ?? "לא הצלחנו לפרסר את הקובץ. ודא שזהו דוח הר הכסף תקין."}</span>
          </div>
        )}

        {phase === "success" && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, animation: "puRise .4s var(--ease)" }}>
            <button onClick={onContinue}
              style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "14px 26px", borderRadius: "var(--r-md)", border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 800, fontSize: 15.5, color: "#fff", background: "var(--ink)", boxShadow: "var(--shadow-ink)", transition: "transform .25s var(--ease)" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
              <ArrowLeft size={17} style={{ transform: "scaleX(-1)" }} /> צפה בניתוח הפנסיה
            </button>
          </div>
        )}
      </div>

      {/* what happens next */}
      <div style={{ marginTop: 22, padding: "22px 24px", borderRadius: "var(--radius)", background: "var(--mint-soft)", border: `1px solid rgba(${G},.18)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800, color: "var(--mint-ink)", marginBottom: 16 }}>
          <Sparkles size={16} /> מה קורה לאחר ההעלאה?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {CHECKLIST.map(c => (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", flex: "none", background: "var(--card)", color: "var(--mint-ink)", display: "grid", placeItems: "center", boxShadow: "var(--shadow-soft)" }}><Check size={13} strokeWidth={2.8} /></span>
              <span style={{ fontSize: 14.5, color: "var(--text-body)", fontWeight: 600 }}>{c}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
