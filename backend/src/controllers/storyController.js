/**
 * MCS (Mauya Chat&Social) - Stories Controller
 * Код 16: Контроллер историй (Backend)
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Создание истории
 * POST /api/stories
 */
const createStory = async (req, res) => {
  try {
    const userId = req.userId;
    const { mediaUrl, mediaType, caption } = req.body;

    if (!mediaUrl || !mediaType) {
      return res.status(400).json({
        success: false,
        error: 'Media URL and type required',
        message: 'URL медиа и тип обязательны'
      });
    }

    if (!['image', 'video', 'text'].includes(mediaType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid media type',
        message: 'Тип медиа должен быть image, video или text'
      });
    }

    // История истекает через 24 часа
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const query = `
      INSERT INTO stories (user_id, media_url, media_type, caption, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      mediaUrl,
      mediaType,
      caption || null,
      expiresAt
    ]);

    logger.info(`Story created: ${result.rows[0].id} by ${userId}`);

    return res.status(201).json({
      success: true,
      message: 'История создана',
      data: {
        story: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Create story error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение активных историй контактов
 * GET /api/stories
 */
const getStories = async (req, res) => {
  try {
    const userId = req.userId;

    const query = `
      SELECT 
        s.*,
        u.username,
        u.display_name,
        u.avatar
      FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > NOW()
      ORDER BY s.created_at DESC
    `;

    const result = await db.query(query);

    return res.status(200).json({
      success: true,
      data: {
        stories: result.rows
      }
    });

  } catch (err) {
    logger.error('Get stories error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение историй пользователя
 * GET /api/stories/user/:userId
 */
const getUserStories = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId;

    const query = `
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM story_views WHERE story_id = s.id) as views_count,
        (SELECT COUNT(*) FROM story_views WHERE story_id = s.id AND viewer_id = $2) > 0 as viewed_by_me
      FROM stories s
      WHERE s.user_id = $1 AND s.expires_at > NOW()
      ORDER BY s.created_at ASC
    `;

    const result = await db.query(query, [targetUserId, currentUserId]);

    return res.status(200).json({
      success: true,
      data: {
        stories: result.rows
      }
    });

  } catch (err) {
    logger.error('Get user stories error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Отметка истории как просмотренной
 * POST /api/stories/:storyId/view
 */
const viewStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.userId;

    // Проверка существования истории
    const storyExists = await db.query(
      'SELECT user_id FROM stories WHERE id = $1 AND expires_at > NOW()',
      [storyId]
    );

    if (storyExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Story not found or expired'
      });
    }

    // Не засчитываем просмотры автора
    if (storyExists.rows[0].user_id === userId) {
      return res.status(200).json({
        success: true,
        message: 'Own story'
      });
    }

    const query = `
      INSERT INTO story_views (story_id, viewer_id)
      VALUES ($1, $2)
      ON CONFLICT (story_id, viewer_id) DO NOTHING
      RETURNING *
    `;

    await db.query(query, [storyId, userId]);

    // Обновление счётчика
    await db.query(
      'UPDATE stories SET views_count = (SELECT COUNT(*) FROM story_views WHERE story_id = $1) WHERE id = $1',
      [storyId]
    );

    return res.status(200).json({
      success: true,
      message: 'Просмотр засчитан'
    });

  } catch (err) {
    logger.error('View story error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение просмотров истории
 * GET /api/stories/:storyId/views
 */
const getStoryViews = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.userId;

    // Проверка что это история пользователя
    const storyCheck = await db.query(
      'SELECT user_id FROM stories WHERE id = $1',
      [storyId]
    );

    if (storyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      });
    }

    if (storyCheck.rows[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not your story'
      });
    }

    const query = `
      SELECT 
        sv.*,
        u.username,
        u.display_name,
        u.avatar
      FROM story_views sv
      JOIN users u ON sv.viewer_id = u.id
      WHERE sv.story_id = $1
      ORDER BY sv.viewed_at DESC
    `;

    const result = await db.query(query, [storyId]);

    return res.status(200).json({
      success: true,
      data: {
        views: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Get story views error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Удаление истории
 * DELETE /api/stories/:storyId
 */
const deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.userId;

    // Проверка владельца
    const ownerCheck = await db.query(
      'SELECT user_id FROM stories WHERE id = $1',
      [storyId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Story not found'
      });
    }

    if (ownerCheck.rows[0].user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not your story'
      });
    }

    await db.query('DELETE FROM stories WHERE id = $1', [storyId]);

    logger.info(`Story deleted: ${storyId}`);

    return res.status(200).json({
      success: true,
      message: 'История удалена'
    });

  } catch (err) {
    logger.error('Delete story error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Cron задача для автоудаления истекших историй
 */
const deleteExpiredStories = async () => {
  try {
    const result = await db.query(
      'DELETE FROM stories WHERE expires_at < NOW() RETURNING id'
    );

    if (result.rowCount > 0) {
      logger.info(`Deleted ${result.rowCount} expired stories`);
    }

    return result.rowCount;

  } catch (err) {
    logger.error('Delete expired stories error:', { error: err.message });
    return 0;
  }
};

module.exports = {
  createStory,
  getStories,
  getUserStories,
  viewStory,
  getStoryViews,
  deleteStory,
  deleteExpiredStories
};
