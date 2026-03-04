import { ArrowUpRight } from "lucide-react";

interface DashboardHeroProps {
  greetingLine: string;
  documentsThisMonth: number;
  onViewDocuments: () => void;
}

export default function DashboardHero({
  greetingLine,
  documentsThisMonth,
  onViewDocuments,
}: DashboardHeroProps) {
  return (
    <section className="dashboard-hero">
      <div>
        <h1>{greetingLine}</h1>
        <p>
          הנה סקירת המצב הפיננסי שלך
          {documentsThisMonth ? " החודש" : ""}.
        </p>
      </div>
      <button className="dashboard-hero-action" type="button" onClick={onViewDocuments}>
        צפייה במסמכים
        <ArrowUpRight aria-hidden="true" />
      </button>
    </section>
  );
}
