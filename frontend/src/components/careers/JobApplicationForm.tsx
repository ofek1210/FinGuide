import { forwardRef, useState } from "react";
import { Upload, Send, Check, AlertCircle } from "lucide-react";
import type { Job } from "../../data/careers";

interface JobApplicationFormProps {
  job: Job;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  cvName: string;
  coverLetter: string;
  notes: string;
  consent: boolean;
}

const INITIAL: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  linkedin: "",
  portfolio: "",
  cvName: "",
  coverLetter: "",
  notes: "",
  consent: false,
};

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errs: Partial<Record<keyof FormState, string>> = {};
  if (!form.firstName.trim()) errs.firstName = "שדה חובה";
  if (!form.lastName.trim()) errs.lastName = "שדה חובה";
  if (!form.email.trim()) errs.email = "שדה חובה";
  else if (!EMAIL_RX.test(form.email.trim())) errs.email = "פורמט מייל לא תקין";
  if (!form.consent) errs.consent = "יש לאשר את ההסכמה לפני שליחה";
  return errs;
}

const JobApplicationForm = forwardRef<HTMLElement, JobApplicationFormProps>(
  function JobApplicationForm({ job }, ref) {
    const [form, setForm] = useState<FormState>(INITIAL);
    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const found = validate(form);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        return;
      }
      setSubmitting(true);

      const body = [
        `Position: ${job.title}`,
        `Department: ${job.department}`,
        `Location: ${job.location}`,
        ``,
        `Name: ${form.firstName} ${form.lastName}`,
        `Email: ${form.email}`,
        `Phone: ${form.phone || "—"}`,
        `LinkedIn: ${form.linkedin || "—"}`,
        `Portfolio: ${form.portfolio || "—"}`,
        `CV file: ${form.cvName || "(to be attached separately)"}`,
        ``,
        `Cover Letter:`,
        form.coverLetter || "—",
        ``,
        `Additional Notes:`,
        form.notes || "—",
      ].join("\n");

      const url = `mailto:FinGuide@Gmail.com?subject=${encodeURIComponent(
        `Application — ${job.title}`
      )}&body=${encodeURIComponent(body)}`;

      // Open the mail client without navigating the current SPA page —
      // assigning window.location.href can race React's setState and prevent
      // the success view from rendering (mobile Safari / Firefox).
      const a = document.createElement("a");
      a.href = url;
      a.rel = "noopener";
      a.click();

      // Flip to the success view in the next paint.
      requestAnimationFrame(() => {
        setSubmitting(false);
        setSubmitted(true);
      });
    };

    if (submitted) {
      return (
        <section ref={ref} id="apply" className="job-form-section">
          <div className="job-form-success" role="status" aria-live="polite">
            <span className="job-form-success-icon" aria-hidden="true">
              <Check />
            </span>
            <h2>הבקשה נשלחה!</h2>
            <p>
              קיבלנו את הבקשה שלכם ל-<strong>{job.title}</strong>. אנחנו עוברים
              על כל מועמדות בקפידה ונחזור אליכם בהקדם.
            </p>
            <button
              type="button"
              className="job-form-success-reset"
              onClick={() => {
                setForm(INITIAL);
                setSubmitted(false);
              }}
            >
              שליחת בקשה נוספת
            </button>
          </div>
        </section>
      );
    }

    return (
      <section ref={ref} id="apply" className="job-form-section" aria-labelledby="job-form-title">
        <header className="job-form-header">
          <span className="job-section-eyebrow">Apply</span>
          <h2 id="job-form-title">הגשת מועמדות</h2>
          <p>
            ספרו לנו קצת על עצמכם ועל המוטיבציה שלכם להצטרף ל-FinGuide.
            כל השדות עם <span className="job-form-required-marker">*</span> חובה.
          </p>
        </header>

        <form className="job-form" onSubmit={handleSubmit} noValidate>
          <div className="job-form-row">
            <div className={`job-form-field ${errors.firstName ? "is-invalid" : ""}`}>
              <label htmlFor="firstName">
                שם פרטי <span className="job-form-required-marker">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                aria-invalid={Boolean(errors.firstName)}
              />
              {errors.firstName && (
                <span className="job-form-error">
                  <AlertCircle aria-hidden="true" /> {errors.firstName}
                </span>
              )}
            </div>

            <div className={`job-form-field ${errors.lastName ? "is-invalid" : ""}`}>
              <label htmlFor="lastName">
                שם משפחה <span className="job-form-required-marker">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                aria-invalid={Boolean(errors.lastName)}
              />
              {errors.lastName && (
                <span className="job-form-error">
                  <AlertCircle aria-hidden="true" /> {errors.lastName}
                </span>
              )}
            </div>
          </div>

          <div className="job-form-row">
            <div className={`job-form-field ${errors.email ? "is-invalid" : ""}`}>
              <label htmlFor="email">
                אימייל <span className="job-form-required-marker">*</span>
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                aria-invalid={Boolean(errors.email)}
                dir="ltr"
              />
              {errors.email && (
                <span className="job-form-error">
                  <AlertCircle aria-hidden="true" /> {errors.email}
                </span>
              )}
            </div>

            <div className="job-form-field">
              <label htmlFor="phone">טלפון</label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <div className="job-form-row">
            <div className="job-form-field">
              <label htmlFor="linkedin">פרופיל LinkedIn</label>
              <input
                id="linkedin"
                type="url"
                placeholder="https://linkedin.com/in/..."
                value={form.linkedin}
                onChange={(e) => update("linkedin", e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="job-form-field">
              <label htmlFor="portfolio">Portfolio / Website</label>
              <input
                id="portfolio"
                type="url"
                placeholder="https://..."
                value={form.portfolio}
                onChange={(e) => update("portfolio", e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <div className="job-form-field">
            <span className="job-form-label">קורות חיים (CV)</span>
            <label className="job-form-file" htmlFor="cv">
              <Upload aria-hidden="true" />
              <span>{form.cvName || "בחרו קובץ PDF או DOCX"}</span>
              <input
                id="cv"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) update("cvName", file.name);
                }}
              />
            </label>
            <small className="job-form-hint">
              הקובץ עצמו לא נשלח אוטומטית — לאחר השליחה נחזור אליכם להעברת קורות חיים.
            </small>
          </div>

          <div className="job-form-field">
            <label htmlFor="coverLetter">מכתב מקדים</label>
            <textarea
              id="coverLetter"
              rows={4}
              value={form.coverLetter}
              onChange={(e) => update("coverLetter", e.target.value)}
              placeholder="ספרו לנו למה דווקא אתם — ולמה דווקא FinGuide."
            />
          </div>

          <div className="job-form-field">
            <label htmlFor="notes">הערות נוספות</label>
            <textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="מתי תוכלו להתחיל? יש משהו שכדאי שנדע מראש?"
            />
          </div>

          <label
            htmlFor="consent"
            className={`job-form-consent ${errors.consent ? "is-invalid" : ""}`}
          >
            <input
              id="consent"
              type="checkbox"
              checked={form.consent}
              onChange={(e) => update("consent", e.target.checked)}
              aria-invalid={Boolean(errors.consent)}
              aria-describedby={errors.consent ? "consent-error" : undefined}
            />
            <span>
              אני מסכים/ה שהפרטים שלי יישמרו לצורך תהליך הגיוס בלבד, בהתאם למדיניות הפרטיות של FinGuide.
              <span className="job-form-required-marker"> *</span>
            </span>
          </label>
          {errors.consent && (
            <span id="consent-error" role="alert" className="job-form-error">
              <AlertCircle aria-hidden="true" /> {errors.consent}
            </span>
          )}

          <button type="submit" className="landing-primary job-form-submit" disabled={submitting}>
            {submitting ? "שולח..." : "שליחת מועמדות"}
            <Send aria-hidden="true" />
          </button>
        </form>
      </section>
    );
  }
);

export default JobApplicationForm;
