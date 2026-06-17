const UserProfile = require('../models/UserProfile');
const Document = require('../models/Document');
const Insight = require('../models/Insight');
const { buildInvestmentRecommendations } = require('../services/investmentRecommenderService');
const { analyzeBudget } = require('../services/budgetAnalysisService');
const { generateMonthlyReport } = require('../services/monthlyReportService');
const { buildFinancialHealthScore } = require('../services/financialHealthScoreService');

// ── helpers ───────────────────────────────────────────────────────────────────

async function getLatestPayslipSummary(userId) {
  const doc = await Document.findOne({
    user: userId,
    status: 'completed',
    $or: [
      { 'metadata.category': 'payslip' },
      { 'analysisData.summary.grossSalary': { $exists: true, $ne: null } },
    ],
  }).sort({ uploadedAt: -1 }).lean();

  if (!doc?.analysisData?.summary) return null;
  const s = doc.analysisData.summary;
  return {
    grossSalary: s.grossSalary ?? null,
    netSalary: s.netSalary ?? null,
    pensionEmployee: s.pensionEmployee ?? null,
    tax: s.tax ?? null,
    nationalInsurance: s.nationalInsurance ?? null,
  };
}

// ── GET /api/copilot/analysis ─────────────────────────────────────────────────

exports.getCopilotAnalysis = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [profile, insights] = await Promise.all([
      UserProfile.findOne({ user: userId }).lean(),
      Insight.find({ user: userId, status: 'active' }).sort({ createdAt: -1 }).limit(6).lean(),
    ]);

    const payslip = await getLatestPayslipSummary(userId);
    const netSalary = payslip?.netSalary ?? null;
    const grossSalary = payslip?.grossSalary ?? null;

    const budgetAnalysis = analyzeBudget({
      netSalary,
      grossSalary,
      monthlyExpenses: profile?.financial?.monthlyExpensesEstimate,
      monthlyDebts: profile?.financial?.monthlyDebts,
      mortgagePayment: profile?.assets?.mortgageMonthlyPayment,
      savingsEstimate: profile?.financial?.savingsEstimate,
    });

    const investmentRecs = buildInvestmentRecommendations(profile, { grossSalary, netSalary });
    const healthScore = await buildFinancialHealthScore(userId, new Date().getFullYear());

    const goals = (profile?.goals || []).map(g => ({
      id: g._id?.toString(),
      type: g.type,
      label: g.label,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      targetDate: g.targetDate,
      priority: g.priority,
      progressPct: g.targetAmount ? Math.min(100, Math.round(((g.currentAmount || 0) / g.targetAmount) * 100)) : 0,
    }));

    res.json({
      success: true,
      data: {
        profile: {
          riskTolerance: profile?.financial?.riskTolerance || null,
          monthlyExpenses: profile?.financial?.monthlyExpensesEstimate || null,
          monthlyDebts: profile?.financial?.monthlyDebts || null,
          savings: profile?.financial?.savingsEstimate || null,
        },
        payslip,
        budgetAnalysis,
        investmentRecs,
        healthScore,
        insights: insights.map(i => ({ title: i.title, description: i.description, type: i.type })),
        goals,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/copilot/profile ──────────────────────────────────────────────────

exports.updateCopilotProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { riskTolerance, monthlyExpenses, monthlyDebts, savings } = req.body;

    const profile = await UserProfile.findOrCreateForUser(userId);
    if (riskTolerance !== undefined) profile.financial.riskTolerance = riskTolerance;
    if (monthlyExpenses !== undefined) profile.financial.monthlyExpensesEstimate = Number(monthlyExpenses) || null;
    if (monthlyDebts !== undefined) profile.financial.monthlyDebts = Number(monthlyDebts) || null;
    if (savings !== undefined) profile.financial.savingsEstimate = Number(savings) || null;
    await profile.save();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/copilot/goals ───────────────────────────────────────────────────

exports.upsertGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id, type, label, targetAmount, currentAmount, targetDate, priority } = req.body;

    const profile = await UserProfile.findOrCreateForUser(userId);
    if (id) {
      const goal = profile.goals.id(id);
      if (!goal) return res.status(404).json({ success: false, message: 'יעד לא נמצא' });
      if (type) goal.type = type;
      if (label !== undefined) goal.label = label;
      if (targetAmount !== undefined) goal.targetAmount = Number(targetAmount) || null;
      if (currentAmount !== undefined) goal.currentAmount = Number(currentAmount) || 0;
      if (targetDate !== undefined) goal.targetDate = targetDate;
      if (priority !== undefined) goal.priority = priority;
    } else {
      profile.goals.push({ type: type || 'other', label, targetAmount, currentAmount: currentAmount || 0, targetDate, priority: priority || 3 });
    }
    await profile.save();
    res.json({ success: true, goals: profile.goals });
  } catch (err) {
    next(err);
  }
};

exports.deleteGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const profile = await UserProfile.findOrCreateForUser(userId);
    profile.goals.pull({ _id: id });
    await profile.save();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/copilot/monthly-report ─────────────────────────────────────────

exports.generateReport = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [profile, insights] = await Promise.all([
      UserProfile.findOne({ user: userId }).lean(),
      Insight.find({ user: userId, status: 'active' }).sort({ createdAt: -1 }).limit(6).lean(),
    ]);

    const payslip = await getLatestPayslipSummary(userId);
    const netSalary = payslip?.netSalary ?? null;
    const grossSalary = payslip?.grossSalary ?? null;

    const budgetAnalysis = analyzeBudget({
      netSalary,
      grossSalary,
      monthlyExpenses: profile?.financial?.monthlyExpensesEstimate,
      monthlyDebts: profile?.financial?.monthlyDebts,
      mortgagePayment: profile?.assets?.mortgageMonthlyPayment,
      savingsEstimate: profile?.financial?.savingsEstimate,
    });

    const investmentRecs = buildInvestmentRecommendations(profile, { grossSalary, netSalary });
    const healthScore = await buildFinancialHealthScore(userId, new Date().getFullYear());

    const result = await generateMonthlyReport({
      profile,
      budgetAnalysis,
      investmentRecs,
      healthScore,
      insights,
      latestPayslip: payslip,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
