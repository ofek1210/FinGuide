import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  MapPin,
  Briefcase,
  Home,
  Search,
} from "lucide-react";
import { APP_ROUTES } from "../types/navigation";
import AppFooter from "../components/AppFooter";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import {
  JOBS,
  DEPARTMENTS,
  SENIORITIES,
  WORK_MODEL,
  REASONS,
  CULTURE_ITEMS,
  STATS,
  BENEFITS,
  STEPS,
  TESTIMONIALS,
  type Department,
  type Seniority,
  type Stat,
} from "../data/careers";

/* ────────────────────────────────────────────────
 * Hooks (local — only used here)
 * ──────────────────────────────────────────────── */

function useCountUp(target: number, durationMs = 1400, start = false): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let rafId = 0;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const progress = Math.min(1, (ts - startTs) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(target * eased));
      if (progress < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs, start]);
  return val;
}

function useInView<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);
  return [ref, inView];
}

function StatCard({ stat }: { stat: Stat }) {
  const [ref, inView] = useInView<HTMLLIElement>();
  const value = useCountUp(stat.value, 1400, inView);
  return (
    <li ref={ref} className={`careers-stat tone-${stat.tone}`}>
      <span className="careers-stat-value" aria-label={`${stat.value}${stat.suffix}`}>
        {value}
        <span className="careers-stat-suffix">{stat.suffix}</span>
      </span>
      <span className="careers-stat-label">{stat.label}</span>
    </li>
  );
}

/* ────────────────────────────────────────────────
 * Page
 * ──────────────────────────────────────────────── */

export default function CareersPage() {
  const navigate = useNavigate();
  const hasToken = Boolean(localStorage.getItem("token"));

  useDocumentMeta({
    title: "Careers · FinGuide",
    description:
      "Open positions at FinGuide — engineering, product, design, AI and more. Help us build the future of smarter financial decisions.",
  });

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState<Department | "all">("all");
  const [seniority, setSeniority] = useState<Seniority | "all">("all");

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return JOBS.filter((j) => {
      const matchesQuery =
        !q ||
        j.title.toLowerCase().includes(q) ||
        j.summary.toLowerCase().includes(q) ||
        j.required.some((r) => r.toLowerCase().includes(q));
      const matchesDept = dept === "all" || j.department === dept;
      const matchesSeniority = seniority === "all" || j.seniority === seniority;
      return matchesQuery && matchesDept && matchesSeniority;
    });
  }, [search, dept, seniority]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="careers-page landing-page" dir="rtl">
      <header className="landing-nav landing-container">
        <button
          type="button"
          className="landing-logo careers-logo-btn"
          onClick={() => navigate(APP_ROUTES.home)}
          aria-label="FinGuide — חזרה לדף הבית"
        >
          <span>FinGuide</span>
        </button>
        <div className="landing-nav-actions">
          {hasToken ? (
            <button
              className="landing-primary landing-nav-primary"
              type="button"
              onClick={() => navigate(APP_ROUTES.dashboard)}
            >
              ללוח הבקרה
            </button>
          ) : (
            <>
              <button
                className="landing-secondary"
                type="button"
                onClick={() => navigate(APP_ROUTES.login)}
              >
                התחברות
              </button>
              <button
                className="landing-primary landing-nav-primary"
                type="button"
                onClick={() => navigate(APP_ROUTES.register)}
              >
                התחל עכשיו
              </button>
            </>
          )}
        </div>
      </header>

      <main className="careers-main">
        {/* ── Hero ── */}
        <section className="careers-hero" aria-labelledby="careers-hero-title">
          <div className="careers-hero-blob careers-hero-blob-1" aria-hidden="true" />
          <div className="careers-hero-blob careers-hero-blob-2" aria-hidden="true" />
          <div className="careers-hero-blob careers-hero-blob-3" aria-hidden="true" />

          <div className="careers-hero-inner landing-container">
            <span className="careers-hero-eyebrow">We're Hiring</span>
            <h1 id="careers-hero-title" className="careers-hero-title">
              קריירה ב-<strong>FinGuide</strong>
            </h1>
            <p className="careers-hero-subtitle">
              בואו לבנות איתנו את העתיד של קבלת ההחלטות הפיננסיות.
            </p>
            <p className="careers-hero-support">
              אנחנו מחפשים אנשים סקרנים, יצירתיים ובעלי תשוקה לטכנולוגיה,
              שרוצים להשפיע על מוצר אמיתי ולהיות חלק מצוות שבונה משהו גדול.
            </p>
            <div className="careers-hero-actions">
              <button
                type="button"
                className="landing-primary careers-hero-cta"
                onClick={() => scrollTo("careers-positions")}
              >
                משרות פתוחות
                <ArrowUpRight aria-hidden="true" />
              </button>
              <button
                type="button"
                className="careers-hero-ghost"
                onClick={() => navigate(APP_ROUTES.team)}
              >
                הכירו את הצוות
                <ArrowUpRight aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {/* ── Why join us ── */}
        <section className="careers-section landing-container" aria-labelledby="careers-why-title">
          <header className="careers-section-header">
            <span className="careers-section-eyebrow">Why Us</span>
            <h2 id="careers-why-title">למה לעבוד אצלנו?</h2>
          </header>
          <ul className="careers-reasons" role="list">
            {REASONS.map((r) => (
              <li key={r.title} className={`careers-reason tone-${r.tone}`}>
                <span className="careers-reason-icon" aria-hidden="true">{r.icon}</span>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Company culture ── */}
        <section className="careers-section landing-container" aria-labelledby="careers-culture-title">
          <header className="careers-section-header">
            <span className="careers-section-eyebrow">Culture</span>
            <h2 id="careers-culture-title">החיים ב-FinGuide</h2>
            <p className="careers-section-sub">
              מה שבאמת קורה אצלנו — מעבר לשורת המשימות.
            </p>
          </header>

          <ul className="careers-culture" role="list">
            {CULTURE_ITEMS.map((c) => (
              <li key={c.label} className={`careers-culture-chip tone-${c.tone}`}>
                <span aria-hidden="true">{c.icon}</span> {c.label}
              </li>
            ))}
          </ul>

          <ul className="careers-stats" role="list">
            {STATS.map((s) => (
              <StatCard key={s.label} stat={s} />
            ))}
          </ul>
        </section>

        {/* ── Open positions ── */}
        <section
          id="careers-positions"
          className="careers-section landing-container"
          aria-labelledby="careers-positions-title"
        >
          <header className="careers-section-header">
            <span className="careers-section-eyebrow">Open Positions</span>
            <h2 id="careers-positions-title">משרות פתוחות</h2>
            <p className="careers-section-sub">
              {filteredJobs.length} משרות פתוחות כרגע — מצאו את המתאימה לכם.
            </p>
          </header>

          <div className="careers-filters">
            <div className="careers-search">
              <Search aria-hidden="true" />
              <input
                type="search"
                placeholder="חיפוש לפי תפקיד, תיאור או כישור..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="חיפוש משרות"
              />
            </div>

            <div className="careers-filter">
              <label htmlFor="careers-dept">מחלקה</label>
              <select
                id="careers-dept"
                value={dept}
                onChange={(e) => setDept(e.target.value as Department | "all")}
              >
                <option value="all">כל המחלקות</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="careers-filter">
              <label htmlFor="careers-seniority">דרגה</label>
              <select
                id="careers-seniority"
                value={seniority}
                onChange={(e) => setSeniority(e.target.value as Seniority | "all")}
              >
                <option value="all">כל הדרגות</option>
                {SENIORITIES.map((s) => (
                  <option key={s} value={s}>
                    {s === "Junior" ? "Junior" : "Mid+ / Senior"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="careers-empty">
              <span aria-hidden="true">🔍</span>
              <h3>לא נמצאו משרות שתואמות לחיפוש</h3>
              <p>נסו לרענן את הסינון, או שלחו לנו קורות חיים — תמיד מחפשים אנשים מעולים.</p>
              <a className="landing-primary careers-empty-cta" href="mailto:FinGuide@Gmail.com?subject=Open Application">
                שליחת CV
                <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
          ) : (
            <ul className="careers-jobs" role="list">
              {filteredJobs.map((j) => (
                <li key={j.slug} className={`careers-job tone-${j.tone}`}>
                  <div className="careers-job-top">
                    <div className="careers-job-tags">
                      <span className={`careers-job-dept tone-${j.tone}`}>{j.department}</span>
                      {j.seniority === "Junior" ? (
                        <span className="careers-job-seniority">Junior</span>
                      ) : null}
                    </div>
                    <h3>{j.title}</h3>
                    <ul className="careers-job-attrs" role="list">
                      <li>
                        <MapPin aria-hidden="true" />
                        <span>{j.location}</span>
                      </li>
                      <li>
                        <Home aria-hidden="true" />
                        <span>{WORK_MODEL}</span>
                      </li>
                      <li>
                        <Briefcase aria-hidden="true" />
                        <span>{j.type}</span>
                      </li>
                    </ul>
                    <p className="careers-job-desc">{j.summary}</p>
                    <ul className="careers-job-skills" role="list">
                      {j.required.slice(0, 4).map((r, idx) => (
                        <li key={`${j.slug}-skill-${idx}`}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="careers-job-actions">
                    <Link
                      to={`/careers/${j.slug}#apply`}
                      className="careers-job-apply"
                    >
                      Apply
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                    <Link to={`/careers/${j.slug}`} className="careers-job-learn">
                      Learn More
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Benefits ── */}
        <section className="careers-section landing-container" aria-labelledby="careers-benefits-title">
          <header className="careers-section-header">
            <span className="careers-section-eyebrow">Benefits</span>
            <h2 id="careers-benefits-title">ההטבות שלנו</h2>
          </header>
          <ul className="careers-benefits" role="list">
            {BENEFITS.map((b) => (
              <li key={b.title} className={`careers-benefit tone-${b.tone}`}>
                <span aria-hidden="true">{b.icon}</span>
                <h3>{b.title}</h3>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Hiring process ── */}
        <section className="careers-section landing-container" aria-labelledby="careers-process-title">
          <header className="careers-section-header">
            <span className="careers-section-eyebrow">Process</span>
            <h2 id="careers-process-title">איך נראה תהליך הגיוס?</h2>
          </header>
          <ol className="careers-timeline" role="list">
            {STEPS.map((s) => (
              <li key={s.num} className={`careers-step tone-${s.tone}`}>
                <span className="careers-step-num">{s.num}</span>
                <div className="careers-step-body">
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Testimonials ── */}
        <section className="careers-section landing-container" aria-labelledby="careers-testimonials-title">
          <header className="careers-section-header">
            <span className="careers-section-eyebrow">Voices</span>
            <h2 id="careers-testimonials-title">מה אומרים אצלנו</h2>
          </header>
          <ul className="careers-testimonials" role="list">
            {TESTIMONIALS.map((t) => (
              <li key={t.name} className={`careers-testimonial tone-${t.tone}`}>
                <p className="careers-testimonial-quote">
                  <span className="careers-testimonial-mark" aria-hidden="true">"</span>
                  {t.quote}
                </p>
                <footer className="careers-testimonial-author">
                  <img
                    className="careers-testimonial-avatar"
                    src={t.avatar}
                    alt={`${t.name} — ${t.role}`}
                    loading="lazy"
                    decoding="async"
                  />
                  <div>
                    <span className="careers-testimonial-name">— {t.name}</span>
                    <span className="careers-testimonial-role">{t.role}</span>
                  </div>
                </footer>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Final CTA ── */}
        <section className="careers-final landing-container">
          <div className="careers-final-card">
            <span className="careers-final-eyebrow">Open Application</span>
            <h2>לא מצאתם משרה שמתאימה לכם?</h2>
            <p>
              אנחנו תמיד מחפשים אנשים מעולים. שלחו לנו קורות חיים
              ונחזור אליכם כשנמצא משהו שמתאים.
            </p>
            <a
              className="landing-primary careers-final-btn"
              href="mailto:FinGuide@Gmail.com?subject=Open Application"
            >
              שלחו קורות חיים
              <ArrowUpRight aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <AppFooter variant="guest" />
    </div>
  );
}
