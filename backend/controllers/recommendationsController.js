const Recommendation = require('../models/Recommendation');
const { NotFoundError } = require('../utils/appErrors');
const { run } = require('../services/insuranceRecommender');

exports.listRecommendations = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.kind) filter.kind = req.query.kind;
    if (req.query.importance) filter.importance = req.query.importance;

    const recommendations = await Recommendation.find(filter).sort({ importance: 1, createdAt: -1 }).limit(50);
    return res.status(200).json({ success: true, count: recommendations.length, data: recommendations });
  } catch (err) {
    return next(err);
  }
};

exports.runRecommendations = async (req, res, next) => {
  try {
    const recommendations = await run(req.user._id);
    return res.status(200).json({ success: true, count: recommendations.length, data: recommendations });
  } catch (err) {
    return next(err);
  }
};

exports.dismissRecommendation = async (req, res, next) => {
  try {
    const rec = await Recommendation.findOne({ _id: req.params.id, user: req.user._id });
    if (!rec) throw new NotFoundError('המלצה לא נמצאה');
    rec.status = 'dismissed';
    await rec.save();
    return res.status(200).json({ success: true, data: rec });
  } catch (err) {
    return next(err);
  }
};

exports.markPurchased = async (req, res, next) => {
  try {
    const rec = await Recommendation.findOne({ _id: req.params.id, user: req.user._id });
    if (!rec) throw new NotFoundError('המלצה לא נמצאה');
    rec.status = 'purchased';
    await rec.save();
    return res.status(200).json({ success: true, data: rec });
  } catch (err) {
    return next(err);
  }
};
