import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Slice = { name: string; value: number; color: string };

type Props = { data: Slice[] };

export default function TaxBreakdownChart({ data }: Props) {
  const filtered = data.filter(d => d.value > 0);
  if (!filtered.length) {
    return <p className="chart-empty">אין נתוני מס להצגה.</p>;
  }

  return (
    <div className="dashboard-chart" dir="ltr">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={filtered} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {filtered.map(entry => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `₪${Number(v ?? 0).toLocaleString("he-IL")}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
