import type { Job } from "../../data/careers";

interface JobOverviewProps {
  job: Job;
}

/**
 * Two stacked blocks:
 *   1. "About FinGuide" — short company-pitch shared across all jobs
 *   2. "About The Role" — what the role does, team, impact, daily work
 */
export default function JobOverview({ job }: JobOverviewProps) {
  return (
    <section className="job-overview" aria-labelledby="job-overview-title">
      <div className="job-overview-block">
        <span className="job-section-eyebrow">About FinGuide</span>
        <h2 id="job-overview-title">בונים את עתיד ההחלטות הפיננסיות</h2>
        <p>
          FinGuide היא פלטפורמת AI שעוזרת לאנשים להבין את התמונה הפיננסית שלהם —
          תלושי שכר, פנסיה, ביטוחים והשקעות — וקבל החלטות חכמות יותר. אנחנו
          מתחילים בישראל ובונים מוצר שיוכל לעבוד בכל מקום בעולם.
        </p>
        <p>
          המשימה שלנו פשוטה: להפוך מידע פיננסי מסובך למשהו שאפשר באמת להבין —
          ולקבל ממנו ערך. אנחנו צוות קטן, גמיש, ובעל תשוקה אמיתית למוצר.
        </p>
      </div>

      <div className="job-overview-block">
        <span className="job-section-eyebrow">About The Role</span>
        <h2>{job.title}</h2>
        <p>{job.aboutTheRole}</p>
        <p className="job-overview-team">
          <strong>Team:</strong> {job.teamStructure}
        </p>
      </div>
    </section>
  );
}
