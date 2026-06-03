import { Check } from "lucide-react";

interface ResponsibilitiesSectionProps {
  items: string[];
}

export default function ResponsibilitiesSection({ items }: ResponsibilitiesSectionProps) {
  return (
    <section className="job-list-section" aria-labelledby="job-responsibilities-title">
      <span className="job-section-eyebrow">Your Mission</span>
      <h2 id="job-responsibilities-title">Responsibilities</h2>
      <ul className="job-bullets" role="list">
        {items.map((item) => (
          <li key={item}>
            <Check aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
