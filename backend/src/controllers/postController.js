/**
 * MCS (Mauya Chat&Social) - Posts Controller
 * Код 13: Контроллер постов для социальной сети (Backend)
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Создание поста
 * POST /api/posts
 */
const createPost = async (req, res) => {
  try {
    const userId = req.userId;
    const { content, mediaUrls, privacy } = req.body;

    // Валидация
    if (!content && (!mediaUrls || mediaUrls.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Content or media required',
        message: 'Пост должен содержать текст или медиа'
      });
    }

    if (content && content.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Content too long',
        message: 'Текст не может быть длиннее 5000 символов'
      });
    }

    const query = `
      INSERT INTO posts (author_id, content, media_urls, privacy)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query(query, [
      userId,
      content || null,
      mediaUrls || [],
      privacy || 'public'
    ]);

    logger.info(`Post created: ${result.rows[0].id} by ${userId}`);

    return res.status(201).json({
      success: true,
      message: 'Пост создан',
      data: {
        post: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Create post error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение поста по ID
 * GET /api/posts/:postId
 */
const getPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    const query = `
      SELECT 
        p.*,
        u.username,
        u.display_name,
        u.avatar,
        (SELECT COUNT(*) FROM reactions WHERE post_id = p.id) as total_reactions,
        (SELECT reaction_type FROM reactions WHERE post_id = p.id AND user_id = $2) as my_reaction
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = $1 AND p.is_deleted = FALSE
    `;

    const result = await db.query(query, [postId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        message: 'Пост не найден'
      });
    }

    const post = result.rows[0];

    // Проверка приватности
    if (post.privacy === 'private' && post.author_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Private post',
        message: 'Это приватный пост'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        post: post
      }
    });

  } catch (err) {
    logger.error('Get post error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение ленты новостей
 * GET /api/posts/feed
 */
const getFeed = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 20, offset = 0 } = req.query;

    const query = `
      SELECT 
        p.*,
        u.username,
        u.display_name,
        u.avatar
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE 
        p.is_deleted = FALSE
        AND (
          p.privacy = 'public'
          OR p.author_id = $1
        )
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [userId, limit, offset]);

    return res.status(200).json({
      success: true,
      data: {
        posts: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Get feed error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение постов пользователя
 * GET /api/posts/user/:userId
 */
const getUserPosts = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId;
    const { limit = 20, offset = 0 } = req.query;

    const query = `
      SELECT 
        p.*,
        u.username,
        u.display_name,
        u.avatar,
        (SELECT COUNT(*) FROM reactions WHERE post_id = p.id) as total_reactions,
        (SELECT reaction_type FROM reactions WHERE post_id = p.id AND user_id = $2) as my_reaction
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE 
        p.author_id = $1
        AND p.is_deleted = FALSE
        AND (
          p.privacy = 'public'
          OR p.author_id = $2
          OR (p.privacy = 'friends' AND EXISTS (
            SELECT 1 FROM contacts WHERE user_id = p.author_id AND contact_id = $2
          ))
        )
      ORDER BY p.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await db.query(query, [targetUserId, currentUserId, limit, offset]);

    return res.status(200).json({
      success: true,
      data: {
        posts: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Get user posts error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Обновление поста
 * PATCH /api/posts/:postId
 */
const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;
    const { content, privacy } = req.body;

    // Проверка владельца
    const ownerCheck = await db.query(
      'SELECT author_id FROM posts WHERE id = $1',
      [postId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    if (ownerCheck.rows[0].author_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not your post',
        message: 'Это не ваш пост'
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (content !== undefined) {
      updates.push(`content = $${paramCount}`);
      values.push(content);
      paramCount++;
    }

    if (privacy !== undefined) {
      updates.push(`privacy = $${paramCount}`);
      values.push(privacy);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(postId);

    const query = `
      UPDATE posts 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    logger.info(`Post updated: ${postId} by ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Пост обновлён',
      data: {
        post: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Update post error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Удаление поста
 * DELETE /api/posts/:postId
 */
const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    // Проверка владельца
    const ownerCheck = await db.query(
      'SELECT author_id FROM posts WHERE id = $1',
      [postId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    if (ownerCheck.rows[0].author_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not your post'
      });
    }

    // Мягкое удаление
    await db.query(
      'UPDATE posts SET is_deleted = TRUE WHERE id = $1',
      [postId]
    );

    logger.info(`Post deleted: ${postId} by ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Пост удалён'
    });

  } catch (err) {
    logger.error('Delete post error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Добавление реакции
 * POST /api/posts/:postId/react
 */
const addReaction = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;
    const { reactionType } = req.body;

    const validReactions = ['like', 'love', 'laugh', 'wow', 'sad', 'angry'];
    
    if (!validReactions.includes(reactionType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reaction type'
      });
    }

    const query = `
      INSERT INTO reactions (post_id, user_id, reaction_type)
      VALUES ($1, $2, $3)
      ON CONFLICT (post_id, user_id) 
      DO UPDATE SET reaction_type = EXCLUDED.reaction_type
      RETURNING *
    `;

    const result = await db.query(query, [postId, userId, reactionType]);

    // Обновление счётчика
    await db.query(
      'UPDATE posts SET likes_count = (SELECT COUNT(*) FROM reactions WHERE post_id = $1) WHERE id = $1',
      [postId]
    );

    logger.debug(`Reaction added: ${reactionType} on post ${postId} by ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Реакция добавлена',
      data: {
        reaction: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Add reaction error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Удаление реакции
 * DELETE /api/posts/:postId/react
 */
const removeReaction = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.userId;

    await db.query(
      'DELETE FROM reactions WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );

    // Обновление счётчика
    await db.query(
      'UPDATE posts SET likes_count = (SELECT COUNT(*) FROM reactions WHERE post_id = $1) WHERE id = $1',
      [postId]
    );

    return res.status(200).json({
      success: true,
      message: 'Реакция удалена'
    });

  } catch (err) {
    logger.error('Remove reaction error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  createPost,
  getPost,
  getFeed,
  getUserPosts,
  updatePost,
  deletePost,
  addReaction,
  removeReaction
};
