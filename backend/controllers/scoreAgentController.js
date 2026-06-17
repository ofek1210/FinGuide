const mongoose = require('mongoose');
const Document = require('../models/Document');
const { ValidationError, NotFoundError } = require('../utils/appErrors');
const {
  buildScoreGaps,
  parseGapId,
  applyGapAnswer,
} = require('../services/scoreGapService');

const parseYear = value => {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
};

// GET /api/score-agent/gaps?year=YYYY
exports.getGaps = async (req, res, next) => {
  try {
    const year = req.query.year != null ? parseYear(req.query.year) : new Date().getFullYear();
    if (year === null) {
      return next(
        new ValidationError('שגיאות בולידציה', [
          { field: 'year', message: 'שנה חייבת להיות מספר בין 2000 ל-2100', value: req.query.year },
        ]),
      );
    }

    const data = await buildScoreGaps(req.user.id, year);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// POST /api/score-agent/answer { gapId, documentId, value, year }
exports.submitAnswer = async (req, res, next) => {
  try {
    const { gapId, documentId, value } = req.body;
    const year = req.body.year != null ? parseYear(req.body.year) : new Date().getFullYear();

    const errors = [];
    const parsed = parseGapId(gapId);
    if (!parsed) errors.push({ field: 'gapId', message: 'מזהה שאלה לא תקין', value: gapId });
    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      errors.push({ field: 'documentId', message: 'מזהה מסמך לא תקין', value: documentId });
    }
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      errors.push({ field: 'value', message: 'יש להזין סכום חיובי', value });
    }
    if (year === null) {
      errors.push({ field: 'year', message: 'שנה חייבת להיות מספר בין 2000 ל-2100', value: req.body.year });
    }
    if (errors.length) return next(new ValidationError('שגיאות בולידציה', errors));

    const document = await Document.findOne({ _id: documentId, user: req.user.id });
    if (!document) return next(new NotFoundError('המסמך לא נמצא'));

    applyGapAnswer(document, parsed, amount);
    await document.save();

    // Recompute score + remaining gaps after the update
    const data = await buildScoreGaps(req.user.id, year);

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        saved: { gapId, value: amount, documentId },
      },
    });
  } catch (error) {
    return next(error);
  }
};
