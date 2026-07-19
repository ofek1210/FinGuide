/* ============================================================
   Government report import — shared constants.
   The old GovReportImportFlow (emoji + serif landing/guide/upload)
   was replaced by the design-system components:
   - pension:   components/pension/PensionLandingScreen / PensionImportGuide / PensionUpload
   - insurance: InsuranceLandingScreen (in InsurancePage) / InsuranceImportGuide / InsuranceUpload
   Only the official site URLs remain shared here.
   ============================================================ */

/** הר הכסף — the official pension savings registry (משרד האוצר). */
export const PENSION_SITE_URL = "https://harkesher.mof.gov.il/ReportAnonymous/gamal";

/** הר הביטוח — the official insurance policies registry. */
export const INSURANCE_SITE_URL = "https://www.gov.il/he/service/har-habituach";
