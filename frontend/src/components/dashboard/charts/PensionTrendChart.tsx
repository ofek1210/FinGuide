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
          <Area type="monotone" dataKey="employee" name="עובד" stackId="1" stroke="#FF00A8" fill="#FF00A833" />
          <Area type="monotone" dataKey="employer" name="מעסיק" stackId="1" stroke="#00FFD0" fill="#00FFD033" />
          <Area type="monotone" dataKey="severance" name="פיצויים" stackId="1" stroke="#5C2EFF" fill="#5C2EFF33" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
