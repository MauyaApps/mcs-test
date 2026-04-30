/**
 * MCS - Privacy Controller
 * GET/PUT /api/users/privacy
 */

const db = require('../config/database');
const logger = require('../utils/logger');

const DEFAULTS = {
  photo_visibility: 'everyone',      // everyone | contacts | nobody
  online_status_visibility: 'everyone',
  can_message: 'everyone',
  read_receipts: true,
};

/**
 * GET /api/users/privacy
 * Возвращает текущие настройки приватности
 */
const getPrivacy = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT privacy_settings FROM users WHERE id = $1',
      [req.userId]
    );

    const stored = result.rows[0]?.privacy_settings || {};
    const settings = { ...DEFAULTS, ...stored };

    return res.json({ success: true, data: { privacy: settings } });
  } catch (err) {
    logger.error(`getPrivacy error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

/**
 * PUT /api/users/privacy
 * Обновляет настройки приватности
 */
const updatePrivacy = async (req, res) => {
  try {
    const { photo_visibility, online_status_visibility, can_message, read_receipts } = req.body;

    const VISIBILITY = ['everyone', 'contacts', 'nobody'];

    if (photo_visibility && !VISIBILITY.includes(photo_visibility)) {
      return res.status(400).json({ success: false, message: 'Неверное значение photo_visibility' });
    }
    if (online_status_visibility && !VISIBILITY.includes(online_status_visibility)) {
      return res.status(400).json({ success: false, message: 'Неверное значение online_status_visibility' });
    }
    if (can_message && !['everyone', 'contacts', 'nobody'].includes(can_message)) {
      return res.status(400).json({ success: false, message: 'Неверное значение can_message' });
    }

    // Получаем текущие настройки и мержим
    const current = await db.query(
      'SELECT privacy_settings FROM users WHERE id = $1',
      [req.userId]
    );
    const existing = current.rows[0]?.privacy_settings || {};

    const updated = {
      ...DEFAULTS,
      ...existing,
      ...(photo_visibility !== undefined && { photo_visibility }),
      ...(online_status_visibility !== undefined && { online_status_visibility }),
      ...(can_message !== undefined && { can_message }),
      ...(read_receipts !== undefined && { read_receipts: Boolean(read_receipts) }),
    };

    await db.query(
      'UPDATE users SET privacy_settings = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updated), req.userId]
    );

    logger.info(`Privacy updated for user: ${req.userId}`);
    return res.json({ success: true, message: 'Настройки приватности обновлены', data: { privacy: updated } });
  } catch (err) {
    logger.error(`updatePrivacy error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

module.exports = { getPrivacy, updatePrivacy };
