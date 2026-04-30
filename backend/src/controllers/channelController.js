/**
 * MCS - Channels Controller
 * Код 29: Контроллер каналов
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Создание канала
 * POST /api/channels
 */
const createChannel = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, description, isPublic } = req.body;

    if (!name || name.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Invalid name',
        message: 'Название должно быть минимум 3 символа'
      });
    }

    const query = `
      INSERT INTO channels (owner_id, name, description, is_public)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      name.trim(),
      description || null,
      isPublic !== false
    ]);

    // Автоматическая подписка создателя как админа
    await db.query(
      `INSERT INTO channel_subscribers (channel_id, user_id, role) VALUES ($1, $2, $3)`,
      [result.rows[0].id, userId, 'admin']
    );

    logger.info(`Channel created: ${result.rows[0].id} by user: ${userId}`);

    return res.status(201).json({
      success: true,
      data: {
        channel: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Create channel error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение моих каналов
 * GET /api/channels/my
 */
const getMyChannels = async (req, res) => {
  try {
    const userId = req.userId;

    const query = `
      SELECT c.*, cs.role
      FROM channels c
      JOIN channel_subscribers cs ON c.id = cs.channel_id
      WHERE cs.user_id = $1
      ORDER BY c.created_at DESC
    `;

    const result = await db.query(query, [userId]);

    return res.status(200).json({
      success: true,
      data: {
        channels: result.rows
      }
    });

  } catch (err) {
    logger.error('Get my channels error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Создание поста в канале
 * POST /api/channels/:channelId/posts
 */
const createChannelPost = async (req, res) => {
  try {
    const userId = req.userId;
    const { channelId } = req.params;
    const { content, mediaUrls } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Content required',
        message: 'Содержимое поста обязательно'
      });
    }

    // Проверка прав (только владелец или админ)
    const roleCheck = await db.query(
      `SELECT role FROM channel_subscribers WHERE channel_id = $1 AND user_id = $2`,
      [channelId, userId]
    );

    if (roleCheck.rows.length === 0 || !['admin', 'owner'].includes(roleCheck.rows[0].role)) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied',
        message: 'Только админы могут создавать посты'
      });
    }

    const query = `
      INSERT INTO channel_posts (channel_id, author_id, content, media_urls)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query(query, [
      channelId,
      userId,
      content,
      mediaUrls || []
    ]);

    return res.status(201).json({
      success: true,
      data: {
        post: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Create channel post error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение постов канала
 * GET /api/channels/:channelId/posts
 */
const getChannelPosts = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const query = `
      SELECT 
        cp.*,
        u.username,
        u.display_name,
        u.avatar
      FROM channel_posts cp
      JOIN users u ON cp.author_id = u.id
      WHERE cp.channel_id = $1
      ORDER BY cp.is_pinned DESC, cp.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [channelId, limit, offset]);

    return res.status(200).json({
      success: true,
      data: {
        posts: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Get channel posts error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Подписка на канал
 * POST /api/channels/:channelId/subscribe
 */
const subscribeChannel = async (req, res) => {
  try {
    const userId = req.userId;
    const { channelId } = req.params;

    // Проверка что канал существует
    const channelCheck = await db.query(
      `SELECT * FROM channels WHERE id = $1`,
      [channelId]
    );

    if (channelCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    // Подписка
    await db.query(
      `INSERT INTO channel_subscribers (channel_id, user_id, role) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (channel_id, user_id) DO NOTHING`,
      [channelId, userId, 'subscriber']
    );

    // Обновление счётчика
    await db.query(
      `UPDATE channels SET subscribers_count = subscribers_count + 1 WHERE id = $1`,
      [channelId]
    );

    return res.status(200).json({
      success: true,
      message: 'Подписка оформлена'
    });

  } catch (err) {
    logger.error('Subscribe channel error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Поиск каналов
 * GET /api/channels/search
 */
const searchChannels = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query too short',
        message: 'Минимум 2 символа для поиска'
      });
    }

    const query = `
      SELECT * FROM channels
      WHERE is_public = TRUE
      AND (name ILIKE $1 OR description ILIKE $1)
      ORDER BY subscribers_count DESC
      LIMIT 20
    `;

    const result = await db.query(query, [`%${q}%`]);

    return res.status(200).json({
      success: true,
      data: {
        channels: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Search channels error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  createChannel,
  getMyChannels,
  createChannelPost,
  getChannelPosts,
  subscribeChannel,
  searchChannels
};
