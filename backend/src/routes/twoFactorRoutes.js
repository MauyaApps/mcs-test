/**
 * MCS - Two-Factor Authentication Routes
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { status, setup, enable, disable } = require('../controllers/twoFactorController');

router.get('/status', verifyToken, status);
router.post('/setup', verifyToken, setup);
router.post('/enable', verifyToken, enable);
router.post('/disable', verifyToken, disable);

module.exports = router;
