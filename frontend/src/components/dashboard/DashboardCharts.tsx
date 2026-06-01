import { useMemo } from "react";
import { usePayslipHistory } from "../../hooks/usePayslipHistory";
import SalaryTrendChart from "./charts/SalaryTrendChart";
import PensionTrendChart from "./charts/PensionTrendChart";
import TaxBreakdownChart from "./charts/TaxBreakdownChart";
import MonthlyChangesChart from "./charts/MonthlyChangesChart";
import Loader from "../ui/Loader";

export default function DashboardCharts() {
  const { data, isLoading, error } = usePayslipHistory();

  const chartData = useMemo(() => {
    const items = [...(data?.items ?? [])].reverse();
    const salaryTrend = items.map(item => ({
      label: item.periodLabel,
      gross: item.grossSalary,
      net: item.netSalary,
    }));

    const pensionTrend = items.map(item => ({
      label: item.periodLabel,
      employee: item.pensionEmployee ?? null,
      employer: item.pensionEmployer ?? null,
      severance: item.pensionSeverance ?? null,
    }));

    const monthlyChanges = items.slice(1).map((item, idx) => {
      const prev = items[idx];
      const change =
        prev.netSalary && item.netSalary
          ? Math.round(((item.netSalary - prev.netSalary) / prev.netSalary) * 100)
          : 0;
      return { label: item.periodLabel, change };
    });

    const latest = items[items.length - 1];
    const taxBreakdown = latest
      ? [
          { name: "מס הכנסה", value: latest.tax ?? 0, color: "#7c3aed" },
          { name: "ביטוח לאומי", value: latest.nationalInsurance ?? 0, color: "#2563eb" },
          { name: "בריאות", value: latest.healthInsurance ?? 0, color: "#059669" },
        ]
      : [];

    return { salaryTrend, pensionTrend, monthlyChanges, taxBreakdown };
  }, [data]);

  if (isLoading) {
    return (
      <section className="dashboard-card dashboard-charts-section">
        <Loader />
      </section>
    );
  }

  if (error) {
    return (
      <section className="dashboard-card dashboard-charts-section">
        <p className="dashboard-inline-error">{error}</p>
      </section>
    );
  }

  return (
    <section className="dashboard-charts-section">
      <h2 className="dashboard-section-title">מגמות פיננסיות</h2>
      <div className="dashboard-charts-grid">
        <div className="dashboard-card">
          <h3>שכר לאורך זמן</h3>
          <SalaryTrendChart data={chartData.salaryTrend} />
        </div>
        <div className="dashboard-card">
          <h3>פנסיה לאורך זמן</h3>
          <PensionTrendChart data={chartData.pensionTrend} />
        </div>
        <div className="dashboard-card">
          <h3>פילוח מס (תלוש אחרון)</h3>
          <TaxBreakdownChart data={chartData.taxBreakdown} />
        </div>
        <div className="dashboard-card">
          <h3>שינוי נטו חודשי</h3>
          <MonthlyChangesChart data={chartData.monthlyChanges} />
        </div>
      </div>
    </section>
  );
}
