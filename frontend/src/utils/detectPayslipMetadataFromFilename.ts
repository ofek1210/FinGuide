import type { UploadDocumentPayload } from "../api/documents.api";

const HEBREW_MONTHS: Record<string, number> = {
  ינואר: 1,
  פברואר: 2,
  מרץ: 3,
  מרס: 3,
  אפריל: 4,
  מאי: 5,
  יוני: 6,
  יולי: 7,
  אוגוסט: 8,
  ספטמבר: 9,
  אוקטובר: 10,
  נובמבר: 11,
  דצמבר: 12,
};

/**
 * Infer payslip period metadata from common filename patterns
 * (e.g. 2025-03, 03-2025, ינואר 2025).
 */
export function detectPayslipMetadataFromFilename(file: File): UploadDocumentPayload {
  const name = file.name;
  let periodMonth: number | undefined;
  let periodYear: number | undefined;

  const hebrew = name.match(
    /(ינואר|פברואר|מרץ|מרס|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)[\s_\-.]*(20\d{2})/,
  );
  if (hebrew) {
    periodMonth = HEBREW_MONTHS[hebrew[1]!];
    periodYear = parseInt(hebrew[2]!, 10);
  }

  if (periodMonth === undefined || periodYear === undefined) {
    // Prefer MM-YYYY (paycheck-05-2025-2.pdf) BEFORE YYYY-M, otherwise the
    // trailing download suffix "-2" is misread as February (2025-2).
    const monthFirst = name.match(/(?<!\d)(\d{1,2})[-_.](20\d{2})(?!\d)/);
    if (monthFirst) {
      const month = parseInt(monthFirst[1]!, 10);
      const year = parseInt(monthFirst[2]!, 10);
      if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
        periodMonth = month;
        periodYear = year;
      }
    }
  }

  if (periodMonth === undefined || periodYear === undefined) {
    const yearFirst = name.match(/(20\d{2})[-_.](\d{1,2})(?!\d)/);
    if (yearFirst) {
      const year = parseInt(yearFirst[1]!, 10);
      const month = parseInt(yearFirst[2]!, 10);
      if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
        periodMonth = month;
        periodYear = year;
      }
    }
  }

  return {
    category: "payslip",
    ...(periodMonth !== undefined && { periodMonth }),
    ...(periodYear !== undefined && { periodYear }),
  };
}
