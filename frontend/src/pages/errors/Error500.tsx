import ErrorLayout from "./ErrorLayout";
import { APP_ROUTES } from "../../types/navigation";

export default function Error500() {
  return (
    <ErrorLayout
      title="500"
      message="משהו השתבש בשרת. נסו שוב מאוחר יותר."
      actionLabel="חזרה לדף הבית"
      actionTo={APP_ROUTES.home}
    />
  );
}
