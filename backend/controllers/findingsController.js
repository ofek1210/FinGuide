const { buildSavingsForecast } = require('../services/savingsForecastService');
const { buildFindingsForUser } = require('../services/findingsForUserService');

exports.getFindings = async (req, res, next) => {
  try {
    const sortedFindings = await buildFindingsForUser(req.user._id || req.user.id);

    return res.status(200).json({
      success: true,
      count: sortedFindings.length,
      data: sortedFindings,
    });
  } catch (error) {
    return next(error);
  }
};

exports.getSavingsForecast = async (req, res, next) => {
  try {
    const forecast = await buildSavingsForecast({
      userId: req.user.id,
      input: req.body,
    });

    return res.status(200).json({
      success: true,
      data: forecast,
    });
  } catch (error) {
    return next(error);
  }
};
