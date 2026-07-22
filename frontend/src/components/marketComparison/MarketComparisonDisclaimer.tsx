type Props = {
  sourceLabel: string;
};

export default function MarketComparisonDisclaimer({ sourceLabel }: Props) {
  return (
    <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-faint)", lineHeight: 1.65 }}>
      <p style={{ margin: "0 0 6px" }}>מקור: {sourceLabel}</p>
      <p style={{ margin: "0 0 6px" }}>
        ההשוואה מבוססת על נתוני עבר רשמיים ואינה מהווה ייעוץ פנסיוני, ייעוץ השקעות או המלצה לביצוע פעולה.
      </p>
      <p style={{ margin: 0 }}>תשואות עבר אינן מבטיחות תשואות עתידיות.</p>
    </div>
  );
}
