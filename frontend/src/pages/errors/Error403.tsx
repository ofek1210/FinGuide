import ErrorLayout from "./ErrorLayout";
import { APP_ROUTES } from "../../types/navigation";

export default function Error403() {
  return (
    <ErrorLayout
      title="403"
      message="אין לך הרשאה לצפות בעמוד הזה."
      actionLabel="חזרה לדף הבית"
      actionTo={APP_ROUTES.home}
    />
  );
}
