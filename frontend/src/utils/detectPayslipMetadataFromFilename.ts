import type { UploadDocumentPayload } from "../api/documents.api";

/**
 * Infer payslip period metadata from common filename patterns (e.g. 2025-03, 03-2025).
 */
export function detectPayslipMetadataFromFilename(file: File): UploadDocumentPayload {
  const name = file.name;
  let periodMonth: number | undefined;
  let periodYear: number | undefined;

  const patterns = [
    /(?:^|[\D])(20\d{2})[\-_\.](\d{1,2})(?:[\D]|$)/,
    /(?:^|[\D])(\d{1,2})[\-_\.](20\d{2})(?:[\D]|$)/,
    /(20\d{2})(\d{2})(?:[\D]|$)/,
  ];

  for (const pat of patterns) {
    const m = pat.exec(name);
    if (m) {
      const a = parseInt(m[1]!, 10);
      const b = parseInt(m[2]!, 10);
      const [year, month] = a > 100 ? [a, b] : [b, a];
      if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
        periodYear = year;
        periodMonth = month;
        break;
      }
    }
  }

  return {
    category: "payslip",
    ...(periodMonth !== undefined && { periodMonth }),
    ...(periodYear !== undefined && { periodYear }),
  };
}
