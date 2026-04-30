/**
 * MCS (Mauya Chat&Social) - Notifications Controller
 * Код 17: Контроллер уведомлений (Backend)
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Создание уведомления
 * @param {string} userId - ID пользователя
 * @param {string} type - Тип уведомления
 * @param {Object} content - Содержимое
 */
const createNotification = async (userId, type, content) => {
  try {
    const query = `
      INSERT INTO notifications (user_id, type, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const result = await db.query(query, [userId, type, JSON.stringify(content)]);

    logger.debug(`Notification created: ${result.rows[0].id} for ${userId}`);

    return result.rows[0];

  } catch (err) {
    logger.error('Create notification error:', { error: err.message });
    return null;
  }
};

/**
 * Получение уведомлений пользователя
 * GET /api/notifications
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 50, offset = 0, unreadOnly = false } = req.query;

    let query = `
      SELECT *
      FROM notifications
      WHERE user_id = $1
    `;

    const params = [userId];

    if (unreadOnly === 'true') {
      query += ' AND is_read = FALSE';
    }

    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Парсинг JSON content
    const notifications = result.rows.map(notif => ({
      ...notif,
      content: JSON.parse(notif.content)
    }));

    return res.status(200).json({
      success: true,
      data: {
        notifications: notifications,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Get notifications error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение количества непрочитанных
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;

    const query = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND is_read = FALSE
    `;

    const result = await db.query(query, [userId]);

    return res.status(200).json({
      success: true,
      data: {
        unreadCount: parseInt(result.rows[0].count)
      }
    });

  } catch (err) {
    logger.error('Get unread count error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Отметка уведомления как прочитанного
 * PATCH /api/notifications/:notificationId/read
 */
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;

    const query = `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [notificationId, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Отмечено как прочитанное'
    });

  } catch (err) {
    logger.error('Mark as read error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Отметка всех как прочитанных
 * PATCH /api/notifications/mark-all-read
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.userId;

    const query = `
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = $1 AND is_read = FALSE
      RETURNING id
    `;

    const result = await db.query(query, [userId]);

    logger.info(`Marked ${result.rowCount} notifications as read for ${userId}`);

    return res.status(200).json({
      success: true,
      message: `Отмечено ${result.rowCount} уведомлений`
    });

  } catch (err) {
    logger.error('Mark all as read error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Удаление уведомления
 * DELETE /api/notifications/:notificationId
 */
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.userId;

    const query = `
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;

    const result = await db.query(query, [notificationId, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Уведомление удалено'
    });

  } catch (err) {
    logger.error('Delete notification error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Удаление всех уведомлений
 * DELETE /api/notifications/clear-all
 */
const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.userId;

    const query = `
      DELETE FROM notifications
      WHERE user_id = $1
      RETURNING id
    `;

    const result = await db.query(query, [userId]);

    logger.info(`Cleared ${result.rowCount} notifications for ${userId}`);

    return res.status(200).json({
      success: true,
      message: `Удалено ${result.rowCount} уведомлений`
    });

  } catch (err) {
    logger.error('Clear all notifications error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Отправка Push-уведомления (заглушка для интеграции FCM/APNS)
 */
const sendPushNotification = async (userId, notification) => {
  try {
    // В продакшене здесь будет интеграция с FCM (Android) и APNS (iOS)
    logger.debug(`Push notification would be sent to ${userId}:`, notification);

    // Пример интеграции с Firebase Cloud Messaging:
    /*
    const admin = require('firebase-admin');
    
    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      token: deviceToken // Получить из БД
    };
    
    await admin.messaging().send(message);
    */

    return true;

  } catch (err) {
    logger.error('Send push notification error:', { error: err.message });
    return false;
  }
};

module.exports = {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  sendPushNotification
};
