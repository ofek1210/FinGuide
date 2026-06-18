/**
 * Agent Controller — handles requests to the multi-agent AI system.
 *
 * Endpoints:
 * - POST /api/agents/ask    — Ask the AI agent system a question
 * - GET  /api/agents/list   — Get available agents
 * - POST /api/agents/embed  — Trigger embedding of a document
 * - GET  /api/agents/rag/stats — Get RAG system statistics
 * - POST /api/agents/rag/index — Index/re-index knowledge base
 */

const Document = require('../models/Document');
const UserProfile = require('../models/UserProfile');
const Insight = require('../models/Insight');
const Recommendation = require('../models/Recommendation');
const { orchestrate, getAgentList } = require('../services/agents');
const { indexKnowledgeBase, indexPayslipDocument, getRAGStats, isKnowledgeBaseIndexed } = require('../services/embeddings');

/**
 * Build user context from DB — same as in aiController but available for agents.
 */
async function buildAgentUserContext(userId) {
  const documents = await Document.find({ user: userId })
    .select('status uploadedAt metadata analysisData')
    .sort({ uploadedAt: -1 })
    .lean();

  const [profile, insights, recommendations] = await Promise.all([
    UserProfile.findOne({ user: userId }).lean(),
    Insight.find({ user: userId, status: 'active' }).sort({ createdAt: -1 }).limit(5).lean(),
    Recommendation.find({ user: userId, status: 'active' }).sort({ importance: 1 }).limit(5).lean(),
  ]);

  const completedPayslips = documents.filter(
    d =>
      d.status === 'completed' &&
      (d.metadata?.category === 'payslip' || d.analysisData?.summary?.grossSalary != null) &&
      d.analysisData?.summary,
  ).slice(0, 3);

  const latestPayslip = completedPayslips[0];
  const fullAnalysis = latestPayslip?.analysisData || {};
  const summary = fullAnalysis.summary || {};

  const payslipHistory = completedPayslips.slice(1).map(p => ({
    date: p.analysisData?.summary?.date ?? null,
    grossSalary: p.analysisData?.summary?.grossSalary ?? null,
    netSalary: p.analysisData?.summary?.netSalary ?? null,
    tax: p.analysisData?.summary?.tax ?? null,
    pensionEmployee: p.analysisData?.summary?.pensionEmployee ?? null,
    trainingFundEmployee: p.analysisData?.summary?.trainingFundEmployee ?? null,
  }));

  return {
    grossSalary: summary.grossSalary ?? null,
    netSalary: summary.netSalary ?? null,
    baseSalary: summary.baseSalary ?? null,
    tax: summary.tax ?? null,
    nationalInsurance: summary.nationalInsurance ?? null,
    healthInsurance: summary.healthInsurance ?? null,
    mandatoryDeductionsTotal: summary.mandatoryDeductionsTotal ?? null,
    pensionEmployee: summary.pensionEmployee ?? null,
    pensionEmployer: summary.pensionEmployer ?? null,
    pensionSeverance: summary.pensionSeverance ?? null,
    trainingFundEmployee: summary.trainingFundEmployee ?? null,
    trainingFundEmployer: summary.trainingFundEmployer ?? null,
    trainingFundEmployeePercent: fullAnalysis.contributions?.study_fund?.employee_rate_percent ?? null,
    trainingFundEmployerPercent: fullAnalysis.contributions?.study_fund?.employer_rate_percent ?? null,
    jobPercentage: summary.jobPercentage ?? null,
    employeeName: summary.employeeName ?? null,
    employerName: summary.employerName ?? null,
    payslipDate: summary.date ?? null,
    vacationDays: summary.vacationDays ?? null,
    sickDays: summary.sickDays ?? null,
    marginalTaxRate: fullAnalysis.tax?.marginal_tax_rate_percent ?? null,
    salaryComponents: fullAnalysis.salary?.components ?? null,
    payslipHistory,
    profile,
    insights,
    recommendations,
  };
}

/**
 * POST /api/agents/ask
 * Ask the multi-agent system a question.
 * Body: { message, conversationHistory? }
 */
exports.askAgent = async (req, res, next) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'message is required' });
    }

    const userId = req.user._id.toString();
    const userContext = await buildAgentUserContext(req.user._id);

    const result = await orchestrate(message.trim(), {
      userContext,
      history: conversationHistory || [],
      userId,
    });

    return res.json({
      success: true,
      data: {
        answer: result.answer,
        agent: result.agent,
        classification: result.classification,
        sources: result.sources || [],
        model: result.model,
        tokensUsed: result.tokensUsed,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/agents/list
 * Get available agents and their descriptions.
 */
exports.listAgents = (req, res) => {
  const agents = getAgentList();
  return res.json({ success: true, data: { agents } });
};

/**
 * POST /api/agents/embed
 * Create embeddings for a specific document.
 * Body: { documentId }
 */
exports.embedDocument = async (req, res, next) => {
  try {
    const { documentId } = req.body;

    if (!documentId) {
      return res.status(400).json({ success: false, message: 'documentId is required' });
    }

    const document = await Document.findOne({ _id: documentId, user: req.user._id }).lean();
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    if (!document.analysisData?.summary) {
      return res.status(400).json({ success: false, message: 'Document has no analysis data' });
    }

    const result = await indexPayslipDocument(document);
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/agents/rag/stats
 * Get RAG system statistics.
 */
exports.getRAGStatus = (req, res) => {
  const stats = getRAGStats();
  const indexed = isKnowledgeBaseIndexed();
  return res.json({ success: true, data: { ...stats, knowledgeBaseIndexed: indexed } });
};

/**
 * POST /api/agents/rag/index
 * Index or re-index the knowledge base.
 */
exports.indexKnowledge = async (req, res, next) => {
  try {
    const result = await indexKnowledgeBase();
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};
