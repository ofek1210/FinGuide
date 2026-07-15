import { Navigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

/** @deprecated — expenses live inside PayslipsAgentPage at /documents/expenses */
export default function ExpensesPage() {
  return <Navigate to={APP_ROUTES.expenses} replace />;
}
