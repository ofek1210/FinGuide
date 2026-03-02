import { ShieldCheck } from "lucide-react";

interface DashboardAlertCardProps {
  title: string;
  message: string;
  onViewDocuments: () => void;
}

export default function DashboardAlertCard({
  title,
  message,
  onViewDocuments,
}: DashboardAlertCardProps) {
  return (
    <article className="dashboard-card alert-card">
      <div className="alert-icon">
        <ShieldCheck aria-hidden="true" />
      </div>
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
      <button className="alert-action" type="button" onClick={onViewDocuments}>
        מעבר למסמכים
      </button>
    </article>
  );
}
