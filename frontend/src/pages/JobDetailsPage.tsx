import { useEffect, useRef } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowUpRight, ChevronLeft } from "lucide-react";
import { APP_ROUTES } from "../types/navigation";
import { getJobBySlug, getRelatedJobs } from "../data/careers";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import PublicPageShell from "../components/landing/PublicPageShell";
import "../components/landing/landing-job.css";
import JobHeader from "../components/careers/JobHeader";
import JobOverview from "../components/careers/JobOverview";
import ResponsibilitiesSection from "../components/careers/ResponsibilitiesSection";
import RequirementsSection from "../components/careers/RequirementsSection";
import BenefitsSection from "../components/careers/BenefitsSection";
import JobApplicationForm from "../components/careers/JobApplicationForm";
import RelatedJobs from "../components/careers/RelatedJobs";

export default function JobDetailsPage() {
  const { slug } = useParams<{ slug: string }>();
  const job = slug ? getJobBySlug(slug) : undefined;
  const formRef = useRef<HTMLElement | null>(null);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/careers/${slug}`
      : `/careers/${slug}`;

  // SEO + JSON-LD must be called unconditionally to keep hook order stable.
  useDocumentMeta({
    title: job ? `${job.title} · Careers · FinGuide` : "Careers · FinGuide",
    description: job
      ? `${job.summary} ${job.department} · ${job.location} · ${job.type}.`
      : "Open positions at FinGuide.",
    jobPosting: job
      ? {
          title: job.title,
          description: job.summary,
          department: job.department,
          location: job.location,
          employmentType: job.type,
          url: shareUrl,
          datePosted: job.datePosted,
        }
      : undefined,
  });

  // Reset scroll on slug change so each job page opens at the top.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [slug]);

  if (!slug) return <Navigate to={APP_ROUTES.careers} replace />;
  if (!job) return <Navigate to="/404" replace />;

  const related = getRelatedJobs(slug, 3);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <PublicPageShell contentClassName="job-page">
      <main className="job-main">
        <nav className="job-breadcrumb landing-container" aria-label="Breadcrumb">
          <Link to={APP_ROUTES.careers}>
            <ChevronLeft aria-hidden="true" />
            <span>חזרה לכל המשרות</span>
          </Link>
        </nav>

        <div className="job-content landing-container">
          <JobHeader job={job} shareUrl={shareUrl} onApply={scrollToForm} />

          <article className="job-body">
            <JobOverview job={job} />
            <ResponsibilitiesSection items={job.responsibilities} />
            <RequirementsSection required={job.required} niceToHave={job.niceToHave} />
            <BenefitsSection />
            <JobApplicationForm ref={formRef} job={job} />
          </article>
        </div>

        <div className="landing-container">
          <RelatedJobs jobs={related} />

          <section className="job-bottom-cta">
            <div className="job-bottom-cta-card">
              <h2>לא בטוחים שהמשרה הזאת מתאימה?</h2>
              <p>
                שלחו לנו קורות חיים פתוחים ונחזור אליכם כשנמצא משהו שמתאים בדיוק לכם.
              </p>
              <a
                className="landing-primary job-bottom-cta-btn"
                href="mailto:FinGuide@Gmail.com?subject=Open Application"
              >
                שליחת קורות חיים
                <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
          </section>
        </div>
      </main>
    </PublicPageShell>
  );
}
