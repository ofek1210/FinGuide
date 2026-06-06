import { Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import AuthScreen from "./components/AuthScreen";
import DashboardPage from "./pages/DashboardPage";
import { RequireAuth, RequireGuest } from "./components/RouteGuards";
import BackButton from "./components/BackButton";
import ThemeToggle from "./components/ThemeToggle";
import DocumentsPage from "./pages/DocumentsPage";
import ScanStatusPage from "./pages/ScanStatusPage";
import ScanCompletePage from "./pages/ScanCompletePage";
import PayslipHistoryPage from "./pages/PayslipHistoryPage";
import PayslipDetailPage from "./pages/PayslipDetailPage";
import PayslipMissingFieldsPage from "./pages/PayslipMissingFieldsPage";
import InsightsPage from "./pages/InsightsPage";
import InsurancePage from "./pages/InsurancePage";
import NotificationsPage from "./pages/NotificationsPage";
import AssistantPage from "./pages/AssistantPage";
import FindingsPage from "./pages/FindingsPage";
import TaxAssistantPage from "./pages/TaxAssistantPage";
import FinancialHealthPage from "./pages/FinancialHealthPage";
import FinancialCopilotPage from "./pages/FinancialCopilotPage";
import SettingsPage from "./pages/SettingsPage";
import HelpPage from "./pages/HelpPage";
import IntegrationsEmailPage from "./pages/IntegrationsEmailPage";
import DocumentDetailsPage from "./pages/DocumentDetailsPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import OnboardingPage from "./pages/OnboardingPage";
import WelcomePage from "./pages/WelcomePage";
import WelcomeBackPage from "./pages/WelcomeBackPage";
import TeamPage from "./pages/TeamPage";
import ContactPage from "./pages/ContactPage";
import FAQPage from "./pages/FAQPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import CareersPage from "./pages/CareersPage";
import JobDetailsPage from "./pages/JobDetailsPage";
import Error400 from "./pages/errors/Error400";
import Error401 from "./pages/errors/Error401";
import Error403 from "./pages/errors/Error403";
import Error404 from "./pages/errors/Error404";
import Error500 from "./pages/errors/Error500";
import { APP_ROUTES } from "./types/navigation";
import "./App.css";

export default function App() {
  return (
    <>
      <BackButton />
      <ThemeToggle />
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
          path={APP_ROUTES.dashboard}
          element={
            <RequireAuth>
              <DashboardPage />
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
          path={APP_ROUTES.onboarding}
          element={
            <RequireAuth>
              <OnboardingPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.documents}
          element={
            <RequireAuth>
              <DocumentsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/documents/:id"
          element={
            <RequireAuth>
              <DocumentDetailsPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.findings}
          element={
            <RequireAuth>
              <FindingsPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_ROUTES.taxAssistant}
          element={
            <RequireAuth>
              <TaxAssistantPage />
            </RequireAuth>
          }
        />
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
              <FinancialCopilotPage />
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
          path={APP_ROUTES.insurance}
          element={
            <RequireAuth>
              <InsurancePage />
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
              <AssistantPage />
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
        <Route path={APP_ROUTES.careers} element={<CareersPage />} />
        <Route path="/careers/:slug" element={<JobDetailsPage />} />
        <Route path="/400" element={<Error400 />} />
        <Route path="/401" element={<Error401 />} />
        <Route path="/403" element={<Error403 />} />
        <Route path="/500" element={<Error500 />} />
        <Route path="*" element={<Error404 />} />
      </Routes>
    </>
  );
}
