const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/auth');
const { getProfile, updateProfile } = require('../controllers/profileController');

router.use(protect);

router.get('/', getProfile);
router.patch('/', updateProfile);

module.exports = router;
