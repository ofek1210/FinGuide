import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import Loader from "../ui/Loader";
import type { AppRoute } from "../../types/navigation";

export type DomainHealthState = {
  hasData: boolean;
  score: number | null;
  label: string | null;
  metric: ReactNode | null;
};

type DashboardDomainHealthCardProps = {
  title: string;
  loadingLabel: string;
  errorFallback: string;
  accentColor: string;
  route: AppRoute;
  footerNote: string;
  emptyTitle: string;
  emptyCta: string;
  load: () => Promise<DomainHealthState | null>;
};

export default function DashboardDomainHealthCard({
  title,
  loadingLabel,
  errorFallback,
  accentColor,
  route,
  footerNote,
  emptyTitle,
  emptyCta,
  load: loadFn,
}: DashboardDomainHealthCardProps) {
  const navigate = useNavigate();
  const [state, setState] = useState<DomainHealthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadFn();
      setState(result);
    } catch {
      setError(errorFallback);
    } finally {
      setLoading(false);
    }
  }, [loadFn, errorFallback]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="dashboard-card">
        <Loader />
        <span className="dashboard-muted">{loadingLabel}</span>
      </section>
    );
  }

  if (error) {
    return (
      <section className="dashboard-card">
        <p className="dashboard-muted">{error}</p>
        <button type="button" className="dashboard-link-btn" onClick={() => void load()}>נסה שוב</button>
      </section>
    );
  }

  if (!state?.hasData || state.score == null) {
    return (
      <section className="dashboard-card">
        <header className="dashboard-card-header-row">
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
            <p className="dashboard-muted" style={{ margin: "4px 0 0" }}>{emptyTitle}</p>
          </div>
        </header>
        <button
          type="button"
          className="dashboard-link-btn"
          style={{ marginTop: 12, color: accentColor, fontWeight: 700 }}
          onClick={() => navigate(route)}
        >
          {emptyCta}
        </button>
      </section>
    );
  }

  return (
    <section className="dashboard-card">
      <header className="dashboard-card-header-row">
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <p className="dashboard-muted" style={{ margin: "4px 0 0" }}>{state.label}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="dashboard-link-btn" onClick={() => void load()} aria-label="רענון">
            <RefreshCw size={14} />
          </button>
          <button type="button" className="dashboard-link-btn" onClick={() => navigate(route)}>
            לניתוח מלא
          </button>
        </div>
      </header>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 12 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: `conic-gradient(${accentColor} ${state.score * 3.6}deg, rgba(184,157,255,0.2) 0)`,
          fontWeight: 800, fontSize: 20, color: accentColor,
        }}>
          {state.score}
        </div>
        <div>
          {state.metric}
          <div style={{ fontSize: 12, color: "#7C6FA0", marginTop: 4 }}>{footerNote}</div>
        </div>
      </div>
    </section>
  );
}
