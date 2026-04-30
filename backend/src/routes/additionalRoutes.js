/**
 * MCS (Mauya Chat&Social) - Additional Routes
 * Код 19: Маршруты для комментариев, историй, уведомлений и настроек (Backend)
 */

const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const storyController = require('../controllers/storyController');
const notificationController = require('../controllers/notificationController');
const settingsController = require('../controllers/settingsController');
const { verifyToken, rateLimiter } = require('../middleware/authMiddleware');

// ==========================================
// КОММЕНТАРИИ
// ==========================================

/**
 * POST /api/comments
 * Добавление комментария
 */
router.post(
  '/comments',
  verifyToken,
  rateLimiter(30, 60 * 1000),
  commentController.addComment
);

/**
 * GET /api/comments/post/:postId
 * Получение комментариев к посту
 */
router.get(
  '/comments/post/:postId',
  verifyToken,
  commentController.getPostComments
);

/**
 * GET /api/comments/:commentId/replies
 * Получение ответов на комментарий
 */
router.get(
  '/comments/:commentId/replies',
  verifyToken,
  commentController.getReplies
);

/**
 * PATCH /api/comments/:commentId
 * Обновление комментария
 */
router.patch(
  '/comments/:commentId',
  verifyToken,
  commentController.updateComment
);

/**
 * DELETE /api/comments/:commentId
 * Удаление комментария
 */
router.delete(
  '/comments/:commentId',
  verifyToken,
  commentController.deleteComment
);

// ==========================================
// ИСТОРИИ
// ==========================================

/**
 * POST /api/stories
 * Создание истории
 */
router.post(
  '/stories',
  verifyToken,
  rateLimiter(10, 60 * 60 * 1000), // 10 историй в час
  storyController.createStory
);

/**
 * GET /api/stories
 * Получение историй контактов
 */
router.get(
  '/stories',
  verifyToken,
  storyController.getStories
);

/**
 * GET /api/stories/user/:userId
 * Получение историй пользователя
 */
router.get(
  '/stories/user/:userId',
  verifyToken,
  storyController.getUserStories
);

/**
 * POST /api/stories/:storyId/view
 * Отметка истории как просмотренной
 */
router.post(
  '/stories/:storyId/view',
  verifyToken,
  storyController.viewStory
);

/**
 * GET /api/stories/:storyId/views
 * Получение просмотров истории
 */
router.get(
  '/stories/:storyId/views',
  verifyToken,
  storyController.getStoryViews
);

/**
 * DELETE /api/stories/:storyId
 * Удаление истории
 */
router.delete(
  '/stories/:storyId',
  verifyToken,
  storyController.deleteStory
);

// ==========================================
// УВЕДОМЛЕНИЯ
// ==========================================

/**
 * GET /api/notifications
 * Получение уведомлений
 */
router.get(
  '/notifications',
  verifyToken,
  notificationController.getNotifications
);

/**
 * GET /api/notifications/unread-count
 * Количество непрочитанных
 */
router.get(
  '/notifications/unread-count',
  verifyToken,
  notificationController.getUnreadCount
);

/**
 * PATCH /api/notifications/:notificationId/read
 * Отметка как прочитанного
 */
router.patch(
  '/notifications/:notificationId/read',
  verifyToken,
  notificationController.markAsRead
);

/**
 * PATCH /api/notifications/mark-all-read
 * Отметка всех как прочитанных
 */
router.patch(
  '/notifications/mark-all-read',
  verifyToken,
  notificationController.markAllAsRead
);

/**
 * DELETE /api/notifications/:notificationId
 * Удаление уведомления
 */
router.delete(
  '/notifications/:notificationId',
  verifyToken,
  notificationController.deleteNotification
);

/**
 * DELETE /api/notifications/clear-all
 * Удаление всех уведомлений
 */
router.delete(
  '/notifications/clear-all',
  verifyToken,
  notificationController.clearAllNotifications
);

// ==========================================
// НАСТРОЙКИ
// ==========================================

/**
 * GET /api/settings
 * Получение настроек
 */
router.get(
  '/settings',
  verifyToken,
  settingsController.getSettings
);

/**
 * PATCH /api/settings/notifications
 * Обновление настроек уведомлений
 */
router.patch(
  '/settings/notifications',
  verifyToken,
  settingsController.updateNotificationSettings
);

/**
 * PATCH /api/settings/privacy
 * Обновление настроек приватности
 */
router.patch(
  '/settings/privacy',
  verifyToken,
  settingsController.updatePrivacySettings
);

/**
 * PATCH /api/settings/theme
 * Изменение темы
 */
router.patch(
  '/settings/theme',
  verifyToken,
  settingsController.updateTheme
);

/**
 * PATCH /api/settings/language
 * Изменение языка
 */
router.patch(
  '/settings/language',
  verifyToken,
  settingsController.updateLanguage
);

/**
 * GET /api/settings/export-data
 * Экспорт данных (GDPR)
 */
router.get(
  '/settings/export-data',
  verifyToken,
  rateLimiter(1, 24 * 60 * 60 * 1000), // 1 раз в 24 часа
  settingsController.exportUserData
);

/**
 * DELETE /api/settings/delete-account
 * Удаление аккаунта
 */
router.delete(
  '/settings/delete-account',
  verifyToken,
  rateLimiter(3, 60 * 60 * 1000), // 3 попытки в час
  settingsController.deleteAccount
);

module.exports = router;
