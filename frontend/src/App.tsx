import { Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import AuthScreen from "./components/AuthScreen";
import DashboardPage from "./pages/DashboardPage";
import { RequireAuth, RequireGuest } from "./components/RouteGuards";
import BackButton from "./components/BackButton";
import DocumentsPage from "./pages/DocumentsPage";
import ScanStatusPage from "./pages/ScanStatusPage";
import ScanCompletePage from "./pages/ScanCompletePage";
import PayslipHistoryPage from "./pages/PayslipHistoryPage";
import Error400 from "./pages/errors/Error400";
import Error401 from "./pages/errors/Error401";
import Error403 from "./pages/errors/Error403";
import Error404 from "./pages/errors/Error404";
import Error500 from "./pages/errors/Error500";
import "./App.css";

export default function App() {
  return (
    <>
      <BackButton />
      <Routes>
        <Route
          path="/"
          element={
            <RequireGuest>
              <LandingPage />
            </RequireGuest>
          }
        />
        <Route
          path="/login"
          element={
            <RequireGuest>
              <AuthScreen mode="login" />
            </RequireGuest>
          }
        />
        <Route
          path="/register"
          element={
            <RequireGuest>
              <AuthScreen mode="register" />
            </RequireGuest>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/documents"
          element={
            <RequireAuth>
              <DocumentsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/documents/scan"
          element={
            <RequireAuth>
              <ScanStatusPage />
            </RequireAuth>
          }
        />
        <Route
          path="/documents/scan/complete"
          element={
            <RequireAuth>
              <ScanCompletePage />
            </RequireAuth>
          }
        />
        <Route
          path="/documents/history"
          element={
            <RequireAuth>
              <PayslipHistoryPage />
            </RequireAuth>
          }
        />
        <Route path="/400" element={<Error400 />} />
        <Route path="/401" element={<Error401 />} />
        <Route path="/403" element={<Error403 />} />
        <Route path="/500" element={<Error500 />} />
        <Route path="*" element={<Error404 />} />
      </Routes>
    </>
  );
}
