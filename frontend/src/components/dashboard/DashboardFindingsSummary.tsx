import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Loader from "../ui/Loader";
import { listFindings } from "../../api/findings.api";
import { APP_ROUTES } from "../../types/navigation";

export default function DashboardFindingsSummary() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listFindings();
    setLoading(false);
    if (!res.success) {
      setError("לא הצלחנו לטעון ממצאים");
      return;
    }
    const items = res.data ?? [];
    setCount(items.length);
    setWarningCount(items.filter(f => f.severity === "warning").length);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="dashboard-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Loader />
        <span className="dashboard-muted">טוען ממצאים...</span>
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

  return (
    <section className="dashboard-card">
      <header className="dashboard-card-header-row">
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>ממצאים פתוחים</h3>
          <p className="dashboard-muted" style={{ margin: "4px 0 0" }}>
            {count === 0
              ? "אין ממצאים פתוחים כרגע"
              : `${count} ממצאים${warningCount > 0 ? ` · ${warningCount} דורשים תשומת לב` : ""}`}
          </p>
        </div>
        <button type="button" className="dashboard-link-btn" onClick={() => navigate(APP_ROUTES.findings)}>
          {count > 0 ? "לכל הממצאים" : "לממצאים"}
        </button>
      </header>
    </section>
  );
}
