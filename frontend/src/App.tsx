import { useState } from "react";
import AuthScreen from "./components/AuthScreen";
import type { Page } from "./types/navigation";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("auth");

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  return (
    <div className="min-h-screen">
      {currentPage === "auth" && <AuthScreen onNavigate={handleNavigate} />}
      {currentPage === "dashboard" && (
        <div className="auth-page">
          <div className="auth-shell">
            <section className="auth-card">
              <header className="auth-card-header">
                <h1>התחברות הושלמה</h1>
                <p>הדאשבורד יתחבר כאן בהמשך.</p>
              </header>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
