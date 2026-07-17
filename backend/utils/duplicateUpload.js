const crypto = require('crypto');
const Document = require('../models/Document');
const InsuranceImportSnapshot = require('../models/InsuranceImportSnapshot');
const PensionImportSnapshot = require('../models/PensionImportSnapshot');
const { DuplicateUploadError } = require('./appErrors');
const { parsePeriodMonth } = require('./payslipPeriod');

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function computeBufferChecksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function formatPeriodLabelHe(year, month) {
  if (!year || !month || month < 1 || month > 12) return null;
  return `${HEBREW_MONTHS[month - 1]} ${year}`;
}

function buildDuplicateMessage(existing) {
  if (!existing) return 'המסמך הזה כבר קיים במערכת';
  if (existing.kind === 'insurance') {
    return 'קובץ הביטוח הזה כבר קיים במערכת';
  }
  if (existing.kind === 'pension') {
    return 'קובץ הפנסיה הזה כבר קיים במערכת';
  }
  if (existing.periodLabel) {
    return `תלוש ${existing.periodLabel} כבר קיים במערכת`;
  }
  if (existing.originalName) {
    return `המסמך "${existing.originalName}" כבר קיים במערכת`;
  }
  return 'המסמך הזה כבר קיים במערכת';
}

async function findExistingUploadByChecksum(userId, checksumSha256) {
  if (!userId || !checksumSha256) return null;

  const doc = await Document.findOne({ user: userId, checksumSha256 })
    .select('_id originalName metadata status analysisData.period')
    .lean();
  if (doc) {
    const period = parsePeriodMonth(doc.analysisData?.period?.month);
    return {
      kind: 'document',
      documentId: doc._id,
      originalName: doc.originalName,
      periodLabel: period ? formatPeriodLabelHe(period.year, period.month) : null,
    };
  }

  const insurance = await InsuranceImportSnapshot.findOne({
    user: userId,
    fileChecksumSha256: checksumSha256,
  })
    .sort({ importedAt: -1 })
    .select('_id sourceFile importedAt')
    .lean();
  if (insurance) {
    return {
      kind: 'insurance',
      snapshotId: insurance._id,
      originalName: insurance.sourceFile,
    };
  }

  const pension = await PensionImportSnapshot.findOne({
    user: userId,
    fileChecksumSha256: checksumSha256,
  })
    .sort({ importedAt: -1 })
    .select('_id sourceFile importedAt')
    .lean();
  if (pension) {
    return {
      kind: 'pension',
      snapshotId: pension._id,
      originalName: pension.sourceFile,
    };
  }

  return null;
}

async function findExistingPayslipByPeriod(userId, periodYear, periodMonth, excludeDocumentId) {
  if (!userId || !periodYear || !periodMonth) return null;

  const canonical = `${periodYear}-${String(periodMonth).padStart(2, '0')}`;
  const query = {
    user: userId,
    _id: excludeDocumentId ? { $ne: excludeDocumentId } : { $exists: true },
    status: { $in: ['completed', 'needs_review'] },
    $or: [
      { 'metadata.periodYear': periodYear, 'metadata.periodMonth': periodMonth },
      { 'analysisData.period.month': canonical },
    ],
  };

  return Document.findOne(query).select('_id originalName metadata').lean();
}

async function assertUploadNotDuplicate(userId, checksumSha256) {
  const existing = await findExistingUploadByChecksum(userId, checksumSha256);
  if (!existing) return;
  throw new DuplicateUploadError(buildDuplicateMessage(existing), existing);
}

async function assertPayslipPeriodNotDuplicate(userId, periodYear, periodMonth, excludeDocumentId) {
  const existing = await findExistingPayslipByPeriod(userId, periodYear, periodMonth, excludeDocumentId);
  if (!existing) return null;

  const periodLabel = formatPeriodLabelHe(periodYear, periodMonth);
  throw new DuplicateUploadError(`תלוש ${periodLabel} כבר קיים במערכת`, {
    kind: 'payslip',
    documentId: existing._id,
    periodLabel,
    originalName: existing.originalName,
  });
}

module.exports = {
  computeBufferChecksum,
  formatPeriodLabelHe,
  findExistingUploadByChecksum,
  findExistingPayslipByPeriod,
  assertUploadNotDuplicate,
  assertPayslipPeriodNotDuplicate,
  buildDuplicateMessage,
};
