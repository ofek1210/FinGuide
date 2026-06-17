import type { DocumentItem } from "../api/documents.api";

export const getDocumentImportSourceLabel = (doc: Pick<DocumentItem, "source" | "metadata">) => {
  if (doc.source === "gmail" || doc.metadata?.source === "gmail") {
    return "יובא מ-Gmail";
  }
  return "הועלה ידנית";
};
