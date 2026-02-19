const Document = require('../models/Document');

const STALE_DAYS = 30;

const buildFinding = (id, title, severity, details) => ({
  id,
  title,
  severity,
  details,
});

exports.getFindings = async (req, res, next) => {
  try {
    const documents = await Document.find({ user: req.user.id })
      .select('originalName fileSize status updatedAt type date')
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
    const hasTypeField = Boolean(Document.schema.path('type'));
    const hasDateField = Boolean(Document.schema.path('date'));
    const shouldCheckBasicMetadata = hasTypeField || hasDateField;

    let missingMetadataCount = 0;
    let futureDateCount = 0;
    let pendingCount = 0;
    let staleCount = 0;

    const duplicateMap = new Map();
    const now = new Date();
    const staleThreshold = new Date(
      now.getTime() - STALE_DAYS * 24 * 60 * 60 * 1000
    );

    documents.forEach(doc => {
      const duplicateKey = `${doc.originalName || ''}::${doc.fileSize ?? ''}`;
      duplicateMap.set(duplicateKey, (duplicateMap.get(duplicateKey) || 0) + 1);

      if (doc.status === 'pending' || doc.status === 'uploaded') {
        pendingCount += 1;
      }

      if (doc.updatedAt) {
        const updatedAt = new Date(doc.updatedAt);
        if (!Number.isNaN(updatedAt.getTime()) && updatedAt < staleThreshold) {
          staleCount += 1;
        }
      }

      if (shouldCheckBasicMetadata) {
        const missingType = hasTypeField && !doc.type;
        const dateValue = hasDateField && doc.date ? new Date(doc.date) : null;
        const missingDate =
          hasDateField && (!doc.date || Number.isNaN(dateValue?.getTime()));

        if (missingType || missingDate) {
          missingMetadataCount += 1;
        }

        if (
          hasDateField &&
          dateValue &&
          !Number.isNaN(dateValue.getTime()) &&
          dateValue > now
        ) {
          futureDateCount += 1;
        }
      }
    });

    if (shouldCheckBasicMetadata && missingMetadataCount > 0) {
      const missingFieldsLabel = hasTypeField && hasDateField
        ? 'type או date'
        : hasTypeField
          ? 'type'
          : 'date';

      findings.push(
        buildFinding(
          'missing_basic_metadata',
          'מסמכים ללא פרטים בסיסיים',
          'warning',
          `נמצאו ${missingMetadataCount} מסמכים שחסרים בהם שדות בסיסיים (${missingFieldsLabel}).`
        )
      );
    }

    if (shouldCheckBasicMetadata && futureDateCount > 0) {
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
          `יש ${pendingCount} מסמכים בסטטוס pending או uploaded.`
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

    return res.status(200).json({
      success: true,
      count: findings.length,
      data: findings,
    });
  } catch (error) {
    return next(error);
  }
};
