/**
 * MCS (Mauya Chat&Social) - Authentication Routes
 * API маршруты для аутентификации
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, rateLimiter } = require('../middleware/authMiddleware');

/**
 * POST /api/auth/register
 * Регистрация нового пользователя
 */
router.post(
  '/register',
  rateLimiter(5, 15 * 60 * 1000), // 5 попыток за 15 минут
  authController.register
);

/**
 * POST /api/auth/login
 * Вход в систему
 */
router.post(
  '/login',
  rateLimiter(10, 15 * 60 * 1000), // 10 попыток за 15 минут
  authController.login
);

/**
 * POST /api/auth/refresh
 * Обновление access токена
 */
router.post(
  '/refresh',
  authController.refreshAccessToken
);

/**
 * POST /api/auth/logout
 * Выход из системы (требует аутентификации)
 */
router.post(
  '/logout',
  verifyToken,
  authController.logout
);

/**
 * GET /api/auth/check-username/:username
 * Проверка доступности username
 */
router.get(
  '/check-username/:username',
  authController.checkUsernameAvailability
);

/**
 * GET /api/auth/check-email/:email
 * Проверка доступности email
 */
router.get(
  '/check-email/:email',
  authController.checkEmailAvailability
);

/**
 * GET /api/auth/me
 * Получение информации о текущем пользователе
 */
router.get(
  '/me',
  verifyToken,
  async (req, res) => {
    try {
      const db = require('../config/database');
      const result = await db.query(
        'SELECT id, username, email, display_name, avatar, bio, created_at FROM users WHERE id = $1',
        [req.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          user: result.rows[0]
        }
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

module.exports = router;
