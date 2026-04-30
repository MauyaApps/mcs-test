/**
 * MCS (Mauya Chat&Social) - User Profile Controller
 * Код 9: Контроллер профиля пользователя (Backend)
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Получение профиля пользователя
 * GET /api/users/:userId
 */
const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT 
        id, 
        username, 
        email, 
        display_name, 
        bio, 
        avatar, 
        date_of_birth,
        phone_number,
        is_online,
        last_seen,
        created_at
      FROM users 
      WHERE id = $1
    `;

    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Пользователь не найден'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Get user profile error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Обновление собственного профиля
 * PATCH /api/users/me
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.userId; // Из JWT middleware
    const { displayName, bio, dateOfBirth, phoneNumber } = req.body;

    // Валидация
    if (displayName && (displayName.length < 1 || displayName.length > 100)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid display name',
        message: 'Имя должно быть от 1 до 100 символов'
      });
    }

    if (bio && bio.length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bio',
        message: 'Биография не может быть длиннее 500 символов'
      });
    }

    // Построение динамического запроса
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${paramCount}`);
      values.push(displayName);
      paramCount++;
    }

    if (bio !== undefined) {
      updates.push(`bio = $${paramCount}`);
      values.push(bio);
      paramCount++;
    }

    if (dateOfBirth !== undefined) {
      updates.push(`date_of_birth = $${paramCount}`);
      values.push(dateOfBirth);
      paramCount++;
    }

    if (phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramCount}`);
      values.push(phoneNumber);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided',
        message: 'Нет данных для обновления'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING 
        id, username, email, display_name, bio, 
        avatar, date_of_birth, phone_number, updated_at
    `;

    const result = await db.query(query, values);

    logger.info(`Profile updated for user: ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Профиль обновлён',
      data: {
        user: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Update profile error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Загрузка аватара
 * POST /api/users/avatar
 */
const uploadAvatar = async (req, res) => {
  try {
    const userId = req.userId;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Файл не загружен'
      });
    }

    // В реальном приложении здесь будет загрузка в MinIO/S3
    // Для примера используем заглушку
    const avatarUrl = `/uploads/avatars/${userId}_${Date.now()}.jpg`;

    const query = `
      UPDATE users 
      SET avatar = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING avatar
    `;

    const result = await db.query(query, [avatarUrl, userId]);

    logger.info(`Avatar updated for user: ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Аватар обновлён',
      data: {
        avatarUrl: result.rows[0].avatar
      }
    });

  } catch (err) {
    logger.error('Upload avatar error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Удаление аватара
 * DELETE /api/users/avatar
 */
const deleteAvatar = async (req, res) => {
  try {
    const userId = req.userId;

    const query = `
      UPDATE users 
      SET avatar = NULL, updated_at = NOW()
      WHERE id = $1
    `;

    await db.query(query, [userId]);

    logger.info(`Avatar deleted for user: ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Аватар удалён'
    });

  } catch (err) {
    logger.error('Delete avatar error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Поиск пользователей
 * GET /api/users/search?q=query
 */
const searchUsers = async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;

    if (!q || q.trim().length < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query',
        message: 'Введите поисковый запрос'
      });
    }

    const searchTerm = `%${q.trim()}%`;
    const exactTerm = `${q.trim()}%`;

    const sqlQuery = `
      SELECT 
        id, username, display_name, avatar, bio, is_online, last_seen
      FROM users 
      WHERE 
        (username ILIKE $1 OR display_name ILIKE $1)
        AND id != $2
      ORDER BY 
        CASE WHEN username ILIKE $3 THEN 0 ELSE 1 END,
        CASE WHEN is_online THEN 0 ELSE 1 END,
        username ASC
      LIMIT $4 OFFSET $5
    `;

    const result = await db.query(sqlQuery, [searchTerm, req.userId, exactTerm, limit, offset]);

    return res.status(200).json({
      success: true,
      users: result.rows,
      data: {
        users: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Search users error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message
    });
  }
};

/**
 * Получение статистики пользователя
 * GET /api/users/:userId/stats
 */
const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const query = `
      SELECT 
        (SELECT COUNT(*) FROM contacts WHERE user_id = $1) as contacts_count,
        (SELECT COUNT(*) FROM followers WHERE following_id = $1) as followers_count,
        (SELECT COUNT(*) FROM followers WHERE follower_id = $1) as following_count,
        (SELECT COUNT(*) FROM posts WHERE author_id = $1 AND is_deleted = FALSE) as posts_count,
        (SELECT COUNT(*) FROM messages WHERE sender_id = $1) as messages_sent
    `;

    const result = await db.query(query, [userId]);

    return res.status(200).json({
      success: true,
      data: {
        stats: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Get user stats error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  getUserProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  searchUsers,
  getUserStats
};
