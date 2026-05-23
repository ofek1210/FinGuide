const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} = require('../controllers/notificationsController');

router.use(protect);

router.get('/', listNotifications);
router.post('/read-all', markAllRead);
router.post('/:id/read', markRead);
router.delete('/:id', deleteNotification);

module.exports = router;
