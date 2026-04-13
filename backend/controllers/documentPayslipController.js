const Document = require('../models/Document');
const { NotFoundError } = require('../utils/appErrors');
const {
  serializePayslipDetail,
  serializePayslipHistory,
} = require('../serializers/payslipSerializer');

exports.getPayslipHistory = async (req, res, next) => {
  try {
    const documents = await Document.find({
      user: req.user.id,
      status: 'completed',
    }).sort('-uploadedAt');

    return res.status(200).json({
      success: true,
      data: serializePayslipHistory(documents),
    });
  } catch (error) {
    return next(error);
  }
};

exports.getPayslipDetail = async (req, res, next) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!document) {
      return next(new NotFoundError('מסמך לא נמצא'));
    }

    const payslip = serializePayslipDetail(document);
    if (!payslip) {
      return next(new NotFoundError('תלוש לא נמצא'));
    }

    return res.status(200).json({
      success: true,
      data: payslip,
    });
  } catch (error) {
    return next(error);
  }
};
