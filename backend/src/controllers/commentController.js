/**
 * MCS (Mauya Chat&Social) - Comments Controller
 * Код 15: Контроллер комментариев (Backend)
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Добавление комментария
 * POST /api/comments
 */
const addComment = async (req, res) => {
  try {
    const userId = req.userId;
    const { postId, content, parentCommentId } = req.body;

    if (!postId || !content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Post ID and content required',
        message: 'ID поста и содержимое обязательны'
      });
    }

    if (content.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Content too long',
        message: 'Комментарий не может быть длиннее 1000 символов'
      });
    }

    // Проверка существования поста
    const postExists = await db.query(
      'SELECT id FROM posts WHERE id = $1 AND is_deleted = FALSE',
      [postId]
    );

    if (postExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }

    const query = `
      INSERT INTO comments (post_id, author_id, parent_comment_id, content)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query(query, [
      postId,
      userId,
      parentCommentId || null,
      content
    ]);

    // Обновление счётчика комментариев
    await db.query(
      'UPDATE posts SET comments_count = (SELECT COUNT(*) FROM comments WHERE post_id = $1) WHERE id = $1',
      [postId]
    );

    logger.info(`Comment added: ${result.rows[0].id} on post ${postId}`);

    // Уведомление автора поста
    if (req.io) {
      const post = await db.query('SELECT author_id FROM posts WHERE id = $1', [postId]);
      if (post.rows[0].author_id !== userId) {
        req.io.to(`user:${post.rows[0].author_id}`).emit('new_comment', {
          postId,
          commentId: result.rows[0].id,
          from: userId
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Комментарий добавлен',
      data: {
        comment: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Add comment error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение комментариев к посту
 * GET /api/comments/post/:postId
 */
const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT 
        c.*,
        u.username,
        u.display_name,
        u.avatar,
        (SELECT COUNT(*) FROM comments WHERE parent_comment_id = c.id) as replies_count
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = $1 AND c.parent_comment_id IS NULL AND c.is_deleted = FALSE
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [postId, limit, offset]);

    return res.status(200).json({
      success: true,
      data: {
        comments: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Get comments error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение ответов на комментарий
 * GET /api/comments/:commentId/replies
 */
const getReplies = async (req, res) => {
  try {
    const { commentId } = req.params;

    const query = `
      SELECT 
        c.*,
        u.username,
        u.display_name,
        u.avatar
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.parent_comment_id = $1 AND c.is_deleted = FALSE
      ORDER BY c.created_at ASC
    `;

    const result = await db.query(query, [commentId]);

    return res.status(200).json({
      success: true,
      data: {
        replies: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Get replies error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Обновление комментария
 * PATCH /api/comments/:commentId
 */
const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Content required'
      });
    }

    // Проверка владельца
    const ownerCheck = await db.query(
      'SELECT author_id FROM comments WHERE id = $1',
      [commentId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    if (ownerCheck.rows[0].author_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not your comment'
      });
    }

    const query = `
      UPDATE comments 
      SET content = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(query, [content, commentId]);

    return res.status(200).json({
      success: true,
      message: 'Комментарий обновлён',
      data: {
        comment: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Update comment error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Удаление комментария
 * DELETE /api/comments/:commentId
 */
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId;

    // Проверка владельца
    const ownerCheck = await db.query(
      'SELECT author_id, post_id FROM comments WHERE id = $1',
      [commentId]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found'
      });
    }

    if (ownerCheck.rows[0].author_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not your comment'
      });
    }

    // Мягкое удаление
    await db.query(
      'UPDATE comments SET is_deleted = TRUE WHERE id = $1',
      [commentId]
    );

    // Обновление счётчика
    const postId = ownerCheck.rows[0].post_id;
    await db.query(
      'UPDATE posts SET comments_count = (SELECT COUNT(*) FROM comments WHERE post_id = $1 AND is_deleted = FALSE) WHERE id = $1',
      [postId]
    );

    logger.info(`Comment deleted: ${commentId}`);

    return res.status(200).json({
      success: true,
      message: 'Комментарий удалён'
    });

  } catch (err) {
    logger.error('Delete comment error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  addComment,
  getPostComments,
  getReplies,
  updateComment,
  deleteComment
};
