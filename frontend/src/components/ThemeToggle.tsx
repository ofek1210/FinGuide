import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "finguide-theme";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage blocked — fall through
  }
  return "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readTheme());

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const isLight = theme === "light";
  const label = isLight ? "LIGHT" : "DARK";
  const next: Theme = isLight ? "dark" : "light";

  return (
    <button
      type="button"
      className={`theme-toggle ${isLight ? "is-light" : "is-dark"}`}
      aria-label={`Switch to ${next} theme`}
      aria-pressed={isLight}
      onClick={() => setTheme(next)}
    >
      <span className="theme-toggle-thumb" aria-hidden="true" />
      <span className="theme-toggle-label">{label}</span>
    </button>
  );
}
