const { buildTaxAssistantSummary } = require('../services/taxAssistantService');
const { ValidationError } = require('../utils/appErrors');

exports.getTaxAssistantSummary = async (req, res, next) => {
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

    const data = await buildTaxAssistantSummary(req.user.id, year);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
