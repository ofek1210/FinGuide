import { useNavigate } from "react-router-dom";

interface ErrorLayoutProps {
  title: string;
  message: string;
  actionLabel: string;
  actionTo: string;
}

export default function ErrorLayout({
  title,
  message,
  actionLabel,
  actionTo,
}: ErrorLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="auth-page">
      <section className="auth-card error-card">
        <header className="auth-card-header">
          <h1 className="error-title">{title}</h1>
          <p>{message}</p>
        </header>
        <button
          className="auth-button"
          type="button"
          onClick={() => navigate(actionTo)}
        >
          {actionLabel}
        </button>
      </section>
    </div>
  );
}
