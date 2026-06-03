import { useState } from "react";
import { ArrowUpRight, Briefcase, Home, MapPin, Share2, Check } from "lucide-react";
import type { Job } from "../../data/careers";
import { WORK_MODEL } from "../../data/careers";

interface JobHeaderProps {
  job: Job;
  /** Absolute URL of this job page, used by the share button */
  shareUrl: string;
  /** Triggered when the candidate clicks "Apply Now" — scrolls to the form */
  onApply: () => void;
}

export default function JobHeader({ job, shareUrl, onApply }: JobHeaderProps) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const data = {
      title: `${job.title} · FinGuide`,
      text: `${job.title} — ${job.department} · ${job.location}`,
      url: shareUrl,
    };
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share(data);
        return;
      } catch {
        // user cancelled native share — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy job URL", shareUrl);
    }
  };

  return (
    <header className={`job-header tone-${job.tone}`}>
      <div className="job-header-meta">
        <div className="job-header-tags">
          <span className={`job-header-dept tone-${job.tone}`}>{job.department}</span>
          {job.seniority === "Junior" ? (
            <span className="job-header-seniority">Junior</span>
          ) : null}
        </div>
        <ul className="job-header-attrs" role="list">
          <li>
            <MapPin aria-hidden="true" />
            <span>{job.location}</span>
          </li>
          <li>
            <Home aria-hidden="true" />
            <span>{WORK_MODEL}</span>
          </li>
          <li>
            <Briefcase aria-hidden="true" />
            <span>{job.type}</span>
          </li>
        </ul>
      </div>

      <h1 className="job-header-title">{job.title}</h1>
      <p className="job-header-summary">{job.summary}</p>

      <div className="job-header-actions">
        <button type="button" className="landing-primary job-header-apply" onClick={onApply}>
          הגשת מועמדות
          <ArrowUpRight aria-hidden="true" />
        </button>
        <button
          type="button"
          className="job-header-share"
          onClick={share}
          aria-label={copied ? "הקישור הועתק" : "שיתוף המשרה"}
        >
          {copied ? <Check aria-hidden="true" /> : <Share2 aria-hidden="true" />}
          <span>{copied ? "הקישור הועתק" : "שיתוף"}</span>
        </button>
      </div>
    </header>
  );
}
