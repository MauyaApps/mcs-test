/**
 * MCS (Mauya Chat&Social) - Groups & Posts Routes
 * Код 14: Маршруты для групп и постов (Backend)
 */

const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { verifyToken, rateLimiter } = require('../middleware/authMiddleware');

// ==========================================
// ГРУППЫ
// ==========================================

/**
 * POST /api/groups
 * Создание группы
 */
router.post(
  '/',
  verifyToken,
  rateLimiter(10, 60 * 60 * 1000), // 10 групп в час
  groupController.createGroup
);

/**
 * GET /api/groups/my
 * Получение моих групп
 */
router.get(
  '/my',
  verifyToken,
  groupController.getMyGroups
);

/**
 * GET /api/groups/:groupId
 * Получение информации о группе
 */
router.get(
  '/:groupId',
  verifyToken,
  groupController.getGroup
);

/**
 * PATCH /api/groups/:groupId
 * Обновление группы
 */
router.patch(
  '/:groupId',
  verifyToken,
  rateLimiter(20, 60 * 1000),
  groupController.updateGroup
);

/**
 * DELETE /api/groups/:groupId
 * Удаление группы
 */
router.delete(
  '/:groupId',
  verifyToken,
  groupController.deleteGroup
);

/**
 * GET /api/groups/:groupId/members
 * Получение списка участников
 */
router.get(
  '/:groupId/members',
  verifyToken,
  groupController.getMembers
);

/**
 * POST /api/groups/:groupId/members
 * Добавление участника
 */
router.post(
  '/:groupId/members',
  verifyToken,
  rateLimiter(30, 60 * 1000),
  groupController.addMember
);

/**
 * DELETE /api/groups/:groupId/members/:memberId
 * Удаление участника
 */
router.delete(
  '/:groupId/members/:memberId',
  verifyToken,
  groupController.removeMember
);

module.exports = router;
