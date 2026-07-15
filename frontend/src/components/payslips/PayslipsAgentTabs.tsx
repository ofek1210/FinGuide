import { useNavigate, useLocation } from "react-router-dom";
import { FileText, Scale } from "lucide-react";
import { APP_ROUTES } from "../../types/navigation";

type TabId = "payslips" | "tax";

const TABS: { id: TabId; label: string; route: string; Icon: typeof FileText }[] = [
  { id: "payslips", label: "ניתוח תלושים", route: APP_ROUTES.documents, Icon: FileText },
  { id: "tax", label: "עוזר מס", route: APP_ROUTES.taxAssistant, Icon: Scale },
];

export default function PayslipsAgentTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active: TabId = pathname === APP_ROUTES.taxAssistant ? "tax" : "payslips";

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "16px 24px 0" }}>
      <div style={{
        display: "inline-flex",
        gap: 6,
        padding: 5,
        borderRadius: "var(--r-pill)",
        background: "var(--surface-sunken)",
        border: "1px solid var(--border-hair)",
      }}
      >
        {TABS.map(tab => {
          const isActive = active === tab.id;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.route)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 18px",
                borderRadius: "var(--r-pill)",
                border: "none",
                background: isActive ? "var(--card)" : "transparent",
                color: isActive ? "var(--lav-600)" : "var(--text-muted)",
                boxShadow: isActive ? "var(--shadow-soft)" : "none",
                fontFamily: "inherit",
                fontSize: 13.5,
                fontWeight: 800,
                cursor: "pointer",
                transition: "all var(--dur-fast) var(--ease)",
              }}
            >
              <Icon size={15} strokeWidth={2} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
