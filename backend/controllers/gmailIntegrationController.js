const {
  connectWithAuthorizationCode,
  disconnectGmail,
  syncGmailPayslips,
  getGmailIntegrationStatus,
} = require('../services/gmailService');

exports.getGmailStatus = async (req, res, next) => {
  try {
    const data = await getGmailIntegrationStatus(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.connectGmail = async (req, res, next) => {
  try {
    const { code, redirectUri } = req.body || {};
    const result = await connectWithAuthorizationCode(req.user.id, { code, redirectUri });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.syncGmail = async (req, res, next) => {
  try {
    const summary = await syncGmailPayslips(req.user.id);
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

exports.disconnectGmail = async (req, res, next) => {
  try {
    const data = await disconnectGmail(req.user.id);
    res.status(200).json({
      success: true,
      data,
      message: 'חיבור Gmail נותק בהצלחה',
    });
  } catch (error) {
    next(error);
  }
};
