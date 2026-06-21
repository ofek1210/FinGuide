const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/auth');
const { sendSummaryEmail, buildWhatsAppShareUrl } = require('../services/summaryEmailService');
const { getPayslipInsights } = require('../services/payslipInsightsService');
const { getInsuranceInsights } = require('../services/insuranceProfileAnalyzer');
const { getPensionInsights } = require('../services/pensionRiskAdvisor');
const { AppError } = require('../utils/appErrors');

router.use(protect);

/**
 * POST /api/summary-email/send
 * Body: { consent: true }
 *
 * Sends a personalized summary email to the authenticated user.
 * Requires explicit consent flag.
 */
router.post('/send', async (req, res, next) => {
  try {
    const { consent } = req.body;
    if (!consent) {
      return next(new AppError('נדרש אישור מפורש לשליחת מייל סיכום', 400));
    }
    const result = await sendSummaryEmail(req.user, true);
    return res.json({ success: true, message: `מייל נשלח בהצלחה ל-${result.sentTo}`, data: result });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/summary-email/whatsapp-url
 *
 * Returns a wa.me link with pre-filled summary text.
 * No external API call — pure URL generation.
 */
router.get('/whatsapp-url', async (req, res, next) => {
  try {
    const [payslip, insurance, pension] = await Promise.allSettled([
      getPayslipInsights(req.user._id),
      getInsuranceInsights(req.user._id),
      getPensionInsights(req.user._id),
    ]).then(results => results.map(r => (r.status === 'fulfilled' ? r.value : null)));

    const url = buildWhatsAppShareUrl(payslip, insurance, pension);
    return res.json({ success: true, data: { url } });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
