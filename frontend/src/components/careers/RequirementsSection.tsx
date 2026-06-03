import { Check, Sparkles } from "lucide-react";

interface RequirementsSectionProps {
  required: string[];
  niceToHave: string[];
}

export default function RequirementsSection({
  required,
  niceToHave,
}: RequirementsSectionProps) {
  return (
    <>
      <section className="job-list-section" aria-labelledby="job-requirements-title">
        <span className="job-section-eyebrow">Must Have</span>
        <h2 id="job-requirements-title">Requirements</h2>
        <ul className="job-bullets" role="list">
          {required.map((item) => (
            <li key={item}>
              <Check aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {niceToHave.length > 0 ? (
        <section className="job-list-section job-list-nice" aria-labelledby="job-nice-title">
          <span className="job-section-eyebrow tone-mint">Bonus</span>
          <h2 id="job-nice-title">Nice To Have</h2>
          <ul className="job-bullets job-bullets-nice" role="list">
            {niceToHave.map((item) => (
              <li key={item}>
                <Sparkles aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
