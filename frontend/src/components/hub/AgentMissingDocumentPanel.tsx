import DocumentCenterCta from "./DocumentCenterCta";
import type { HubDocumentId } from "../../utils/hubDocuments";

type Props = {
  title: string;
  body: string;
  documentId: HubDocumentId;
};

export default function AgentMissingDocumentPanel({ title, body, documentId }: Props) {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 84px", textAlign: "center" }}>
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border-hair)",
        borderRadius: "var(--radius)",
        padding: "40px 28px",
        boxShadow: "var(--shadow-soft)",
      }}
      >
        <h1 style={{ margin: "0 0 12px", fontSize: "clamp(24px,3vw,32px)", fontWeight: 900, color: "var(--text-strong)" }}>
          {title}
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 15, lineHeight: 1.65, color: "var(--text-muted)", maxWidth: 480, marginInline: "auto" }}>
          {body}
        </p>
        <DocumentCenterCta documentId={documentId} />
      </div>
    </main>
  );
}
