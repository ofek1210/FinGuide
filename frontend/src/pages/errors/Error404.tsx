import ErrorLayout from "./ErrorLayout";
import { APP_ROUTES } from "../../types/navigation";

export default function Error404() {
  return (
    <ErrorLayout
      title="404"
      message="העמוד שחיפשת לא קיים."
      actionLabel="חזרה לדף הבית"
      actionTo={APP_ROUTES.home}
    />
  );
}
