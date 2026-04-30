/**
 * MCS - Posts Routes
 * Маршруты для постов
 */

const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { verifyToken, rateLimiter } = require('../middleware/authMiddleware');

/**
 * POST /api/posts
 * Создание поста
 */
router.post(
  '/',
  verifyToken,
  rateLimiter(20, 60 * 60 * 1000), // 20 постов в час
  postController.createPost
);

/**
 * GET /api/posts/feed
 * Получение ленты новостей
 */
router.get(
  '/feed',
  verifyToken,
  postController.getFeed
);

/**
 * GET /api/posts/user/:userId
 * Получение постов пользователя
 */
router.get(
  '/user/:userId',
  verifyToken,
  postController.getUserPosts
);

/**
 * GET /api/posts/:postId
 * Получение поста по ID
 */
router.get(
  '/:postId',
  verifyToken,
  postController.getPost
);

/**
 * PATCH /api/posts/:postId
 * Обновление поста
 */
router.patch(
  '/:postId',
  verifyToken,
  rateLimiter(30, 60 * 1000),
  postController.updatePost
);

/**
 * DELETE /api/posts/:postId
 * Удаление поста
 */
router.delete(
  '/:postId',
  verifyToken,
  postController.deletePost
);

/**
 * POST /api/posts/:postId/react
 * Добавление реакции на пост
 */
router.post(
  '/:postId/react',
  verifyToken,
  rateLimiter(100, 60 * 1000),
  postController.addReaction
);

/**
 * DELETE /api/posts/:postId/react
 * Удаление реакции
 */
router.delete(
  '/:postId/react',
  verifyToken,
  postController.removeReaction
);

module.exports = router;
