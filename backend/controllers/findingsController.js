const Document = require('../models/Document');
const { buildSavingsForecast } = require('../services/savingsForecastService');
const { buildCanonicalPayslip } = require('../services/payslipAnalysisService');

const STALE_DAYS = 30;
const LOW_CONFIDENCE_THRESHOLD = 0.65;

const buildFinding = (id, title, severity, details) => ({
  id,
  title,
  severity,
  details,
});

exports.getFindings = async (req, res, next) => {
  try {
    const documents = await Document.find({ user: req.user.id })
      .select('_id originalName fileSize status updatedAt metadata analysisData')
      .lean();

    if (documents.length === 0) {
      const findings = [
        buildFinding(
          'no_documents',
          'אין מסמכים',
          'info',
          'לא נמצאו מסמכים בחשבון. העלו מסמך ראשון כדי להתחיל.'
        ),
      ];

      return res.status(200).json({
        success: true,
        count: findings.length,
        data: findings,
      });
    }

    const findings = [];
    let missingMetadataCount = 0;
    let futureDateCount = 0;
    let pendingCount = 0;
    let failedCount = 0;
    let staleCount = 0;
    let lowConfidencePayslips = 0;
    let missingCorePayslipFields = 0;
    let metadataMismatchCount = 0;
    let missingPensionCount = 0;

    const duplicateMap = new Map();
    const now = new Date();
    const staleThreshold = new Date(
      now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000
    );

    documents.forEach(doc => {
      const duplicateKey = `${doc.originalName || ''}::${doc.fileSize ?? ''}`;
      duplicateMap.set(duplicateKey, (duplicateMap.get(duplicateKey) || 0) + 1);

      if (doc.status === 'pending' || doc.status === 'processing') {
        pendingCount += 1;
      }

      if (doc.status === 'failed') {
        failedCount += 1;
      }

      if (doc.updatedAt) {
        const updatedAt = new Date(doc.updatedAt);
        if (!Number.isNaN(updatedAt.getTime()) && updatedAt < staleThreshold) {
          staleCount += 1;
        }
      }

      const metadata = doc.metadata && typeof doc.metadata === 'object' ? doc.metadata : {};
      const category = typeof metadata.category === 'string' ? metadata.category : '';
      const hasCategory = Boolean(category);
      const dateValue = metadata.documentDate
        ? new Date(metadata.documentDate)
        : null;
      const hasValidDate = Boolean(
        dateValue && !Number.isNaN(dateValue.getTime())
      );

      if (!hasCategory || !hasValidDate) {
        missingMetadataCount += 1;
      }

      if (hasValidDate && dateValue > now) {
        futureDateCount += 1;
      }

      if (doc.status === 'completed') {
        const payslip = buildCanonicalPayslip(doc);

        if (!payslip) {
          missingCorePayslipFields += 1;
          return;
        }

        const gross = typeof payslip.grossSalary === 'number';
        const net = typeof payslip.netSalary === 'number';
        const employee = Boolean(payslip.employeeName || payslip.employeeId);
        if (!gross || !net || !employee) {
          missingCorePayslipFields += 1;
        }

        const confidence = payslip.quality?.confidence;
        if (typeof confidence === 'number' && confidence < LOW_CONFIDENCE_THRESHOLD) {
          lowConfidencePayslips += 1;
        }

        const metadataPeriod =
          Number.isInteger(metadata.periodYear) && Number.isInteger(metadata.periodMonth)
            ? `${metadata.periodYear}-${String(metadata.periodMonth).padStart(2, '0')}`
            : '';
        if (metadataPeriod && payslip.periodMonth && metadataPeriod !== payslip.periodMonth) {
          metadataMismatchCount += 1;
        }

        const pension = payslip.contributions?.pension;
        const hasAnyPension = Boolean(
          pension &&
            [pension.employee, pension.employer, pension.severance].some(
              value => typeof value === 'number' && Number.isFinite(value)
            )
        );
        if (!hasAnyPension) {
          missingPensionCount += 1;
        }
      }
    });

    if (missingMetadataCount > 0) {
      findings.push(
        buildFinding(
          'missing_basic_metadata',
          'מסמכים ללא פרטים בסיסיים',
          'warning',
          `נמצאו ${missingMetadataCount} מסמכים שחסרים בהם קטגוריה או תאריך מסמך תקין.`
        )
      );
    }

    if (futureDateCount > 0) {
      findings.push(
        buildFinding(
          'future_document_date',
          'מסמכים עם תאריך עתידי',
          'warning',
          `נמצאו ${futureDateCount} מסמכים עם תאריך גדול מהיום. מומלץ לבדוק את התאריך.`
        )
      );
    }

    const duplicateCounts = Array.from(duplicateMap.values());
    const duplicateDocs = duplicateCounts.reduce(
      (sum, count) => sum + (count > 1 ? count - 1 : 0),
      0
    );

    if (duplicateDocs > 0) {
      findings.push(
        buildFinding(
          'possible_duplicates',
          'כפילויות אפשריות',
          'info',
          `נמצאו ${duplicateDocs} מסמכים עם אותו שם וגודל. ייתכן שיש כפילויות.`
        )
      );
    }

    if (pendingCount > 0) {
      findings.push(
        buildFinding(
          'documents_pending',
          'מסמכים בסטטוס לא סופי',
          'info',
          `יש ${pendingCount} מסמכים בסטטוס pending או processing.`
        )
      );
    }

    if (failedCount > 0) {
      findings.push(
        buildFinding(
          'documents_failed',
          'מסמכים שנכשלו בעיבוד',
          'warning',
          `יש ${failedCount} מסמכים שנכשלו בעיבוד ודורשים בדיקה או ניסיון חוזר.`
        )
      );
    }

    if (staleCount > 0) {
      findings.push(
        buildFinding(
          'stale_documents',
          'מסמכים שלא עודכנו לאחרונה',
          'info',
          `נמצאו ${staleCount} מסמכים שלא עודכנו ב-${STALE_DAYS} הימים האחרונים.`
        )
      );
    }

    if (missingCorePayslipFields > 0) {
      findings.push(
        buildFinding(
          'payslips_missing_core_fields',
          'תלושים עם נתונים חסרים',
          'warning',
          `נמצאו ${missingCorePayslipFields} תלושים בלי שדות ליבה מלאים.`
        )
      );
    }

    if (lowConfidencePayslips > 0) {
      findings.push(
        buildFinding(
          'payslips_low_confidence',
          'תלושים עם ביטחון OCR נמוך',
          'warning',
          `נמצאו ${lowConfidencePayslips} תלושים עם confidence נמוך שדורשים בדיקה ידנית.`
        )
      );
    }

    if (metadataMismatchCount > 0) {
      findings.push(
        buildFinding(
          'payslip_metadata_mismatch',
          'חוסר התאמה בין metadata לתלוש',
          'warning',
          `נמצאו ${metadataMismatchCount} תלושים שבהם חודש התלוש לא תואם ל-metadata שנשמר עם המסמך.`
        )
      );
    }

    if (missingPensionCount > 0) {
      findings.push(
        buildFinding(
          'payslips_missing_pension',
          'תלושים בלי הפקדות פנסיה מזוהות',
          'info',
          `נמצאו ${missingPensionCount} תלושים ללא נתוני הפקדות פנסיה מלאים.`
        )
      );
    }

    return res.status(200).json({
      success: true,
      count: findings.length,
      data: findings,
    });
  } catch (error) {
    return next(error);
  }
};

exports.getSavingsForecast = async (req, res, next) => {
  try {
    const forecast = await buildSavingsForecast({
      userId: req.user.id,
      input: req.body,
    });

    return res.status(200).json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    return next(error);
  }
};
