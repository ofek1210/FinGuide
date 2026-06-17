const { buildFinancialHealthScore } = require('../services/financialHealthScoreService');
const { ValidationError } = require('../utils/appErrors');

exports.getFinancialHealthScore = async (req, res, next) => {
  try {
    const year = Number(req.query.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return next(
        new ValidationError('שגיאות בולידציה', [
          {
            field: 'year',
            message: 'שנה חייבת להיות מספר בין 2000 ל-2100',
            value: req.query.year,
          },
        ]),
      );
    }

    const data = await buildFinancialHealthScore(req.user.id, year);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
