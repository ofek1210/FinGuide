import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import HubPage from "./pages/HubPage";
import AuthScreen from "./components/AuthScreen";
import { RequireAuth, RequireGuest } from "./components/RouteGuards";
import BackButton from "./components/BackButton";
import FloatingAssistant from "./components/FloatingAssistant";
import PayslipsAgentPage from "./pages/PayslipsAgentPage";
import ScanStatusPage from "./pages/ScanStatusPage";
import ScanCompletePage from "./pages/ScanCompletePage";
import PayslipHistoryPage from "./pages/PayslipHistoryPage";
import PayslipDetailPage from "./pages/PayslipDetailPage";
import PayslipMissingFieldsPage from "./pages/PayslipMissingFieldsPage";
import InsightsPage from "./pages/InsightsPage";
import FinancialPlanningPage from "./pages/FinancialPlanningPage";
import InsurancePage from "./pages/InsurancePage";
import NotificationsPage from "./pages/NotificationsPage";
import AIAgentsPage from "./pages/AIAgentsPage";
import FinancialHealthPage from "./pages/FinancialHealthPage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import IntegrationsEmailPage from "./pages/IntegrationsEmailPage";
import DocumentDetailsPage from "./pages/DocumentDetailsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OnboardingPage from "./pages/OnboardingPage";
import WelcomePage from "./pages/WelcomePage";
import WelcomeBackPage from "./pages/WelcomeBackPage";
import WelcomePagePreview from "./pages/WelcomePagePreview";
import PensionPage from "./pages/PensionPage";
import GemelPage from "./pages/GemelPage";
import TeamPage from "./pages/TeamPage";
import ContactPage from "./pages/ContactPage";
import FAQPage from "./pages/FAQPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import Error400 from "./pages/errors/Error400";
import Error401 from "./pages/errors/Error401";
import Error403 from "./pages/errors/Error403";
import Error404 from "./pages/errors/Error404";
import Error500 from "./pages/errors/Error500";
import { APP_ROUTES } from "./types/navigation";
import "./App.css";
import "./theme/overrides.css";
import "./theme/marketing.css";

export default function App() {
  return (
    <>
      <BackButton />
      <Routes>
        <Route
          path={APP_ROUTES.home}
          element={
            <RequireGuest>
              <LandingPage />
            </RequireGuest>
          }
        />
        <Route
          path={APP_ROUTES.login}
          element={
            <RequireGuest>
              <AuthScreen mode="login" />
            </RequireGuest>
          }
        />
        <Route
          path={APP_ROUTES.register}
          element={
            <RequireGuest>
              <AuthScreen mode="register" />
            </RequireGuest>
          }
        />
        <Route path={APP_ROUTES.resetPassword} element={<ResetPasswordPage />} />
        <Route
          path={APP_ROUTES.hub}
          element={
            <RequireAuth>
              <HubPage />
            </RequireAuth>
          }
        />
        {/* legacy — the dashboard page was removed; keep old URLs working */}
        <Route path="/dashboard" element={<Navigate to={APP_ROUTES.hub} replace />} />
        <Route
          path={APP_ROUTES.onboarding}
          element={
            <RequireAuth>
              <OnboardingPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.welcome}
          element={
            <RequireAuth>
              <WelcomePage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.welcomeBack}
          element={
            <RequireAuth>
              <WelcomeBackPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.documents}
          element={
            <RequireAuth>
              <PayslipsAgentPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.taxAssistant}
          element={
            <RequireAuth>
              <PayslipsAgentPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.expenses}
          element={
            <RequireAuth>
              <PayslipsAgentPage />
            </RequireAuth>
          }
        />
        <Route path="/tax-assistant" element={<Navigate to={APP_ROUTES.taxAssistant} replace />} />
        <Route path="/expenses" element={<Navigate to={APP_ROUTES.expenses} replace />} />
        <Route
          path="/documents/:id"
          element={
            <RequireAuth>
              <DocumentDetailsPage />
            </RequireAuth>
          }
        />
        {/* legacy — the findings page was removed; keep old URLs working */}
        <Route path="/findings" element={<Navigate to={APP_ROUTES.hub} replace />} />
        <Route
          path={APP_ROUTES.financialHealth}
          element={
            <RequireAuth>
              <FinancialHealthPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.copilot}
          element={
            <RequireAuth>
              <Navigate to={APP_ROUTES.planning} replace />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.insights}
          element={
            <RequireAuth>
              <InsightsPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.planning}
          element={
            <RequireAuth>
              <FinancialPlanningPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.insurance}
          element={
            <RequireAuth>
              <InsurancePage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.pension}
          element={
            <RequireAuth>
              <PensionPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.gemel}
          element={
            <RequireAuth>
              <GemelPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.notifications}
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.assistant}
          element={
            <RequireAuth>
              <AIAgentsPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.aiAgents}
          element={
            <RequireAuth>
              <Navigate to={APP_ROUTES.assistant} replace />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.settings}
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.integrationsEmail}
          element={
            <RequireAuth>
              <IntegrationsEmailPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.help}
          element={
            <RequireAuth>
              <HelpPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.documentsScan}
          element={
            <RequireAuth>
              <ScanStatusPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.documentsScanComplete}
          element={
            <RequireAuth>
              <ScanCompletePage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.payslipHistory}
          element={
            <RequireAuth>
              <PayslipHistoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/documents/history/:id"
          element={
            <RequireAuth>
              <PayslipDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/documents/history/:id/missing"
          element={
            <RequireAuth>
              <PayslipMissingFieldsPage />
            </RequireAuth>
          }
        />
        <Route path={APP_ROUTES.team} element={<TeamPage />} />
        <Route path={APP_ROUTES.contact} element={<ContactPage />} />
        <Route path={APP_ROUTES.faq} element={<FAQPage />} />
        <Route path={APP_ROUTES.privacy} element={<PrivacyPage />} />
        <Route path={APP_ROUTES.terms} element={<TermsPage />} />
        <Route path="/careers/*" element={<Navigate to={APP_ROUTES.home} replace />} />
        <Route path="/400" element={<Error400 />} />
        <Route path="/401" element={<Error401 />} />
        <Route path="/403" element={<Error403 />} />
        <Route path="/500" element={<Error500 />} />
        {import.meta.env.DEV ? (
          <Route path="/dev/welcome" element={<WelcomePagePreview />} />
        ) : null}
        <Route path="*" element={<Error404 />} />
      </Routes>
      <FloatingAssistant />
    </>
  );
}
