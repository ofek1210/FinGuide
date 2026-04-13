import { Navigate, useParams } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

export default function DocumentDetailsPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to={APP_ROUTES.payslipHistory} replace />;
  }

  return <Navigate to={`${APP_ROUTES.payslipHistory}/${id}`} replace />;
}
