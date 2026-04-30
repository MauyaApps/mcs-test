/**
 * MCS - Channels Routes
 * Маршруты для каналов
 */

const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const { verifyToken, rateLimiter } = require('../middleware/authMiddleware');

/**
 * POST /api/channels
 * Создание канала
 */
router.post(
  '/',
  verifyToken,
  rateLimiter(5, 60 * 60 * 1000), // 5 каналов в час
  channelController.createChannel
);

/**
 * GET /api/channels/my
 * Мои каналы
 */
router.get(
  '/my',
  verifyToken,
  channelController.getMyChannels
);

/**
 * GET /api/channels/search
 * Поиск каналов
 */
router.get(
  '/search',
  verifyToken,
  channelController.searchChannels
);

/**
 * POST /api/channels/:channelId/subscribe
 * Подписка на канал
 */
router.post(
  '/:channelId/subscribe',
  verifyToken,
  channelController.subscribeChannel
);

/**
 * POST /api/channels/:channelId/posts
 * Создание поста в канале
 */
router.post(
  '/:channelId/posts',
  verifyToken,
  rateLimiter(20, 60 * 60 * 1000), // 20 постов в час
  channelController.createChannelPost
);

/**
 * GET /api/channels/:channelId/posts
 * Посты канала
 */
router.get(
  '/:channelId/posts',
  verifyToken,
  channelController.getChannelPosts
);

module.exports = router;
