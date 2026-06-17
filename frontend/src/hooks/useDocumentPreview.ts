import { useEffect, useState } from "react";
import { downloadDocument } from "../api/documents.api";

export const useDocumentPreview = (documentId?: string) => {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!documentId) {
      setUrl("");
      setError("");
      return undefined;
    }

    let objectUrl = "";
    let cancelled = false;
    setIsLoading(true);
    setError("");

    (async () => {
      const response = await downloadDocument(documentId);
      if (cancelled) return;
      if (response.success && response.blob) {
        objectUrl = URL.createObjectURL(response.blob);
        setUrl(objectUrl);
      } else {
        setUrl("");
        setError(response.message || "לא הצלחנו לטעון את תצוגת התלוש.");
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId]);

  return { url, isLoading, error };
};
