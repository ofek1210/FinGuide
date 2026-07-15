import { Navigate } from "react-router-dom";
import { APP_ROUTES } from "../types/navigation";

/** @deprecated — tax assistant lives inside PayslipsAgentPage at /documents/tax */
export default function TaxAssistantPage() {
  return <Navigate to={APP_ROUTES.taxAssistant} replace />;
}
