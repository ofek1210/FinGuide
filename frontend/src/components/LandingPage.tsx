import { useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";
import { useLandingAnimations } from "./landing/useLandingAnimations";
import PublicFooter from "./landing/PublicFooter";
import "./landing/landing.css";

/**
 * FinGuide marketing landing page.
 * Implemented from the "FinGuide Design System" project on Claude Design
 * (landing/Landing.html + landing.css + hero-anim.js). All styles are
 * scoped under `.fg-landing`; interactions live in useLandingAnimations.
 */
export default function LandingPage() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  useLandingAnimations(rootRef);

  const toRegister = () => navigate(APP_ROUTES.register);
  const toLogin = () => navigate(APP_ROUTES.login);

  return (
    <div className="fg-landing" dir="rtl" ref={rootRef}>
      <div className="bg">
        <div className="blob lav" />
        <div className="blob mint" />
        <div className="blob peach" />
      </div>
      <div className="grain" />

      {/* ============ NAV ============ */}
      <nav>
        <div className="wrap">
          <div className="nav-inner">
            <div className="brand">
              <span className="dot">F</span>
              <b>
                Fin<span>Guide</span>
              </b>
            </div>
            <div className="nav-links">
              <a href="#products">
                המוצרים שלנו{" "}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </a>
              <a href="#how">איך זה עובד</a>
              <a href="#problem">למי זה מתאים</a>
              <a href="#faq">שאלות נפוצות</a>
            </div>
            <div className="nav-right">
              <button className="nav-ghost" onClick={toLogin}>
                התחברות
              </button>
              <button className="btn-mini" onClick={toRegister}>
                בדיקה חינם
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <div className="wrap">
        <section className="hero">
          <div className="copy">
            <div className="eyebrow" data-rise>
              <i /> מבוסס AI · בדיקה חינם
            </div>
            <h1>
              <span className="h1-line">
                <span>כל שקל</span>
              </span>
              <span className="h1-line">
                <span>שמגיע לך.</span>
              </span>
              <span className="h1-line">
                <span className="grad">בלי בירוקרטיה.</span>
              </span>
            </h1>
            <p className="lede" data-rise>
              FinGuide קורא את התלוש, הפנסיה והזכויות שלך עם AI — ומראה לך בדיוק איפה אתה משלם יותר מדי ומה
              מגיע לך בחזרה.
            </p>
            <div className="cta-row" data-rise>
              <button className="btn-primary" onClick={toRegister}>
                תראו לי מה מגיע לי
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M19 12H5M11 6l-6 6 6 6" />
                </svg>
              </button>
              <a className="btn-ghost" href="#how">
                <span className="play">
                  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                איך זה עובד
              </a>
            </div>
            <div className="trust" data-rise>
              <span>חינם לבדיקה ראשונה</span>
              <span className="sep" />
              <span>ללא התחייבות</span>
              <span className="sep" />
              <span>סטנדרט אבטחה בנקאי</span>
            </div>
          </div>

          {/* ===== ANIMATION STAGE ===== */}
          <div className="stage">
            <div className="stage-dots" />
            <div className="ring r1" />
            <div className="ring r2" />
            <div className="ring r3" />

            <div className="spk a">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z" />
              </svg>
            </div>
            <div className="spk b">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z" />
              </svg>
            </div>

            {/* central document */}
            <div className="doc">
              <div className="doc-head">
                <span className="doc-mark">F</span>
                <span className="meta">תלוש · יוני 2026</span>
              </div>
              <div className="doc-body">
                <div className="doc-row w70" />
                <div className="doc-row w90" />
                <div className="doc-row w50" />
                <div className="doc-row w80" />
                <div className="doc-amt">
                  שכר ברוטו<b>20,750 ₪</b>
                </div>
              </div>
              <div className="scanline" />
            </div>

            {/* result */}
            <div className="result">
              <div className="k">תוספת חיסכון שנתית</div>
              <div className="v">
                + <b>0</b> ₪
              </div>
            </div>

            {/* process cards */}
            <div className="pcard pc-scan">
              <div className="pc-head">
                <span className="pc-dot" />
                <span className="pc-title">סורק תלוש</span>
                <span className="pc-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
              </div>
              <div className="line l" />
              <div className="line m" />
              <div className="line s" />
            </div>

            <div className="pcard pc-fees">
              <div className="pc-head">
                <span className="pc-dot" />
                <span className="pc-title">דמי ניהול גבוהים</span>
                <span className="pc-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
              </div>
              <div className="fee">
                <span className="v">‎−1.9%</span>
                <span className="down">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </svg>
                </span>
              </div>
            </div>

            <div className="pcard pc-match">
              <div className="pc-head">
                <span className="pc-dot" />
                <span className="pc-title">מתאים זכויות</span>
                <span className="pc-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
              </div>
              <div className="pbar">
                <i />
              </div>
              <div className="line m" />
              <div className="line l" />
            </div>

            <div className="pcard pc-fetch">
              <div className="pc-head">
                <span className="pc-dot" />
                <span className="pc-title">מאחזר נתוני פנסיה</span>
                <span className="pc-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
              </div>
              <div className="mailrow">
                <span className="ic" />
                <b>קופת גמל</b>
              </div>
              <div className="mailrow">
                <span className="ic" />
                קרן השתלמות
              </div>
              <div className="mailrow">
                <span className="ic" />
                פנסיה מקיפה
              </div>
            </div>

            <div className="pcard pc-route">
              <span className="av" />
              <span className="rt">נשלח לאישור</span>
              <span className="ok">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* ============ STATS ============ */}
      <div className="wrap">
        <section className="stats">
          <div className="stat rv">
            <div className="n" data-to="12400" data-prefix="₪">
              ₪0
            </div>
            <div className="l">חיסכון שנתי ממוצע</div>
          </div>
          <div className="stat rv d1">
            <div className="n" data-to="48000" data-suffix="+">
              0+
            </div>
            <div className="l">משתמשים פעילים</div>
          </div>
          <div className="stat rv d2">
            <div className="n" data-to="4210" data-prefix="₪">
              ₪0
            </div>
            <div className="l">החזר מס ממוצע</div>
          </div>
          <div className="stat rv d3">
            <div className="n" data-to="3" data-suffix=" דק'">
              0
            </div>
            <div className="l">לבדיקה מלאה</div>
          </div>
        </section>
      </div>

      {/* ============ PROBLEM ============ */}
      <div className="wrap">
        <section className="sec" id="problem">
          <div className="problem">
            <div className="prob-card rv">
              <div className="prob-persona">
                <div className="nm">עומר, 37 · חיפה</div>
                <div className="dsc">בדיקה אמיתית עם FinGuide AI</div>
                <div className="brow">
                  <span className="lbl">שכר חודשי</span>
                  <span className="v">20,750 ₪</span>
                </div>
                <div className="brow hl">
                  <span className="lbl">תוספת חיסכון לגיל פרישה</span>
                  <span className="v">+ 1,044,546 ₪</span>
                </div>
                <div className="brow">
                  <span className="lbl">החזר מס שלא נוצל</span>
                  <span className="v up">+ 4,210 ₪</span>
                </div>
                <div className="brow">
                  <span className="lbl">הפחתת דמי ניהול</span>
                  <span className="v up">1.9% ← 0.5%</span>
                </div>
              </div>
            </div>
            <div className="rv d1">
              <span className="kicker">העובדות</span>
              <h2>רוב האנשים מגלים את הטעות מאוחר מדי.</h2>
              <ul className="prob-list">
                <li>
                  <span className="num">95%</span>
                  <span>
                    <b>מבני 20–40</b> לא נמצאים ברמת הסיכון הנכונה בפנסיה — והכסף לא עובד בשבילם כמו שיכול.
                  </span>
                </li>
                <li>
                  <span className="num">50%</span>
                  <span>
                    <b>מעל מחצית</b> משלמים דמי ניהול גבוהים מהממוצע, בלי לדעת.
                  </span>
                </li>
                <li>
                  <span className="num">₪</span>
                  <span>
                    <b>החזרי מס</b> בשווי אלפי שקלים נשארים לא ממומשים מדי שנה.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* ============ HOW IT WORKS ============ */}
      <div className="wrap">
        <section className="sec" id="how">
          <div className="shead rv">
            <span className="kicker">איך זה עובד</span>
            <h2>שלושה צעדים. חמש דקות.</h2>
            <p>בלי טפסים אינסופיים ובלי ייעוץ יקר — רק העלאת מסמך, וה‑AI עושה את השאר.</p>
          </div>
          <div className="steps">
            <div className="step rv">
              <span className="sn">01</span>
              <div className="si" style={{ background: "var(--lav-100)", color: "var(--lav-600)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 16V4M8 8l4-4 4 4" />
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </div>
              <h3>מעלים מסמך</h3>
              <p>תלוש שכר, דוח פנסיה או טופס 106 — צילום מהטלפון מספיק. הנתונים מוצפנים מקצה לקצה.</p>
            </div>
            <div className="step rv d1">
              <span className="sn">02</span>
              <div className="si" style={{ background: "var(--mint-soft)", color: "var(--mint-ink)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </div>
              <h3>ה‑AI מנתח</h3>
              <p>אלפי כללי מס, רגולציה ודמי ניהול נסרקים בשניות, ומשווים את המצב שלך למה שאפשר.</p>
            </div>
            <div className="step rv d2">
              <span className="sn">03</span>
              <div className="si" style={{ background: "var(--peach-soft)", color: "var(--peach-ink)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h4l3 8 4-16 3 8h4" />
                </svg>
              </div>
              <h3>מקבלים תוכנית</h3>
              <p>רשימת פעולות ברורה: כמה מגיע לך בחזרה, איפה לחסוך, ומה לעשות — צעד אחר צעד.</p>
            </div>
          </div>
        </section>
      </div>

      {/* ============ PRODUCTS ============ */}
      <div className="wrap">
        <section className="sec" id="products">
          <div className="shead rv">
            <span className="kicker">מנוע הניתוח</span>
            <h2>כל בדיקה. כבר נעשתה.</h2>
            <p>ה‑AI מנתח את התלוש, הפנסיה והזכויות שלך לפני שבכלל שאלת — ומראה לך בדיוק מה לעשות.</p>
          </div>
          <div className="showcase">
            {/* 1 · payslip */}
            <div className="sc-item rv">
              <div className="sc-card">
                <div className="sc-ui">
                  <div className="ui-head">
                    <span className="ui-mark">F</span>
                    <span className="ui-meta">תלוש · יוני 2026</span>
                    <span className="ui-tag">נותח ✓</span>
                  </div>
                  <div className="ui-row">
                    <span>שכר ברוטו</span>
                    <b>20,750 ₪</b>
                  </div>
                  <div className="ui-row">
                    <span>מס הכנסה</span>
                    <b>2,820 ₪</b>
                  </div>
                  <div className="ui-row">
                    <span>נטו לתשלום</span>
                    <b>15,460 ₪</b>
                  </div>
                  <div className="ui-hl">
                    <span>החזר מס זוהה</span>
                    <b>+ 4,210 ₪</b>
                  </div>
                </div>
              </div>
              <h3>כל תלוש, מפוענח בשניות.</h3>
              <p>ניתוח OCR חכם מזהה ניכויים שגויים, חריגות שכר והחזרי מס שמגיעים לך — אוטומטית, מכל תלוש.</p>
            </div>

            {/* 2 · fees */}
            <div className="sc-item rv d1">
              <div className="sc-card">
                <div className="sc-ui">
                  <div className="ui-head">
                    <span className="ui-title">דמי ניהול מול השוק</span>
                  </div>
                  <div className="ui-bar">
                    <div className="ui-bl">
                      <span>דמי הניהול שלך</span>
                      <b>1.90%</b>
                    </div>
                    <div className="ui-track">
                      <i style={{ width: "95%", background: "linear-gradient(90deg,var(--peach),var(--peach-ink))" }} />
                    </div>
                  </div>
                  <div className="ui-bar">
                    <div className="ui-bl">
                      <span>ממוצע השוק</span>
                      <b>1.30%</b>
                    </div>
                    <div className="ui-track">
                      <i style={{ width: "65%", background: "linear-gradient(90deg,var(--lav-400),var(--lav-600))" }} />
                    </div>
                  </div>
                  <div className="ui-bar">
                    <div className="ui-bl">
                      <span>המסלול המוזל</span>
                      <b className="g">0.50%</b>
                    </div>
                    <div className="ui-track">
                      <i style={{ width: "26%", background: "linear-gradient(90deg,var(--mint),var(--mint-ink))" }} />
                    </div>
                  </div>
                  <div className="ui-hl">
                    <span>חיסכון עד הפרישה</span>
                    <b>+ 1,044,546 ₪</b>
                  </div>
                </div>
              </div>
              <h3>דמי הניהול שלך, גלויים.</h3>
              <p>השוואה לכל השוק בזמן אמת, מציאת המסלול המוזל ביותר — וכמה זה שווה לך עד גיל פרישה.</p>
            </div>

            {/* 3 · projection */}
            <div className="sc-item rv d2">
              <div className="sc-card">
                <div className="sc-ui">
                  <div className="ui-head">
                    <span className="ui-title">תחזית פרישה</span>
                    <span className="ui-tag g">+ 1,044,546 ₪</span>
                  </div>
                  <div className="ui-big">₪3,654,000</div>
                  <div className="ui-sub">צבירה ממוטבת בגיל 67 · ₪15,720 לחודש</div>
                  <svg className="ui-chart" viewBox="0 0 240 90">
                    <defs>
                      <linearGradient id="scStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#9B7FE8" />
                        <stop offset="0.55" stopColor="#6F8BE8" />
                        <stop offset="1" stopColor="#2F9C62" />
                      </linearGradient>
                      <linearGradient id="scA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#7C5FD6" stopOpacity=".26" />
                        <stop offset="1" stopColor="#7C5FD6" stopOpacity="0" />
                      </linearGradient>
                      <filter id="scGlow" x="-20%" y="-40%" width="140%" height="180%">
                        <feGaussianBlur stdDeviation="3.5" />
                      </filter>
                    </defs>
                    <line x1="4" y1="34" x2="236" y2="34" stroke="var(--border-hair)" strokeWidth="1.5" strokeDasharray="1.5 7" strokeLinecap="round" />
                    <line x1="4" y1="62" x2="236" y2="62" stroke="var(--border-hair)" strokeWidth="1.5" strokeDasharray="1.5 7" strokeLinecap="round" />
                    <path d="M4 80 C60 74,90 60,130 44 S200 16,236 8 L236 90 L4 90 Z" fill="url(#scA)" />
                    <path d="M4 84 C60 80,100 74,150 66 S210 56,236 52" fill="none" stroke="var(--faint)" strokeWidth="2.2" strokeDasharray="2 6" strokeLinecap="round" opacity=".8" />
                    <path d="M4 80 C60 74,90 60,130 44 S200 16,236 8" fill="none" stroke="#7C5FD6" strokeWidth="7" strokeLinecap="round" opacity=".3" filter="url(#scGlow)" />
                    <path d="M4 80 C60 74,90 60,130 44 S200 16,236 8" fill="none" stroke="url(#scStroke)" strokeWidth="3.2" strokeLinecap="round" />
                    <circle cx="236" cy="8" r="9" fill="#2F9C62" opacity=".16" />
                    <circle cx="236" cy="8" r="4.5" fill="#2F9C62" stroke="#fff" strokeWidth="2" />
                  </svg>
                </div>
              </div>
              <h3>התחזית שלך, עד השקל.</h3>
              <p>סימולציית פרישה חיה עם תרחישים — נוכחי מול ממוטב — שמראה כמה כל החלטה שווה לעתיד שלך.</p>
            </div>
          </div>
        </section>
      </div>

      {/* ============ FINQ-STYLE PRODUCT BANDS ============ */}
      <section className="bands">
        {/* band 1 · pension (lavender) */}
        <div className="band lav">
          <div className="band-inner">
            <div className="band-text">
              <span className="band-tag">ניהול פנסיה</span>
              <h2>לעבור לפנסיה עם AI, שיכולה להיות שווה לך הרבה יותר כסף בגיל הפרישה.</h2>
              <p>אנחנו סורקים את כל המסלולים, מנתחים את התיק שלך, ומפיקים בשנייה תובנות מבוססות נתונים שישדרגו לך את הפנסיה.</p>
              <div className="band-cta">
                <button className="band-btn" onClick={toRegister}>
                  תראו לי איך
                </button>
                <a className="band-link" href="#products">
                  לפרטים נוספים
                </a>
              </div>
            </div>
            <div className="band-visual">
              <div className="b-behind" />
              <div className="bcard">
                <div className="ui-head">
                  <span className="ui-mark">F</span>
                  <span className="ui-title">אופטימיזציית פנסיה</span>
                </div>
                <div className="ui-row">
                  <span>הורדת דמי ניהול מהפקדה</span>
                  <b>0.05%</b>
                </div>
                <div className="ui-row">
                  <span>הורדת דמי ניהול מצבירה</span>
                  <b>1.3%</b>
                </div>
                <div className="ui-row">
                  <span>הגדלת הקצבה החודשית</span>
                  <b>+ 498 ₪</b>
                </div>
                <div className="ui-hl">
                  <span>הגדלת החיסכון הצפוי בפרישה</span>
                  <b>+ 247,099 ₪</b>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* band 2 · ETFs (dark) */}
        <div className="band dark">
          <div className="band-inner">
            <div className="band-text">
              <span className="band-tag">קרנות מבוססות AI</span>
              <h2>לראשונה בישראל — קרנות השקעה בניהול מלא של AI.</h2>
              <p>אסטרטגיית השקעה מתקדמת, בלי מינימום ובלי עמלות בנק, שמתעדכנת בזמן אמת ומנוטרת על ידי המודל שלנו.</p>
              <div className="band-cta">
                <button className="band-btn" onClick={toRegister}>
                  לקרנות שלנו
                </button>
                <a className="band-link" href="#products">
                  השוואת קרנות
                </a>
              </div>
            </div>
            <div className="band-visual">
              <div className="golds">
                <div className="gcard g1">
                  <div className="gq">F</div>
                  <span className="gtag">AINT</span>
                  <div className="gname">
                    FinGuide Dollar Neutral
                    <br />
                    AI‑Managed Equity
                  </div>
                </div>
                <div className="gcard g2">
                  <div className="gq">F</div>
                  <span className="gtag">AIUP</span>
                  <div className="gname">
                    FinGuide First Large Cap
                    <br />
                    AI‑Managed Equity
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* band 3 · portfolio (mint) */}
        <div className="band mint">
          <div className="band-inner">
            <div className="band-text">
              <span className="band-tag">תיק השקעות</span>
              <h2>לפתוח תיק השקעות חכם עם AI, בחמש דקות.</h2>
              <p>תיק מבוסס AI עם קרנות שנבחרו בהתאמה לפרופיל שלך — מנוטר ומעודכן שוטף, בלי עמלות בנק ובתהליך דיגיטלי מהיר.</p>
              <div className="band-cta">
                <button className="band-btn" onClick={toRegister}>
                  לפתיחת תיק ב‑5 דקות
                </button>
                <a className="band-link" href="#how">
                  איך זה עובד
                </a>
              </div>
            </div>
            <div className="band-visual">
              <div className="b-behind" />
              <div className="bcard">
                <div className="ui-head">
                  <span className="ui-title">תיק ההשקעות שלך</span>
                  <span className="ui-tag">סיכון בינוני</span>
                </div>
                <div className="rank top">
                  <span className="rnum">#1</span>
                  <span className="rname">איילון · אג״ח בינלאומי</span>
                  <span className="rpct">20%</span>
                </div>
                <div className="rank">
                  <span className="rnum">#2</span>
                  <span className="rname">אנליסט · 20/80</span>
                  <span className="rpct">20%</span>
                </div>
                <div className="rank">
                  <span className="rnum">#3</span>
                  <span className="rname">מגדל · אג״ח חברות</span>
                  <span className="rpct">20%</span>
                </div>
                <div className="rank">
                  <span className="rnum">#4</span>
                  <span className="rname">סיגמא · מדינה +20%</span>
                  <span className="rpct">20%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ AI CHAT DEMO ============ */}
      <section className="chat-demo">
        <div className="wrap cd-inner">
          <div className="cd-copy">
            <span className="cd-kicker">
              <i />
              עוזר FinGuide · AI
            </span>
            <h2>
              כל שאלה פיננסית.
              <br />
              תשובה ברגע.
            </h2>
            <p>
              שאל כל דבר על התלוש, הפנסיה, המס שלך — וה‑AI יענה בשנייה עם נתונים אמיתיים מהמסמכים שלך.
            </p>
            <div className="cd-divider" />
            <div className="cd-features">
              {(
                [
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                    ),
                    title: "ניתוח תלוש שכר",
                    desc: "שאל על שכר, ניכויים ודמי ניהול — קבל תשובה מיידית",
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    ),
                    title: "בדיקת פנסיה",
                    desc: "מסלול הסיכון, התשואה הצפויה, והמלצות להגדלת הצבירה",
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                        <polyline points="17 6 23 6 23 12" />
                      </svg>
                    ),
                    title: "החזרי מס",
                    desc: "גלה אם מגיע לך כסף חזרה מהמדינה השנה",
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    ),
                    title: "תכנון חיסכון",
                    desc: "כמה תחסוך עד הפרישה ואיך לשפר את הצבירה",
                  },
                ] as Array<{ icon: ReactNode; title: string; desc: string }>
              ).map((feat, i) => (
                <div className={`cd-feat${i === 0 ? " active" : ""}`} key={i} data-cd-feat={String(i)}>
                  <span className="cd-feat-icon">{feat.icon}</span>
                  <div className="cd-feat-body">
                    <div className="cd-feat-title">{feat.title}</div>
                    <div className="cd-feat-desc">{feat.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="cd-cta" onClick={toRegister}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              נסו את העוזר חינם
            </button>
          </div>

          <div className="cd-visual">
            <div className="cd-glow" />
            <div className="cd-chat">
              <div className="cd-chat-bar">
                <span className="cd-chat-av">F</span>
                <div>
                  <div className="cd-chat-name">עוזר FinGuide</div>
                </div>
                <span className="cd-chat-status">מחובר</span>
              </div>
              <div className="cd-messages" id="cdMessages" />
              <div className="cd-chat-input">
                <div className="cd-input-field">שאל כל שאלה פיננסית...</div>
                <span className="cd-send">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <div className="wrap">
        <section className="sec" id="faq">
          <div className="shead rv">
            <span className="kicker">שאלות נפוצות</span>
            <h2>כל מה שרציתם לשאול.</h2>
          </div>
          <div className="faq rv d1">
            {[
              {
                q: "האם הנתונים שלי בטוחים?",
                a: "בהחלט. כל המסמכים מוצפנים מקצה לקצה בסטנדרט בנקאי, לא נמכרים לאף גורם, ואתה יכול למחוק אותם בכל רגע. אנחנו רואים רק מה שצריך כדי לעזור לך.",
              },
              {
                q: "כמה זה עולה?",
                a: "הבדיקה הראשונה חינם וללא התחייבות. אם תרצה ליווי מתמשך ועדכונים שוטפים, יש מסלולים בתשלום — אבל תמיד תראה את החיסכון הצפוי לפני שתחליט.",
              },
              {
                q: "אילו מסמכים אני צריך?",
                a: "מספיק תלוש שכר אחד כדי להתחיל. לניתוח מעמיק יותר אפשר להוסיף דוח פנסיה, טופס 106 או דוחות קופות גמל — אבל גם בלעדיהם תקבל תובנות שוות.",
              },
              {
                q: "מתי אראה תוצאות?",
                a: "מיד. הניתוח רץ בזמן אמת — תוך פחות מחמש דקות מהעלאת המסמך תקבל תמונה מלאה של מה שמגיע לך ואיפה אפשר לחסוך.",
              },
              {
                q: "זה מחליף יועץ פנסיוני?",
                a: "FinGuide נותן לך את הכלים והמידע להבין בדיוק מה קורה עם הכסף שלך — בשקיפות מלאה ובלי אינטרסים. בהחלטות מורכבות תמיד נמליץ להתייעץ גם עם בעל רישיון.",
              },
            ].map((item) => (
              <div className="qa" key={item.q}>
                <button>
                  {item.q}
                  <span className="pm">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>
                <div className="ans">
                  <p>{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ============ FINAL CTA ============ */}
      <section className="cta-final">
        <div className="wrap">
          <h2 className="rv">הכסף שלך, סוף סוף ברור.</h2>
          <p className="rv d1">בדיקה אחת חינם. תגלה מה מגיע לך — בלי התחייבות ובלי אותיות קטנות.</p>
          <div className="rv d1">
            <button className="btn-primary" onClick={toRegister}>
              אני רוצה להתחיל
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
          </div>
          <div className="fan rv d2">
            <div className="fcard f1">
              <div className="fm">F</div>
              <div className="ft">
                ניתוח
                <br />
                תלושים
              </div>
            </div>
            <div className="fcard f3">
              <div className="fm">F</div>
              <div className="ft">
                זכויות
                <br />
                ומס
              </div>
            </div>
            <div className="fcard f2">
              <div className="fm">F</div>
              <div className="ft">
                אופטימיזציית
                <br />
                פנסיה
              </div>
            </div>
          </div>
        </div>
        <div className="cta-base" />
      </section>

      <PublicFooter />
    </div>
  );
}
