/**
 * MCS (Mauya Chat&Social) - Contacts Controller
 * Код 10: Контроллер контактов (Backend)
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Получение списка контактов
 * GET /api/contacts
 */
const getContacts = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT 
        c.id as contact_id,
        c.nickname,
        c.is_favorite,
        c.added_at,
        u.id as user_id,
        u.username,
        u.display_name,
        u.avatar,
        u.bio,
        u.is_online,
        u.last_seen
      FROM contacts c
      JOIN users u ON c.contact_id = u.id
      WHERE c.user_id = $1
      ORDER BY 
        c.is_favorite DESC,
        u.is_online DESC,
        u.display_name
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [userId, limit, offset]);

    return res.status(200).json({
      success: true,
      data: {
        contacts: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Get contacts error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Добавление контакта
 * POST /api/contacts
 */
const addContact = async (req, res) => {
  try {
    const userId = req.userId;
    const { contactId, nickname } = req.body;

    if (!contactId) {
      return res.status(400).json({
        success: false,
        error: 'Contact ID required',
        message: 'Укажите ID пользователя'
      });
    }

    // Нельзя добавить самого себя
    if (contactId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot add yourself',
        message: 'Нельзя добавить самого себя в контакты'
      });
    }

    // Проверка существования пользователя
    const userExists = await db.query(
      'SELECT id FROM users WHERE id = $1',
      [contactId]
    );

    if (userExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Пользователь не найден'
      });
    }

    // Проверка блокировки
    const isBlocked = await db.query(
      'SELECT id FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
      [contactId, userId]
    );

    if (isBlocked.rows.length > 0) {
      return res.status(403).json({
        success: false,
        error: 'User has blocked you',
        message: 'Пользователь заблокировал вас'
      });
    }

    // Добавление контакта
    const query = `
      INSERT INTO contacts (user_id, contact_id, nickname)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, contact_id) DO UPDATE
      SET nickname = EXCLUDED.nickname
      RETURNING *
    `;

    const result = await db.query(query, [userId, contactId, nickname || null]);

    logger.info(`Contact added: ${userId} -> ${contactId}`);

    // Отправка уведомления через WebSocket (если подключен)
    if (req.io) {
      req.io.to(`user:${contactId}`).emit('contact_request', {
        from: userId,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Контакт добавлен',
      data: {
        contact: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Add contact error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Удаление контакта
 * DELETE /api/contacts/:contactId
 */
const removeContact = async (req, res) => {
  try {
    const userId = req.userId;
    const { contactId } = req.params;

    const query = `
      DELETE FROM contacts 
      WHERE user_id = $1 AND contact_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [userId, contactId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
        message: 'Контакт не найден'
      });
    }

    logger.info(`Contact removed: ${userId} -> ${contactId}`);

    return res.status(200).json({
      success: true,
      message: 'Контакт удалён'
    });

  } catch (err) {
    logger.error('Remove contact error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Обновление псевдонима контакта
 * PATCH /api/contacts/:contactId
 */
const updateContactNickname = async (req, res) => {
  try {
    const userId = req.userId;
    const { contactId } = req.params;
    const { nickname } = req.body;

    const query = `
      UPDATE contacts 
      SET nickname = $1
      WHERE user_id = $2 AND contact_id = $3
      RETURNING *
    `;

    const result = await db.query(query, [nickname, userId, contactId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
        message: 'Контакт не найден'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Псевдоним обновлён',
      data: {
        contact: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Update nickname error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Добавление/удаление из избранного
 * PATCH /api/contacts/:contactId/favorite
 */
const toggleFavorite = async (req, res) => {
  try {
    const userId = req.userId;
    const { contactId } = req.params;
    const { isFavorite } = req.body;

    const query = `
      UPDATE contacts 
      SET is_favorite = $1
      WHERE user_id = $2 AND contact_id = $3
      RETURNING *
    `;

    const result = await db.query(query, [isFavorite, userId, contactId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
        message: 'Контакт не найден'
      });
    }

    return res.status(200).json({
      success: true,
      message: isFavorite ? 'Добавлено в избранное' : 'Удалено из избранного',
      data: {
        contact: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Toggle favorite error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Блокировка пользователя
 * POST /api/contacts/block
 */
const blockUser = async (req, res) => {
  try {
    const userId = req.userId;
    const { blockedId, reason } = req.body;

    if (!blockedId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required',
        message: 'Укажите ID пользователя'
      });
    }

    // Нельзя заблокировать самого себя
    if (blockedId === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot block yourself',
        message: 'Нельзя заблокировать самого себя'
      });
    }

    const query = `
      INSERT INTO blocked_users (blocker_id, blocked_id, reason)
      VALUES ($1, $2, $3)
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      RETURNING *
    `;

    const result = await db.query(query, [userId, blockedId, reason || null]);

    // Удаление из контактов
    await db.query(
      'DELETE FROM contacts WHERE user_id = $1 AND contact_id = $2',
      [userId, blockedId]
    );

    logger.info(`User blocked: ${userId} -> ${blockedId}`);

    return res.status(201).json({
      success: true,
      message: 'Пользователь заблокирован',
      data: {
        blocked: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Block user error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Разблокировка пользователя
 * DELETE /api/contacts/block/:blockedId
 */
const unblockUser = async (req, res) => {
  try {
    const userId = req.userId;
    const { blockedId } = req.params;

    const query = `
      DELETE FROM blocked_users 
      WHERE blocker_id = $1 AND blocked_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [userId, blockedId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not blocked',
        message: 'Пользователь не заблокирован'
      });
    }

    logger.info(`User unblocked: ${userId} -> ${blockedId}`);

    return res.status(200).json({
      success: true,
      message: 'Пользователь разблокирован'
    });

  } catch (err) {
    logger.error('Unblock user error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение списка заблокированных пользователей
 * GET /api/contacts/blocked
 */
const getBlockedUsers = async (req, res) => {
  try {
    const userId = req.userId;

    const query = `
      SELECT 
        b.id,
        b.blocked_at,
        b.reason,
        u.id as user_id,
        u.username,
        u.display_name,
        u.avatar
      FROM blocked_users b
      JOIN users u ON b.blocked_id = u.id
      WHERE b.blocker_id = $1
      ORDER BY b.blocked_at DESC
    `;

    const result = await db.query(query, [userId]);

    return res.status(200).json({
      success: true,
      data: {
        blocked: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Get blocked users error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  getContacts,
  addContact,
  removeContact,
  updateContactNickname,
  toggleFavorite,
  blockUser,
  unblockUser,
  getBlockedUsers
};
