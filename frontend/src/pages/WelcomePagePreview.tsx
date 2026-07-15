import WelcomePage from "./WelcomePage";
import { PreviewAuthProvider } from "../auth/AuthProvider";

/** Dev-only full-page preview of /welcome (new-user CEO greeting). */
export default function WelcomePagePreview() {
  return (
    <PreviewAuthProvider>
      <WelcomePage />
    </PreviewAuthProvider>
  );
}
