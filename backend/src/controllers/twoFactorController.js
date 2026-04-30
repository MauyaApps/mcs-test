/**
 * MCS - Two-Factor Authentication Controller
 */

const { generateSetup, enableTwoFactor, disableTwoFactor, getStatus } = require('../services/twoFactorService');
const logger = require('../utils/logger');

/**
 * GET /api/2fa/status
 * Статус 2FA текущего пользователя
 */
const status = async (req, res) => {
  try {
    const result = await getStatus(req.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`2FA status error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

/**
 * POST /api/2fa/setup
 * Начать настройку 2FA — генерирует QR-код
 */
const setup = async (req, res) => {
  try {
    const result = await generateSetup(req.userId, req.username);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`2FA setup error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Ошибка генерации 2FA' });
  }
};

/**
 * POST /api/2fa/enable
 * Подтвердить настройку кодом и активировать 2FA
 */
const enable = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Код обязателен' });

    await enableTwoFactor(req.userId, token);
    logger.info(`2FA enabled for user: ${req.userId}`);
    res.json({ success: true, message: 'Двухфакторная аутентификация включена' });
  } catch (err) {
    logger.warn(`2FA enable failed for ${req.userId}: ${err.message}`);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/2fa/disable
 * Отключить 2FA
 */
const disable = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Код для подтверждения обязателен' });

    // Проверяем текущий код перед отключением
    const { getStatus, verifyToken } = require('../services/twoFactorService');
    const db = require('../config/database');
    const result = await db.query('SELECT two_factor_secret FROM users WHERE id = $1', [req.userId]);
    const secret = result.rows[0]?.two_factor_secret;

    if (!secret) return res.status(400).json({ success: false, message: '2FA уже отключена' });

    const isValid = require('../services/twoFactorService').verifyToken(secret, token);
    if (!isValid) return res.status(400).json({ success: false, message: 'Неверный код' });

    await disableTwoFactor(req.userId);
    logger.info(`2FA disabled for user: ${req.userId}`);
    res.json({ success: true, message: 'Двухфакторная аутентификация отключена' });
  } catch (err) {
    logger.error(`2FA disable error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

module.exports = { status, setup, enable, disable };
