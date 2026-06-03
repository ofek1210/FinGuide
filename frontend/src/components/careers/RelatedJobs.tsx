import { Link } from "react-router-dom";
import { ArrowUpRight, Briefcase, Home, MapPin } from "lucide-react";
import type { Job } from "../../data/careers";
import { WORK_MODEL } from "../../data/careers";

interface RelatedJobsProps {
  jobs: Job[];
}

export default function RelatedJobs({ jobs }: RelatedJobsProps) {
  if (jobs.length === 0) return null;
  return (
    <section className="job-related-section" aria-labelledby="job-related-title">
      <header className="job-related-header">
        <span className="job-section-eyebrow">More Roles</span>
        <h2 id="job-related-title">Other Opportunities</h2>
        <p>הצצה למשרות נוספות שעשויות לעניין אתכם.</p>
      </header>
      <ul className="job-related-list" role="list">
        {jobs.map((j) => (
          <li key={j.slug} className={`job-related-card tone-${j.tone}`}>
            <div className="job-related-tags">
              <span className={`job-related-dept tone-${j.tone}`}>{j.department}</span>
              {j.seniority === "Junior" ? (
                <span className="job-related-seniority">Junior</span>
              ) : null}
            </div>
            <h3>{j.title}</h3>
            <ul className="job-related-attrs" role="list">
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
            <p>{j.summary}</p>
            <Link to={`/careers/${j.slug}`} className="job-related-cta">
              <span>View Position</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
