/**
 * MCS - AI Routes
 * Маршруты для AI помощника
 */

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { verifyToken, rateLimiter } = require('../middleware/authMiddleware');

/**
 * POST /api/ai/chat
 * Отправка сообщения AI помощнику
 */
router.post(
  '/chat',
  verifyToken,
  rateLimiter(20, 60 * 1000), // 20 запросов в минуту
  aiController.chatWithAI
);

module.exports = router;
