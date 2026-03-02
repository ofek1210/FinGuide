import { useEffect, useState } from "react";
import {
  formatCurrency,
  normalizeAmount,
  parseNumericInput,
} from "../utils/numeric";

type NumericInputProps = {
  label?: string;
  placeholder?: string;
  currency?: string;
  locale?: string;
  value?: number | null;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
  onValueChange?: (value: number | null) => void;
  onDisplayChange?: (value: string) => void;
};

const sanitizeInput = (value: string) => {
  let sanitized = value.replace(/[^0-9.,₪$€\-\s]/g, "");
  sanitized = sanitized.replace(/(?!^)-/g, "");
  return sanitized;
};

export default function NumericInput({
  label,
  placeholder,
  currency,
  locale,
  value,
  disabled,
  name,
  id,
  className,
  onValueChange,
  onDisplayChange,
}: NumericInputProps) {
  const [displayValue, setDisplayValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (value === null || value === undefined) {
      return;
    }
    const normalized = normalizeAmount(value);
    setDisplayValue(
      formatCurrency(normalized, { currency, locale })
    );
  }, [value, currency, locale]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = sanitizeInput(event.target.value);
    setDisplayValue(nextValue);
    setError(null);
    onDisplayChange?.(nextValue);
  };

  const handleBlur = () => {
    if (!displayValue.trim()) {
      onValueChange?.(null);
      setError(null);
      return;
    }

    try {
      const parsed = parseNumericInput(displayValue);
      const normalized = normalizeAmount(parsed);
      setDisplayValue(
        formatCurrency(normalized, { currency, locale })
      );
      setError(null);
      onValueChange?.(normalized);
      onDisplayChange?.(
        formatCurrency(normalized, { currency, locale })
      );
    } catch (err) {
      setError("ערך מספרי לא תקין");
      onValueChange?.(null);
    }
  };

  return (
    <label className={className}>
      {label && <span>{label}</span>}
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        aria-invalid={Boolean(error)}
      />
      {error && <span className="numeric-input-error">{error}</span>}
    </label>
  );
}
