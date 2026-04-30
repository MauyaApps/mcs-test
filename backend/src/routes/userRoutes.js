/**
 * MCS - User Routes
 * ВАЖНО: /search должен быть ВЫШЕ /:userId иначе Express примет 'search' как userId
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  getUserProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  searchUsers,
  getUserStats
} = require('../controllers/userController');

const { getPrivacy, updatePrivacy } = require('../controllers/privacyController');

const {
  getContacts,
  addContact,
  removeContact,
  updateContactNickname,
  toggleFavorite,
  blockUser,
  unblockUser,
  getBlockedUsers
} = require('../controllers/contactController');

// ──────────────────────────────────────────
// Маршруты БЕЗ параметров — ВСЕГДА ПЕРВЫМИ
// ──────────────────────────────────────────

// Глобальный поиск пользователей
// GET /api/users/search?q=username
router.get('/search', verifyToken, searchUsers);

// ── Контакты ──────────────────────────────
// GET  /api/users/contacts
router.get('/contacts', verifyToken, getContacts);
// POST /api/users/contacts
router.post('/contacts', verifyToken, addContact);
// GET  /api/users/contacts/blocked
router.get('/contacts/blocked', verifyToken, getBlockedUsers);
// POST /api/users/contacts/block
router.post('/contacts/block', verifyToken, blockUser);
// DELETE /api/users/contacts/block/:blockedId
router.delete('/contacts/block/:blockedId', verifyToken, unblockUser);
// DELETE /api/users/contacts/:contactId
router.delete('/contacts/:contactId', verifyToken, removeContact);
// PATCH  /api/users/contacts/:contactId
router.patch('/contacts/:contactId', verifyToken, updateContactNickname);
// PATCH  /api/users/contacts/:contactId/favorite
router.patch('/contacts/:contactId/favorite', verifyToken, toggleFavorite);

// Настройки приватности
// GET  /api/users/privacy
router.get('/privacy', verifyToken, getPrivacy);
// PUT  /api/users/privacy
router.put('/privacy', verifyToken, updatePrivacy);

// Обновление своего профиля
// PATCH /api/users/me
router.patch('/me', verifyToken, updateProfile);

// Загрузка аватара
// POST /api/users/avatar
router.post('/avatar', verifyToken, uploadAvatar);

// Удаление аватара
// DELETE /api/users/avatar
router.delete('/avatar', verifyToken, deleteAvatar);

// ──────────────────────────────────────────
// Маршруты С параметрами — ВСЕГДА ПОСЛЕДНИМИ
// ──────────────────────────────────────────

// Получение профиля по ID
// GET /api/users/:userId
router.get('/:userId', verifyToken, getUserProfile);

// Статистика пользователя
// GET /api/users/:userId/stats
router.get('/:userId/stats', verifyToken, getUserStats);

module.exports = router;
