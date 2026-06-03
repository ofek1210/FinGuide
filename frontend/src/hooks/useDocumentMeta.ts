import { useEffect } from "react";

interface JobPostingLd {
  title: string;
  description: string;
  department: string;
  location: string;
  employmentType: string;
  url: string;
  /** ISO date string, e.g. "2026-01-15". Must be stable — Google indexers use this as freshness signal. */
  datePosted: string;
  /** Optional ISO date the listing is valid until. */
  validThrough?: string;
}

interface UseDocumentMetaOptions {
  title: string;
  description?: string;
  /** When provided, a schema.org JobPosting JSON-LD block is injected for the lifetime of the mount. */
  jobPosting?: JobPostingLd;
}

const SCRIPT_ID = "job-posting-ld";

function setMetaDescription(content: string): () => void {
  const existing = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  const previous = existing?.content ?? null;

  if (existing) {
    existing.content = content;
  } else {
    const meta = document.createElement("meta");
    meta.name = "description";
    meta.content = content;
    document.head.appendChild(meta);
  }

  return () => {
    if (!existing) {
      document.querySelector('meta[name="description"]')?.remove();
    } else if (previous !== null) {
      existing.content = previous;
    }
  };
}

function setJobPostingLd(job: JobPostingLd): () => void {
  document.getElementById(SCRIPT_ID)?.remove();

  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    hiringOrganization: {
      "@type": "Organization",
      name: "FinGuide",
      sameAs: "https://finguide.example",
    },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: job.location },
    },
    employmentType: job.employmentType.toUpperCase().replace(/\s+/g, "_"),
    industry: job.department,
    url: job.url,
    datePosted: job.datePosted,
  };
  if (job.validThrough) payload.validThrough = job.validThrough;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.type = "application/ld+json";
  script.text = JSON.stringify(payload);
  document.head.appendChild(script);

  return () => {
    document.getElementById(SCRIPT_ID)?.remove();
  };
}

export function useDocumentMeta({ title, description, jobPosting }: UseDocumentMetaOptions): void {
  // Serialize jobPosting so the effect's dep array stays stable even when callers
  // build the object inline. JSON.stringify on a small, flat object is cheap.
  const jobKey = jobPosting ? JSON.stringify(jobPosting) : "";

  useEffect(() => {
    // Note: in React Strict Mode (development only), effects fire mount → unmount → remount.
    // We snapshot the title at first mount; after the second mount the snapshot is the
    // previously restored value, which is correct for production (Strict Mode disabled).
    const previousTitle = document.title;
    document.title = title;

    const cleanups: Array<() => void> = [];
    if (description) cleanups.push(setMetaDescription(description));
    if (jobPosting) cleanups.push(setJobPostingLd(jobPosting));

    return () => {
      document.title = previousTitle;
      cleanups.forEach((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, jobKey]);
}
