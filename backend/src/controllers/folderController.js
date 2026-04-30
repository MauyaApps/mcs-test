/**
 * MCS - Chat Folders Controller
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * GET /api/folders
 * Все папки пользователя с количеством чатов
 */
const getFolders = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT f.id, f.name, f.icon, f.order_index,
              COUNT(fc.chat_id) AS chat_count
       FROM folders f
       LEFT JOIN folder_chats fc ON fc.folder_id = f.id
       WHERE f.user_id = $1
       GROUP BY f.id
       ORDER BY f.order_index ASC, f.created_at ASC`,
      [req.userId]
    );

    return res.json({ success: true, data: { folders: result.rows } });
  } catch (err) {
    logger.error(`getFolders error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

/**
 * POST /api/folders
 * Создать папку
 */
const createFolder = async (req, res) => {
  try {
    const { name, icon = '📁' } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Название обязательно' });

    // order_index = max + 1
    const maxResult = await db.query(
      'SELECT COALESCE(MAX(order_index), 0) + 1 AS next FROM folders WHERE user_id = $1',
      [req.userId]
    );
    const orderIndex = maxResult.rows[0].next;

    const result = await db.query(
      `INSERT INTO folders (user_id, name, icon, order_index)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, icon, order_index, created_at`,
      [req.userId, name.trim(), icon, orderIndex]
    );

    logger.info(`Folder created: ${result.rows[0].id} by user ${req.userId}`);
    return res.status(201).json({ success: true, data: { folder: result.rows[0] } });
  } catch (err) {
    logger.error(`createFolder error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

/**
 * PUT /api/folders/:id
 * Переименовать / изменить иконку / порядок
 */
const updateFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, order_index } = req.body;

    // Проверяем владельца
    const own = await db.query(
      'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (own.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Папка не найдена' });
    }

    const updates = [];
    const values = [];
    let p = 1;

    if (name !== undefined)        { updates.push(`name = $${p++}`);        values.push(name.trim()); }
    if (icon !== undefined)        { updates.push(`icon = $${p++}`);        values.push(icon); }
    if (order_index !== undefined) { updates.push(`order_index = $${p++}`); values.push(order_index); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Нет данных для обновления' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE folders SET ${updates.join(', ')} WHERE id = $${p} RETURNING id, name, icon, order_index`,
      values
    );

    return res.json({ success: true, data: { folder: result.rows[0] } });
  } catch (err) {
    logger.error(`updateFolder error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

/**
 * DELETE /api/folders/:id
 * Удалить папку (чаты не удаляются)
 */
const deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM folders WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Папка не найдена' });
    }

    logger.info(`Folder deleted: ${id} by user ${req.userId}`);
    return res.json({ success: true, message: 'Папка удалена' });
  } catch (err) {
    logger.error(`deleteFolder error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

/**
 * GET /api/folders/:id/chats
 * Список chat_id в папке
 */
const getFolderChats = async (req, res) => {
  try {
    const { id } = req.params;

    const own = await db.query(
      'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (own.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Папка не найдена' });
    }

    const result = await db.query(
      'SELECT chat_id, chat_type, added_at FROM folder_chats WHERE folder_id = $1 ORDER BY added_at ASC',
      [id]
    );

    return res.json({ success: true, data: { chats: result.rows } });
  } catch (err) {
    logger.error(`getFolderChats error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

/**
 * POST /api/folders/:id/chats
 * Добавить чат в папку
 */
const addChatToFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { chat_id, chat_type = 'contact' } = req.body;

    if (!chat_id) return res.status(400).json({ success: false, message: 'chat_id обязателен' });
    if (!['contact', 'group', 'channel'].includes(chat_type)) {
      return res.status(400).json({ success: false, message: 'Неверный chat_type' });
    }

    const own = await db.query(
      'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (own.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Папка не найдена' });
    }

    await db.query(
      `INSERT INTO folder_chats (folder_id, chat_id, chat_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (folder_id, chat_id) DO NOTHING`,
      [id, chat_id, chat_type]
    );

    return res.status(201).json({ success: true, message: 'Чат добавлен в папку' });
  } catch (err) {
    logger.error(`addChatToFolder error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

/**
 * DELETE /api/folders/:id/chats/:chatId
 * Убрать чат из папки
 */
const removeChatFromFolder = async (req, res) => {
  try {
    const { id, chatId } = req.params;

    const own = await db.query(
      'SELECT id FROM folders WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (own.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Папка не найдена' });
    }

    await db.query(
      'DELETE FROM folder_chats WHERE folder_id = $1 AND chat_id = $2',
      [id, chatId]
    );

    return res.json({ success: true, message: 'Чат убран из папки' });
  } catch (err) {
    logger.error(`removeChatFromFolder error: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
};

module.exports = { getFolders, createFolder, updateFolder, deleteFolder, getFolderChats, addChatToFolder, removeChatFromFolder };
