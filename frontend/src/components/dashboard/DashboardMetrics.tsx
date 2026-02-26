import type { DashboardMetric } from "../../types/dashboard";

interface DashboardMetricsProps {
  metrics: DashboardMetric[];
}

export default function DashboardMetrics({ metrics }: DashboardMetricsProps) {
  return (
    <section className="dashboard-metrics">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <article key={metric.label} className="dashboard-metric-card">
            <div className={`metric-icon ${metric.accentClass || ""}`.trim()}>
              <Icon aria-hidden="true" />
            </div>
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value">{metric.value}</div>
            <div className="metric-subtitle">{metric.subtitle}</div>
          </article>
        );
      })}
    </section>
  );
}
