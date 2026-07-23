import {
  uploadDocument,
  unlockDocument,
  type DocumentItem,
  type UploadDocumentResponse,
  type DocumentResponse,
} from "../api/documents.api";
import { detectPayslipMetadataFromFilename } from "../utils/detectPayslipMetadataFromFilename";
import { isAnalyzablePayslip } from "../utils/payslipAnalysisSummary";

export const MAX_PAYSLIPS = 3;

export function uploadFailureMessage(doc: DocumentItem, fileName: string): string {
  if (doc.status === "needs_password") {
    return `${fileName}: נדרשת סיסמה לפתיחת הקובץ`;
  }
  if (doc.status === "failed") {
    return `${fileName}: ${doc.processingError || "שגיאה בעיבוד"}`;
  }
  return `${fileName}: לא ניתן לנתח את הקובץ`;
}

/**
 * הודעה כשההעלאה נותבה לצינור אחר (ביטוח/פנסיה) — למשל בייבוא מ-Gmail.
 * מחזיר null כשאין ניתוב.
 */
export function uploadRoutedMessage(
  res: UploadDocumentResponse,
  fileName: string,
): string | null {
  if (res.routedTo === "pension") {
    return `${fileName}: זוהה כדוח פנסיה ויובא לעוזר הפנסיוני — לא נוסף כתלוש`;
  }
  if (res.routedTo === "insurance") {
    return `${fileName}: זוהה כדוח ביטוח ויובא לדאשבורד הביטוחים — לא נוסף כתלוש`;
  }
  return null;
}

export function isAnalyzableUpload(doc?: DocumentItem | null): boolean {
  if (!doc) return false;
  if (doc.analyzable === true) return true;
  if (doc.analyzable === false) return false;
  return isAnalyzablePayslip(doc);
}

export async function uploadPayslipFile(file: File): Promise<UploadDocumentResponse> {
  const metadata = detectPayslipMetadataFromFilename(file);
  return uploadDocument(file, metadata);
}

export async function unlockPayslipDocument(
  docId: string,
  password: string,
): Promise<DocumentResponse> {
  return unlockDocument(docId, password);
}
