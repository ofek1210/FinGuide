import { Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import AuthScreen from "./components/AuthScreen";
import DashboardPage from "./pages/DashboardPage";
import { RequireAuth, RequireGuest } from "./components/RouteGuards";
import BackButton from "./components/BackButton";
import DocumentsPage from "./pages/DocumentsPage";
import FindingsPage from "./pages/FindingsPage";
import AssistantPage from "./pages/AssistantPage";
import SettingsPage from "./pages/SettingsPage";
import IntegrationsEmailPage from "./pages/IntegrationsEmailPage";
import StatusPage from "./pages/StatusPage";
import HelpPage from "./pages/HelpPage";
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
        <Route
          path={APP_ROUTES.dashboard}
          element={
            <RequireAuth>
              <DashboardPage />
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
          path={APP_ROUTES.findings}
          element={
            <RequireAuth>
              <FindingsPage />
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
          path={APP_ROUTES.status}
          element={
            <RequireAuth>
              <StatusPage />
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
        <Route path={APP_ROUTES.error400} element={<Error400 />} />
        <Route path={APP_ROUTES.error401} element={<Error401 />} />
        <Route path={APP_ROUTES.error403} element={<Error403 />} />
        <Route path={APP_ROUTES.error500} element={<Error500 />} />
        <Route path="*" element={<Error404 />} />
      </Routes>
    </>
  );
}
