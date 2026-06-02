import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { label: string; gross: number | null; net: number | null };

type Props = { data: Point[] };

export default function SalaryTrendChart({ data }: Props) {
  if (!data.length) {
    return <p className="chart-empty">אין מספיק נתונים להצגת מגמת שכר.</p>;
  }

  return (
    <div className="dashboard-chart" dir="ltr">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => [`₪${Number(v ?? 0).toLocaleString("he-IL")}`, ""]} />
          <Legend />
          <Line type="monotone" dataKey="gross" name="ברוטו" stroke="#FAFF00" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="net" name="נטו" stroke="#00FFD0" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
