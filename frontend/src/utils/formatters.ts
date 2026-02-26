const CURRENCY_LOCALE = "he-IL";
const CURRENCY_CODE = "ILS";

export const formatCurrencyILS = (value: number) =>
  new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency: CURRENCY_CODE,
    maximumFractionDigits: 0,
  }).format(value);

export const formatNumber = (value: number) =>
  new Intl.NumberFormat(CURRENCY_LOCALE).format(value);

export const formatShortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(CURRENCY_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export const formatLongDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(CURRENCY_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

export const formatFileSize = (bytes?: number) => {
  if (bytes === undefined || bytes === null) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};
