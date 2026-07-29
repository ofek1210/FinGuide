import { PreviewAuthProvider } from "../auth/AuthProvider";
import SmartOnboardingPage from "./SmartOnboardingPage";

/** Dev-only preview of the post-register smart onboarding UI. */
export default function SmartOnboardingPreview() {
  return (
    <PreviewAuthProvider>
      <SmartOnboardingPage previewMode />
    </PreviewAuthProvider>
  );
}
