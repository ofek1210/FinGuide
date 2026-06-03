import { BENEFITS } from "../../data/careers";

export default function BenefitsSection() {
  return (
    <section className="job-benefits-section" aria-labelledby="job-benefits-title">
      <span className="job-section-eyebrow">Perks</span>
      <h2 id="job-benefits-title">ההטבות שלנו</h2>
      <ul className="job-benefits-grid" role="list">
        {BENEFITS.map((b) => (
          <li key={b.title} className={`job-benefit-card tone-${b.tone}`}>
            <span className="job-benefit-icon" aria-hidden="true">
              {b.icon}
            </span>
            <h3>{b.title}</h3>
          </li>
        ))}
      </ul>
    </section>
  );
}
