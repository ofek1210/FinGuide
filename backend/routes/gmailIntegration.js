const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getGmailStatus,
  connectGmail,
  syncGmail,
  disconnectGmail,
} = require('../controllers/gmailIntegrationController');

const router = express.Router();

router.use(protect);

router.get('/status', getGmailStatus);
router.post('/connect', connectGmail);
router.post('/sync', syncGmail);
router.delete('/disconnect', disconnectGmail);

module.exports = router;
