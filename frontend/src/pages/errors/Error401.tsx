import ErrorLayout from "./ErrorLayout";
import { APP_ROUTES } from "../../types/navigation";

export default function Error401() {
  return (
    <ErrorLayout
      title="401"
      message="כדי להמשיך יש להתחבר לחשבון שלכם."
      actionLabel="מעבר להתחברות"
      actionTo={APP_ROUTES.login}
    />
  );
}
