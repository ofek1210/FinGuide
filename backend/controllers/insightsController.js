const Insight = require('../models/Insight');
const { NotFoundError } = require('../utils/appErrors');
const { runFullAnalysis } = require('../services/insightsEngine');

exports.listInsights = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.severity) filter.severity = req.query.severity;

    const insights = await Insight.find(filter).sort({ createdAt: -1 }).limit(100);
    return res.status(200).json({ success: true, count: insights.length, data: insights });
  } catch (err) {
    return next(err);
  }
};

exports.dismissInsight = async (req, res, next) => {
  try {
    const insight = await Insight.findOne({ _id: req.params.id, user: req.user._id });
    if (!insight) throw new NotFoundError('תובנה לא נמצאה');

    insight.status = 'dismissed';
    insight.dismissedAt = new Date();
    await insight.save();

    return res.status(200).json({ success: true, data: insight });
  } catch (err) {
    return next(err);
  }
};

exports.runAnalysis = async (req, res, next) => {
  try {
    const insights = await runFullAnalysis(req.user._id);
    return res.status(200).json({ success: true, count: insights.length, data: insights });
  } catch (err) {
    return next(err);
  }
};
