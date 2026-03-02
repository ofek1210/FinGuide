import { useState } from "react";
import NumericInput from "./NumericInput";
import { formatCurrency } from "../utils/numeric";

type BackendResult = {
  raw: string | number;
  parsed: number;
  normalized: number;
};

export default function NumericDevPanel() {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<number | null>(null);
  const [normalized, setNormalized] = useState<number | null>(null);
  const [backendResult, setBackendResult] = useState<BackendResult | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValueChange = (value: number | null) => {
    setParsed(value);
    setNormalized(value);
  };

  const handleSubmit = async () => {
    if (!raw.trim()) {
      return;
    }

    setIsSubmitting(true);
    setBackendError(null);
    setBackendResult(null);

    try {
      const response = await fetch("/api/dev/normalize-number", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: raw }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setBackendError(
          (payload && payload.message) || "שגיאה בעיבוד הנתון"
        );
        return;
      }

      setBackendResult(payload);
    } catch {
      setBackendError("שגיאת רשת");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="dev-panel">
      <h3>Numeric Dev Panel</h3>
      <NumericInput
        label="ערך לבדיקת נרמול"
        placeholder="₪1,234.50"
        onDisplayChange={setRaw}
        onValueChange={handleValueChange}
        className="dev-field"
      />
      <div className="dev-results">
        <div>
          <strong>Raw:</strong> {raw || "—"}
        </div>
        <div>
          <strong>Parsed:</strong>{" "}
          {parsed !== null ? parsed : "—"}
        </div>
        <div>
          <strong>Normalized:</strong>{" "}
          {normalized !== null ? normalized : "—"}
        </div>
        <div>
          <strong>Formatted:</strong>{" "}
          {normalized !== null ? formatCurrency(normalized) : "—"}
        </div>
      </div>
      <button
        type="button"
        className="dev-submit"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? "שולח..." : "בדיקה מול השרת"}
      </button>
      {backendError && <p className="dev-error">{backendError}</p>}
      {backendResult && (
        <div className="dev-backend">
          <div>
            <strong>Backend raw:</strong> {backendResult.raw}
          </div>
          <div>
            <strong>Backend parsed:</strong> {backendResult.parsed}
          </div>
          <div>
            <strong>Backend normalized:</strong>{" "}
            {backendResult.normalized}
          </div>
        </div>
      )}
    </section>
  );
}
