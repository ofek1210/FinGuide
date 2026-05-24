import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = {
  label: string;
  employee: number | null;
  employer: number | null;
  severance: number | null;
};

type Props = { data: Point[] };

export default function PensionTrendChart({ data }: Props) {
  if (!data.length) {
    return <p className="chart-empty">אין נתוני פנסיה להצגה.</p>;
  }

  return (
    <div className="dashboard-chart" dir="ltr">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => [`₪${Number(v ?? 0).toLocaleString("he-IL")}`, ""]} />
          <Legend />
          <Area type="monotone" dataKey="employee" name="עובד" stackId="1" stroke="#7c3aed" fill="#7c3aed33" />
          <Area type="monotone" dataKey="employer" name="מעסיק" stackId="1" stroke="#2563eb" fill="#2563eb33" />
          <Area type="monotone" dataKey="severance" name="פיצויים" stackId="1" stroke="#d97706" fill="#d9770633" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
