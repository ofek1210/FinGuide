import { Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import AuthScreen from "./components/AuthScreen";
import DashboardPlaceholder from "./components/DashboardPlaceholder";
import { RequireAuth, RequireGuest } from "./components/RouteGuards";
import BackButton from "./components/BackButton";
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
              <DashboardPlaceholder />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}
