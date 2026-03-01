import ErrorLayout from "./ErrorLayout";
import { APP_ROUTES } from "../../types/navigation";

export default function Error400() {
  return (
    <ErrorLayout
      title="400"
      message="הבקשה לא תקינה. בדקו את הפרטים ונסו שוב."
      actionLabel="חזרה לדף הבית"
      actionTo={APP_ROUTES.home}
    />
  );
}
