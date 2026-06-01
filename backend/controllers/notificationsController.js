const Notification = require('../models/Notification');
const { NotFoundError } = require('../utils/appErrors');

exports.listNotifications = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.unreadOnly === 'true') filter.read = false;

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications,
    });
  } catch (err) {
    return next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });
    if (!notification) throw new NotFoundError('התראה לא נמצאה');
    notification.read = true;
    notification.readAt = new Date();
    await notification.save();
    return res.status(200).json({ success: true, data: notification });
  } catch (err) {
    return next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true, readAt: new Date() },
    );
    return res.status(200).json({ success: true });
  } catch (err) {
    return next(err);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!notification) throw new NotFoundError('התראה לא נמצאה');
    return res.status(200).json({ success: true });
  } catch (err) {
    return next(err);
  }
};
