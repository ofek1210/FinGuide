import DashboardDomainHealthCard from "./DashboardDomainHealthCard";
import { getPensionAnalysis } from "../../api/pension.api";
import { APP_ROUTES } from "../../types/navigation";

export default function DashboardPensionHealthCard() {
  return (
    <DashboardDomainHealthCard
      title="בריאות פנסיונית"
      loadingLabel="טוען בריאות פנסיונית..."
      errorFallback="שגיאה בטעינת נתוני פנסיה"
      accentColor="#6B4FA0"
      route={APP_ROUTES.pension}
      footerNote="מבוסס על ייבוא הר הכסף / דוח תקופתי — אינו ייעוץ פנסיוני"
      emptyTitle="עדיין לא יובא דוח מהר הכסף"
      emptyCta="ייבוא מהר הכסף"
      load={async () => {
        const res = await getPensionAnalysis();
        if (!res.ok) throw new Error(res.error.message);
        if (!res.data?.success || !res.data.data?.summary?.hasData) {
          return { hasData: false, score: null, label: null, metric: null };
        }
        const { healthCheck, benchmark } = res.data.data;
        const savings = benchmark?.summary?.totalPotentialSavings;
        return {
          hasData: true,
          score: healthCheck?.score ?? null,
          label: healthCheck?.level?.label ?? null,
          metric: savings != null && savings > 0 ? (
            <div style={{ fontWeight: 700, color: "#059669", fontSize: 14 }}>
              ₪{savings.toLocaleString("he-IL")} חיסכון פוטנציאלי עד פרישה
            </div>
          ) : null,
        };
      }}
    />
  );
}
