/**
 * Reprocess recent payslip documents with failed/partial extraction.
 * Usage: node scripts/reprocessRecentPayslips.js [--limit 10]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Document = require('../models/Document');
const { extractPayslipFile } = require('../services/payslipOcr');
const { validatePayslipAnalysis, buildFieldsMeta } = require('../schemas/payslipAnalysis.schema');

async function main() {
  const limit = Number(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || 10);
  await mongoose.connect(process.env.MONGODB_URI);

  const docs = await Document.find({
    status: { $in: ['needs_review', 'completed'] },
    'metadata.category': { $in: ['payslip', 'other', null] },
  })
    .sort({ uploadedAt: -1 })
    .limit(limit);

  console.log(`Reprocessing ${docs.length} documents...`);

  for (const doc of docs) {
    try {
      const { data } = await extractPayslipFile(doc.filePath);
      const fieldsMeta = buildFieldsMeta(data);
      if (fieldsMeta) data.fields_meta = fieldsMeta;

      const validation = validatePayslipAnalysis(data);
      doc.analysisData = data;
      doc.processedAt = new Date();
      if (validation.ok) {
        doc.status = 'completed';
        doc.processingError = null;
      } else {
        doc.status = 'needs_review';
        doc.processingError = validation.message;
      }
      if (!doc.metadata) doc.metadata = {};
      doc.metadata.category = 'payslip';
      await doc.save();

      const gross = data.salary?.gross_total;
      const net = data.salary?.net_payable;
      console.log(`✓ ${doc.originalName} → gross=${gross} net=${net} status=${doc.status}`);
    } catch (err) {
      console.error(`✗ ${doc.originalName}:`, err.message);
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
