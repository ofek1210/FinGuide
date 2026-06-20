require('dotenv').config();
const mongoose = require('mongoose');
const Document = require('../models/Document');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const docs = await Document.find({
    status: { $in: ['completed', 'needs_review'] },
  })
    .sort({ uploadedAt: -1 })
    .limit(5)
    .lean();

  for (const d of docs) {
    const ad = d.analysisData || {};
    console.log('---', d.originalName, d.status);
    console.log('salary:', JSON.stringify(ad.salary));
    console.log('summary:', JSON.stringify(ad.summary));
    console.log('mandatory:', JSON.stringify(ad.deductions?.mandatory));
    console.log('pension:', JSON.stringify(ad.contributions?.pension));
    console.log('tax:', JSON.stringify(ad.tax));
    console.log('processingError:', d.processingError);
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
