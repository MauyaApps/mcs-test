/**
 * MCS (Mauya Chat&Social) - Group Controller
 * Код 12: Контроллер групповых чатов (Backend)
 */

const db = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Создание группы
 * POST /api/groups
 */
const createGroup = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, description, isPublic, maxMembers } = req.body;

    // Валидация
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Group name required',
        message: 'Название группы обязательно'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Name too long',
        message: 'Название не может быть длиннее 100 символов'
      });
    }

    // Генерация группового ключа для E2EE
    const groupKey = uuidv4(); // В продакшене: использовать crypto

    const query = `
      INSERT INTO groups (
        name, 
        description, 
        creator_id, 
        group_key,
        is_public,
        max_members
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [
      name,
      description || null,
      userId,
      groupKey,
      isPublic || false,
      maxMembers || 256
    ]);

    const group = result.rows[0];

    // Добавление создателя как администратора
    await db.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [group.id, userId]
    );

    logger.info(`Group created: ${group.id} by ${userId}`);

    return res.status(201).json({
      success: true,
      message: 'Группа создана',
      data: {
        group: group
      }
    });

  } catch (err) {
    logger.error('Create group error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение информации о группе
 * GET /api/groups/:groupId
 */
const getGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    const query = `
      SELECT 
        g.*,
        u.username as creator_username,
        u.display_name as creator_display_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as members_count,
        gm.role as my_role
      FROM groups g
      LEFT JOIN users u ON g.creator_id = u.id
      LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $2
      WHERE g.id = $1
    `;

    const result = await db.query(query, [groupId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
        message: 'Группа не найдена'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        group: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Get group error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Обновление информации о группе
 * PATCH /api/groups/:groupId
 */
const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;
    const { name, description, avatar } = req.body;

    // Проверка прав (только админ)
    const memberCheck = await db.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Not a member',
        message: 'Вы не являетесь участником группы'
      });
    }

    if (memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not admin',
        message: 'Только администраторы могут редактировать группу'
      });
    }

    // Обновление
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
      paramCount++;
    }

    if (avatar !== undefined) {
      updates.push(`avatar = $${paramCount}`);
      values.push(avatar);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(groupId);

    const query = `
      UPDATE groups 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    logger.info(`Group updated: ${groupId} by ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Группа обновлена',
      data: {
        group: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Update group error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Удаление группы
 * DELETE /api/groups/:groupId
 */
const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    // Проверка что пользователь - создатель группы
    const groupCheck = await db.query(
      'SELECT creator_id FROM groups WHERE id = $1',
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Group not found'
      });
    }

    if (groupCheck.rows[0].creator_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only creator can delete group',
        message: 'Только создатель может удалить группу'
      });
    }

    // Удаление группы (каскадно удалятся участники и сообщения)
    await db.query('DELETE FROM groups WHERE id = $1', [groupId]);

    logger.info(`Group deleted: ${groupId} by ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Группа удалена'
    });

  } catch (err) {
    logger.error('Delete group error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Добавление участника в группу
 * POST /api/groups/:groupId/members
 */
const addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;
    const { memberId, role } = req.body;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        error: 'Member ID required'
      });
    }

    // Проверка прав (только админ)
    const memberCheck = await db.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admins can add members',
        message: 'Только администраторы могут добавлять участников'
      });
    }

    // Проверка лимита участников
    const groupInfo = await db.query(
      'SELECT max_members FROM groups WHERE id = $1',
      [groupId]
    );

    const currentCount = await db.query(
      'SELECT COUNT(*) as count FROM group_members WHERE group_id = $1',
      [groupId]
    );

    if (parseInt(currentCount.rows[0].count) >= groupInfo.rows[0].max_members) {
      return res.status(400).json({
        success: false,
        error: 'Group is full',
        message: 'Группа заполнена'
      });
    }

    // Добавление участника
    const query = `
      INSERT INTO group_members (group_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (group_id, user_id) DO NOTHING
      RETURNING *
    `;

    const result = await db.query(query, [
      groupId,
      memberId,
      role || 'member'
    ]);

    // Уведомление через WebSocket
    if (req.io) {
      req.io.to(`user:${memberId}`).emit('group_invite', {
        groupId: groupId,
        from: userId,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Member added to group: ${memberId} -> ${groupId}`);

    return res.status(201).json({
      success: true,
      message: 'Участник добавлен',
      data: {
        member: result.rows[0]
      }
    });

  } catch (err) {
    logger.error('Add member error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Удаление участника из группы
 * DELETE /api/groups/:groupId/members/:memberId
 */
const removeMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.userId;

    // Проверка прав
    const memberCheck = await db.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Not a member'
      });
    }

    // Админ может удалить любого, обычный участник - только себя
    const isAdmin = memberCheck.rows[0].role === 'admin';
    if (!isAdmin && memberId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'Недостаточно прав'
      });
    }

    // Удаление
    await db.query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, memberId]
    );

    logger.info(`Member removed from group: ${memberId} from ${groupId}`);

    return res.status(200).json({
      success: true,
      message: 'Участник удалён'
    });

  } catch (err) {
    logger.error('Remove member error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение списка участников группы
 * GET /api/groups/:groupId/members
 */
const getMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.userId;

    // Проверка что пользователь - участник группы
    const memberCheck = await db.query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Not a member',
        message: 'Вы не являетесь участником группы'
      });
    }

    const query = `
      SELECT 
        gm.id,
        gm.role,
        gm.joined_at,
        u.id as user_id,
        u.username,
        u.display_name,
        u.avatar,
        u.is_online,
        u.last_seen
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
      ORDER BY 
        CASE gm.role 
          WHEN 'admin' THEN 1 
          WHEN 'moderator' THEN 2 
          ELSE 3 
        END,
        gm.joined_at
    `;

    const result = await db.query(query, [groupId]);

    return res.status(200).json({
      success: true,
      data: {
        members: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Get members error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Получение списка групп пользователя
 * GET /api/groups/my
 */
const getMyGroups = async (req, res) => {
  try {
    const userId = req.userId;

    const query = `
      SELECT 
        g.*,
        gm.role as my_role,
        gm.joined_at,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as members_count,
        (SELECT COUNT(*) FROM messages WHERE group_id = g.id AND is_read = FALSE) as unread_count
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = $1
      ORDER BY g.updated_at DESC
    `;

    const result = await db.query(query, [userId]);

    return res.status(200).json({
      success: true,
      data: {
        groups: result.rows,
        count: result.rowCount
      }
    });

  } catch (err) {
    logger.error('Get my groups error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
  getMembers,
  getMyGroups
};
