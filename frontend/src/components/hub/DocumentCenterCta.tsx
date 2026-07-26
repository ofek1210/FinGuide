import { useNavigate } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { hubDocumentUrl, type HubDocumentId } from "../../utils/hubDocuments";

type Props = {
  documentId?: HubDocumentId;
  label?: string;
  variant?: "primary" | "ghost";
};

export default function DocumentCenterCta({
  documentId = "clearinghouse",
  label = "למרכז המסמכים",
  variant = "primary",
}: Props) {
  const navigate = useNavigate();
  const isPrimary = variant === "primary";

  return (
    <button
      type="button"
      onClick={() => navigate(hubDocumentUrl(documentId))}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: isPrimary ? "13px 22px" : "10px 16px",
        borderRadius: "var(--r-md)",
        border: isPrimary ? "none" : "1px solid var(--border-soft)",
        background: isPrimary ? "var(--ink)" : "var(--card)",
        color: isPrimary ? "#fff" : "var(--ink)",
        cursor: "pointer",
        fontFamily: "inherit",
        fontWeight: 800,
        fontSize: isPrimary ? 15 : 13.5,
        boxShadow: isPrimary ? "var(--shadow-ink)" : "var(--shadow-soft)",
      }}
    >
      <FolderOpen size={16} />
      {label}
    </button>
  );
}
