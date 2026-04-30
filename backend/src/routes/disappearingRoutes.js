const express = require('express');
const router = express.Router();
const { verifyToken: authenticateToken } = require('../middleware/authMiddleware');
const db = require('../config/database');

// Таймеры (секунды)
const TIMERS = {
  0: 'Выключено',
  60: '1 минута',
  3600: '1 час',
  86400: '24 часа',
  604800: '7 дней',
  2592000: '30 дней'
};

// GET /api/messages/disappearing/:contactId — получить настройку таймера
router.get('/:contactId', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      `SELECT timer_seconds FROM disappearing_settings
       WHERE user_id = $1 AND contact_id = $2`,
      [userId, contactId]
    );

    res.json({
      success: true,
      data: {
        timer_seconds: result.rows[0]?.timer_seconds || 0
      }
    });
  } catch (err) {
    console.error('Get disappearing settings error:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// PUT /api/messages/disappearing/:contactId — установить таймер
router.put('/:contactId', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;
    const userId = req.user.id;
    const { timer_seconds } = req.body;

    if (!Object.keys(TIMERS).map(Number).includes(Number(timer_seconds))) {
      return res.status(400).json({ success: false, message: 'Неверный таймер' });
    }

    await db.query(
      `INSERT INTO disappearing_settings (user_id, contact_id, timer_seconds, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, contact_id)
       DO UPDATE SET timer_seconds = $3, updated_at = NOW()`,
      [userId, contactId, timer_seconds]
    );

    // Установить таймер зеркально (для обоих участников)
    await db.query(
      `INSERT INTO disappearing_settings (user_id, contact_id, timer_seconds, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, contact_id)
       DO UPDATE SET timer_seconds = $3, updated_at = NOW()`,
      [contactId, userId, timer_seconds]
    );

    res.json({
      success: true,
      data: { timer_seconds: Number(timer_seconds), label: TIMERS[timer_seconds] }
    });
  } catch (err) {
    console.error('Set disappearing settings error:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

module.exports = router;
