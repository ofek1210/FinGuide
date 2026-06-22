import DashboardDomainHealthCard from "./DashboardDomainHealthCard";
import { getInsuranceAnalysis } from "../../api/insuranceAI.api";
import { APP_ROUTES } from "../../types/navigation";

export default function DashboardInsuranceHealthCard() {
  return (
    <DashboardDomainHealthCard
      title="בריאות ביטוח"
      loadingLabel="טוען בריאות ביטוח..."
      errorFallback="שגיאה בטעינת נתוני ביטוח"
      accentColor="#7B5EA7"
      route={APP_ROUTES.insurance}
      footerNote="מבוסס על ייבוא הר הביטוח — אינו ייעוץ ביטוחי"
      emptyTitle="עדיין לא יובא דוח מהר הביטוח"
      emptyCta="ייבוא מהר הביטוח"
      load={async () => {
        const res = await getInsuranceAnalysis();
        if (!res.ok) throw new Error(res.error.message);
        if (!res.data?.success || !res.data.data) {
          return { hasData: false, score: null, label: null, metric: null };
        }
        const payload = res.data.data;
        if (!payload.hasImportedPolicies && !(payload.policies?.length)) {
          return { hasData: false, score: null, label: null, metric: null };
        }
        const waste = payload.analysis?.totalMonthlyWaste;
        return {
          hasData: true,
          score: payload.healthCheck?.score ?? null,
          label: payload.healthCheck?.level?.label ?? null,
          metric: waste != null && waste > 0 ? (
            <div style={{ fontWeight: 700, color: "#DC2626", fontSize: 14 }}>
              ~₪{waste.toLocaleString("he-IL")}/חודש בזבוז מכפילויות
            </div>
          ) : null,
        };
      }}
    />
  );
}
