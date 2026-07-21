'use strict';

const { runExecutiveOrchestrator } = require('../services/executiveOrchestrator/runExecutiveOrchestrator');
const { generateExecutiveReportPdf } = require('../services/executiveOrchestrator/executivePdfService');
const { getExecutiveReport } = require('../services/executiveOrchestrator/executiveReportCache');
const { NotFoundError, ValidationError } = require('../utils/appErrors');

/**
 * POST /api/executive/report — generate unified executive financial report
 */
async function generateExecutiveReport(req, res) {
  const skipLLM = req.query.skipLLM === 'true' || req.body?.skipLLM === true;
  const result = await runExecutiveOrchestrator(req.user._id, { skipLLM });
  return res.json({
    success: true,
    data: {
      runId: result.runId,
      report: result.report,
      meta: result.meta,
    },
  });
}

/**
 * GET /api/executive/report/pdf?runId=... — download PDF for a cached report
 */
async function downloadExecutiveReportPdf(req, res) {
  const runId = req.query.runId || req.body?.runId;
  if (!runId) {
    throw new ValidationError('נדרש runId — יש ליצור דוח לפני ההורדה.');
  }

  const report = await getExecutiveReport(req.user._id, runId);
  if (!report) {
    throw new NotFoundError('הדוח לא נמצא או שפג תוקפו. יש ליצור דוח חדש.');
  }

  const pdfBuffer = await generateExecutiveReportPdf(report);
  const date = new Date(report.meta?.generatedAt || Date.now()).toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="FinGuide-Financial-Report-${date}.pdf"`);
  return res.send(pdfBuffer);
}

module.exports = {
  generateExecutiveReport,
  downloadExecutiveReportPdf,
};
