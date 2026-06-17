import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { label: string; value: number; color: string };

type Props = { data: Row[] };

export default function DeductionsBreakdownChart({ data }: Props) {
  const filtered = data.filter(d => d.value > 0);
  if (!filtered.length) {
    return <p className="chart-empty">אין נתוני ניכויים להצגה.</p>;
  }

  return (
    <div className="dashboard-chart" dir="ltr">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={filtered} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={v => `₪${Number(v).toLocaleString("he-IL")}`}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={90}
            tick={{ fontSize: 12, direction: "rtl" }}
          />
          <Tooltip
            formatter={(v) => [`₪${Number(v ?? 0).toLocaleString("he-IL")}`, "סכום"]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {filtered.map(entry => (
              <Cell key={entry.label} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
