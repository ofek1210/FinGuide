/**
 * Document Chunker — splits text into overlapping chunks suitable for embedding.
 *
 * Chunking strategy:
 * - Fixed-size chunks with overlap for continuous text (knowledge base articles)
 * - Structured chunking for payslip data (one chunk per logical section)
 * - Metadata preserved on each chunk for filtering during retrieval
 */

const crypto = require('crypto');

/**
 * Split text into overlapping chunks.
 * @param {string} text - The text to chunk
 * @param {object} options
 * @param {number} options.chunkSize - Max characters per chunk (default: 500)
 * @param {number} options.overlap - Character overlap between chunks (default: 100)
 * @param {object} options.metadata - Metadata to attach to all chunks
 * @returns {Array<{id: string, text: string, metadata: object}>}
 */
function chunkText(text, options = {}) {
  const { chunkSize = 500, overlap = 100, metadata = {} } = options;
  if (!text || text.length === 0) return [];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.slice(start, end);

    // Generate deterministic ID from content + position
    const id = crypto
      .createHash('md5')
      .update(`${metadata.source || 'unknown'}_${start}_${chunkText.slice(0, 50)}`)
      .digest('hex');

    chunks.push({
      id,
      text: chunkText.trim(),
      metadata: { ...metadata, startPos: start, endPos: end },
    });

    start += chunkSize - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Chunk a payslip analysis into semantic sections.
 * Each section becomes its own chunk with clear metadata.
 * @param {object} analysisData - The document.analysisData object
 * @param {object} docMeta - Document metadata (id, date, etc.)
 * @returns {Array<{id: string, text: string, metadata: object}>}
 */
function chunkPayslipAnalysis(analysisData, docMeta = {}) {
  if (!analysisData || !analysisData.summary) return [];

  const chunks = [];
  const s = analysisData.summary;
  const docId = docMeta.documentId || 'unknown';
  const date = s.date || docMeta.date || 'unknown';

  // Income section
  const incomeLines = [`תלוש שכר - ${date}`, `הכנסה:`];
  if (s.grossSalary) incomeLines.push(`ברוטו: ${s.grossSalary} ₪`);
  if (s.baseSalary) incomeLines.push(`שכר בסיס: ${s.baseSalary} ₪`);
  if (s.netSalary) incomeLines.push(`נטו: ${s.netSalary} ₪`);
  if (s.employeeName) incomeLines.push(`עובד: ${s.employeeName}`);
  if (s.employerName) incomeLines.push(`מעסיק: ${s.employerName}`);

  chunks.push({
    id: `payslip_income_${docId}`,
    text: incomeLines.join('\n'),
    metadata: { source: 'payslip', category: 'income', documentId: docId, date },
  });

  // Deductions section
  const deductionLines = [`ניכויים - ${date}:`];
  if (s.tax) deductionLines.push(`מס הכנסה: ${s.tax} ₪`);
  if (s.nationalInsurance) deductionLines.push(`ביטוח לאומי: ${s.nationalInsurance} ₪`);
  if (s.healthInsurance) deductionLines.push(`מס בריאות: ${s.healthInsurance} ₪`);
  if (s.mandatoryDeductionsTotal) deductionLines.push(`סה"כ ניכויי חובה: ${s.mandatoryDeductionsTotal} ₪`);

  if (deductionLines.length > 1) {
    chunks.push({
      id: `payslip_deductions_${docId}`,
      text: deductionLines.join('\n'),
      metadata: { source: 'payslip', category: 'deductions', documentId: docId, date },
    });
  }

  // Pension/savings section
  const pensionLines = [`הפרשות פנסיוניות - ${date}:`];
  if (s.pensionEmployee) pensionLines.push(`פנסיה עובד: ${s.pensionEmployee} ₪`);
  if (s.pensionEmployer) pensionLines.push(`פנסיה מעסיק: ${s.pensionEmployer} ₪`);
  if (s.trainingFundEmployee) pensionLines.push(`קרן השתלמות עובד: ${s.trainingFundEmployee} ₪`);
  if (s.trainingFundEmployer) pensionLines.push(`קרן השתלמות מעסיק: ${s.trainingFundEmployer} ₪`);

  if (pensionLines.length > 1) {
    chunks.push({
      id: `payslip_pension_${docId}`,
      text: pensionLines.join('\n'),
      metadata: { source: 'payslip', category: 'pension', documentId: docId, date },
    });
  }

  return chunks;
}

/**
 * Chunk knowledge base articles by paragraph/section.
 * @param {string} articleText - Full article text
 * @param {object} articleMeta - { title, category, source }
 * @returns {Array<{id: string, text: string, metadata: object}>}
 */
function chunkKnowledgeArticle(articleText, articleMeta = {}) {
  // Split by double newlines (paragraphs) or section headers
  const sections = articleText.split(/\n{2,}/).filter(s => s.trim().length > 30);

  return sections.map((section, idx) => {
    const id = crypto
      .createHash('md5')
      .update(`${articleMeta.source || 'kb'}_${idx}_${section.slice(0, 30)}`)
      .digest('hex');

    return {
      id,
      text: section.trim(),
      metadata: {
        ...articleMeta,
        source: articleMeta.source || 'knowledge_base',
        sectionIndex: idx,
      },
    };
  });
}

module.exports = { chunkText, chunkPayslipAnalysis, chunkKnowledgeArticle };
