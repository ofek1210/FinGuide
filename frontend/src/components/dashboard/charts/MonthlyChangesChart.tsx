import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { label: string; change: number };

type Props = { data: Point[] };

export default function MonthlyChangesChart({ data }: Props) {
  if (!data.length) {
    return <p className="chart-empty">אין שינויים חודשיים להצגה.</p>;
  }

  return (
    <div className="dashboard-chart" dir="ltr">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={(v) => [`${Number(v ?? 0)}%`, "שינוי נטו"]} />
          <Legend />
          <Bar dataKey="change" name="שינוי נטו (%)" fill="#FAFF00" radius={[0, 0, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
