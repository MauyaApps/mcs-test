/**
 * MCS (Mauya Chat&Social) - Message Model
 * Код 5: Модель сообщения для работы с БД
 */

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Message Model
 * Модель для работы с сообщениями в PostgreSQL
 */
class Message {
  /**
   * Создание нового сообщения
   * @param {Object} messageData - Данные сообщения
   * @returns {Object} Созданное сообщение
   */
  static async create(messageData) {
    try {
      const {
        senderId,
        receiverId = null,
        groupId = null,
        encryptedContent,
        messageType = 'text',
        mediaUrl = null,
        replyToMessageId = null,
        expiresAt = null
      } = messageData;

      // Валидация: сообщение должно быть либо личным, либо групповым
      if ((!receiverId && !groupId) || (receiverId && groupId)) {
        throw new Error('Message must have either receiverId or groupId, not both');
      }

      const messageId = uuidv4();

      const query = `
        INSERT INTO messages (
          id, 
          sender_id, 
          receiver_id, 
          group_id,
          encrypted_content, 
          message_type, 
          media_url,
          reply_to_message_id,
          expires_at,
          timestamp
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING 
          id, 
          sender_id, 
          receiver_id, 
          group_id,
          encrypted_content, 
          message_type, 
          media_url,
          timestamp,
          is_read,
          reply_to_message_id,
          is_edited,
          is_deleted,
          expires_at
      `;

      const values = [
        messageId,
        senderId,
        receiverId,
        groupId,
        encryptedContent,
        messageType,
        mediaUrl,
        replyToMessageId,
        expiresAt
      ];

      const result = await db.query(query, values);

      logger.info(`Message created: ${messageId} from ${senderId}`);

      return result.rows[0];

    } catch (err) {
      logger.error(`Failed to create message: ${err.message}`, { stack: err.stack });
      throw err;
    }
  }

  /**
   * Получение сообщения по ID
   * @param {string} messageId - UUID сообщения
   * @returns {Object|null} Сообщение или null
   */
  static async findById(messageId) {
    try {
      const query = `
        SELECT 
          m.*,
          u.username as sender_username,
          u.display_name as sender_display_name,
          u.avatar as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = $1 AND m.is_deleted = FALSE
      `;

      const result = await db.query(query, [messageId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];

    } catch (err) {
      logger.error(`Failed to find message: ${err.message}`);
      throw err;
    }
  }

  /**
   * Получение истории личных сообщений между двумя пользователями
   * @param {string} userId1 - ID первого пользователя
   * @param {string} userId2 - ID второго пользователя
   * @param {number} limit - Лимит сообщений (по умолчанию 50)
   * @param {number} offset - Смещение для пагинации
   * @returns {Array} Массив сообщений
   */
  static async getPrivateMessageHistory(userId1, userId2, limit = 50, offset = 0) {
    try {
      const query = `
        SELECT 
          m.*,
          u.username as sender_username,
          u.display_name as sender_display_name,
          u.avatar as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE 
          m.is_deleted = FALSE
          AND (
            (m.sender_id = $1 AND m.receiver_id = $2) OR
            (m.sender_id = $2 AND m.receiver_id = $1)
          )
        ORDER BY m.timestamp DESC
        LIMIT $3 OFFSET $4
      `;

      const result = await db.query(query, [userId1, userId2, limit, offset]);

      return result.rows.reverse(); // Возвращаем в хронологическом порядке

    } catch (err) {
      logger.error(`Failed to get message history: ${err.message}`);
      throw err;
    }
  }

  /**
   * Получение сообщений группы
   * @param {string} groupId - ID группы
   * @param {number} limit - Лимит сообщений
   * @param {number} offset - Смещение
   * @returns {Array} Массив сообщений
   */
  static async getGroupMessages(groupId, limit = 50, offset = 0) {
    try {
      const query = `
        SELECT 
          m.*,
          u.username as sender_username,
          u.display_name as sender_display_name,
          u.avatar as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE 
          m.group_id = $1 
          AND m.is_deleted = FALSE
        ORDER BY m.timestamp DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await db.query(query, [groupId, limit, offset]);

      return result.rows.reverse();

    } catch (err) {
      logger.error(`Failed to get group messages: ${err.message}`);
      throw err;
    }
  }

  /**
   * Отметить сообщение как прочитанное
   * @param {string} messageId - ID сообщения
   * @param {string} userId - ID пользователя, который прочитал
   * @returns {Object} Обновлённое сообщение
   */
  static async markAsRead(messageId, userId) {
    try {
      // Проверяем что пользователь - получатель сообщения
      const checkQuery = `
        SELECT receiver_id FROM messages WHERE id = $1
      `;
      const checkResult = await db.query(checkQuery, [messageId]);

      if (checkResult.rows.length === 0) {
        throw new Error('Message not found');
      }

      if (checkResult.rows[0].receiver_id !== userId) {
        throw new Error('User is not the receiver of this message');
      }

      const query = `
        UPDATE messages
        SET is_read = TRUE, read_at = NOW()
        WHERE id = $1 AND is_read = FALSE
        RETURNING *
      `;

      const result = await db.query(query, [messageId]);

      if (result.rows.length > 0) {
        logger.debug(`Message marked as read: ${messageId}`);
      }

      return result.rows[0];

    } catch (err) {
      logger.error(`Failed to mark message as read: ${err.message}`);
      throw err;
    }
  }

  /**
   * Отметить все сообщения от пользователя как прочитанные
   * @param {string} receiverId - ID получателя
   * @param {string} senderId - ID отправителя
   * @returns {number} Количество обновлённых сообщений
   */
  static async markAllAsRead(receiverId, senderId) {
    try {
      const query = `
        UPDATE messages
        SET is_read = TRUE, read_at = NOW()
        WHERE 
          receiver_id = $1 
          AND sender_id = $2 
          AND is_read = FALSE
        RETURNING id
      `;

      const result = await db.query(query, [receiverId, senderId]);

      logger.info(`Marked ${result.rowCount} messages as read for user ${receiverId}`);

      return result.rowCount;

    } catch (err) {
      logger.error(`Failed to mark all messages as read: ${err.message}`);
      throw err;
    }
  }

  /**
   * Редактирование сообщения
   * @param {string} messageId - ID сообщения
   * @param {string} userId - ID пользователя (должен быть отправителем)
   * @param {string} newEncryptedContent - Новое зашифрованное содержимое
   * @returns {Object} Обновлённое сообщение
   */
  static async edit(messageId, userId, newEncryptedContent) {
    try {
      // Проверяем что пользователь - отправитель
      const checkQuery = `
        SELECT sender_id, timestamp FROM messages WHERE id = $1
      `;
      const checkResult = await db.query(checkQuery, [messageId]);

      if (checkResult.rows.length === 0) {
        throw new Error('Message not found');
      }

      if (checkResult.rows[0].sender_id !== userId) {
        throw new Error('User is not the sender of this message');
      }

      // Проверка времени (можно редактировать только в течение 48 часов)
      const messageAge = Date.now() - new Date(checkResult.rows[0].timestamp).getTime();
      const MAX_EDIT_TIME = 48 * 60 * 60 * 1000; // 48 часов

      if (messageAge > MAX_EDIT_TIME) {
        throw new Error('Message is too old to edit (max 48 hours)');
      }

      const query = `
        UPDATE messages
        SET 
          encrypted_content = $1, 
          is_edited = TRUE,
          edited_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await db.query(query, [newEncryptedContent, messageId]);

      logger.info(`Message edited: ${messageId}`);

      return result.rows[0];

    } catch (err) {
      logger.error(`Failed to edit message: ${err.message}`);
      throw err;
    }
  }

  /**
   * Удаление сообщения (мягкое удаление)
   * @param {string} messageId - ID сообщения
   * @param {string} userId - ID пользователя
   * @returns {Object} Обновлённое сообщение
   */
  static async delete(messageId, userId) {
    try {
      // Проверяем что пользователь - отправитель
      const checkQuery = `
        SELECT sender_id FROM messages WHERE id = $1
      `;
      const checkResult = await db.query(checkQuery, [messageId]);

      if (checkResult.rows.length === 0) {
        throw new Error('Message not found');
      }

      if (checkResult.rows[0].sender_id !== userId) {
        throw new Error('User is not the sender of this message');
      }

      const query = `
        UPDATE messages
        SET 
          is_deleted = TRUE,
          deleted_at = NOW(),
          encrypted_content = '[Сообщение удалено]'
        WHERE id = $1
        RETURNING *
      `;

      const result = await db.query(query, [messageId]);

      logger.info(`Message deleted: ${messageId}`);

      return result.rows[0];

    } catch (err) {
      logger.error(`Failed to delete message: ${err.message}`);
      throw err;
    }
  }

  /**
   * Получение непрочитанных сообщений пользователя
   * @param {string} userId - ID пользователя
   * @returns {Array} Массив непрочитанных сообщений
   */
  static async getUnreadMessages(userId) {
    try {
      const query = `
        SELECT 
          m.*,
          u.username as sender_username,
          u.display_name as sender_display_name,
          u.avatar as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE 
          m.receiver_id = $1 
          AND m.is_read = FALSE 
          AND m.is_deleted = FALSE
        ORDER BY m.timestamp DESC
      `;

      const result = await db.query(query, [userId]);

      return result.rows;

    } catch (err) {
      logger.error(`Failed to get unread messages: ${err.message}`);
      throw err;
    }
  }

  /**
   * Подсчёт непрочитанных сообщений
   * @param {string} userId - ID пользователя
   * @returns {number} Количество непрочитанных сообщений
   */
  static async getUnreadCount(userId) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM messages
        WHERE 
          receiver_id = $1 
          AND is_read = FALSE 
          AND is_deleted = FALSE
      `;

      const result = await db.query(query, [userId]);

      return parseInt(result.rows[0].count);

    } catch (err) {
      logger.error(`Failed to get unread count: ${err.message}`);
      throw err;
    }
  }

  /**
   * Подсчёт непрочитанных сообщений от конкретного пользователя
   * @param {string} receiverId - ID получателя
   * @param {string} senderId - ID отправителя
   * @returns {number} Количество непрочитанных сообщений
   */
  static async getUnreadCountFromUser(receiverId, senderId) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM messages
        WHERE 
          receiver_id = $1 
          AND sender_id = $2
          AND is_read = FALSE 
          AND is_deleted = FALSE
      `;

      const result = await db.query(query, [receiverId, senderId]);

      return parseInt(result.rows[0].count);

    } catch (err) {
      logger.error(`Failed to get unread count from user: ${err.message}`);
      throw err;
    }
  }

  /**
   * Поиск сообщений по содержимому (для незашифрованных или расшифрованных)
   * ВНИМАНИЕ: Для E2EE поиск должен происходить на клиенте!
   * Этот метод для будущего использования с индексацией
   * @param {string} userId - ID пользователя
   * @param {string} searchTerm - Поисковый запрос
   * @returns {Array} Найденные сообщения
   */
  static async search(userId, searchTerm) {
    try {
      // Примечание: для E2EE сообщений поиск по содержимому невозможен на сервере
      // Этот метод можно использовать для метаданных или будущих незашифрованных полей
      const query = `
        SELECT 
          m.*,
          u.username as sender_username,
          u.display_name as sender_display_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE 
          (m.sender_id = $1 OR m.receiver_id = $1)
          AND m.is_deleted = FALSE
          AND m.message_type = 'text'
        ORDER BY m.timestamp DESC
        LIMIT 100
      `;

      const result = await db.query(query, [userId]);

      // Клиент должен расшифровать и отфильтровать локально
      return result.rows;

    } catch (err) {
      logger.error(`Failed to search messages: ${err.message}`);
      throw err;
    }
  }

  /**
   * Получение последнего сообщения в чате
   * @param {string} userId1 - ID первого пользователя
   * @param {string} userId2 - ID второго пользователя
   * @returns {Object|null} Последнее сообщение
   */
  static async getLastMessage(userId1, userId2) {
    try {
      const query = `
        SELECT 
          m.*,
          u.username as sender_username,
          u.display_name as sender_display_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE 
          m.is_deleted = FALSE
          AND (
            (m.sender_id = $1 AND m.receiver_id = $2) OR
            (m.sender_id = $2 AND m.receiver_id = $1)
          )
        ORDER BY m.timestamp DESC
        LIMIT 1
      `;

      const result = await db.query(query, [userId1, userId2]);

      return result.rows.length > 0 ? result.rows[0] : null;

    } catch (err) {
      logger.error(`Failed to get last message: ${err.message}`);
      throw err;
    }
  }

  /**
   * Удаление всех сообщений в чате (для обоих пользователей)
   * @param {string} userId1 - ID первого пользователя
   * @param {string} userId2 - ID второго пользователя
   * @returns {number} Количество удалённых сообщений
   */
  static async deleteConversation(userId1, userId2) {
    try {
      const query = `
        UPDATE messages
        SET 
          is_deleted = TRUE,
          deleted_at = NOW(),
          encrypted_content = '[Сообщение удалено]'
        WHERE 
          (sender_id = $1 AND receiver_id = $2) OR
          (sender_id = $2 AND receiver_id = $1)
        RETURNING id
      `;

      const result = await db.query(query, [userId1, userId2]);

      logger.info(`Deleted conversation between ${userId1} and ${userId2}: ${result.rowCount} messages`);

      return result.rowCount;

    } catch (err) {
      logger.error(`Failed to delete conversation: ${err.message}`);
      throw err;
    }
  }

  /**
   * Получение статистики сообщений пользователя
   * @param {string} userId - ID пользователя
   * @returns {Object} Статистика
   */
  static async getUserStats(userId) {
    try {
      const query = `
        SELECT 
          COUNT(*) FILTER (WHERE sender_id = $1) as sent_count,
          COUNT(*) FILTER (WHERE receiver_id = $1) as received_count,
          COUNT(*) FILTER (WHERE receiver_id = $1 AND is_read = FALSE) as unread_count,
          COUNT(*) FILTER (WHERE sender_id = $1 AND message_type = 'image') as images_sent,
          COUNT(*) FILTER (WHERE sender_id = $1 AND message_type = 'video') as videos_sent,
          COUNT(*) FILTER (WHERE sender_id = $1 AND message_type = 'voice') as voice_sent
        FROM messages
        WHERE 
          (sender_id = $1 OR receiver_id = $1)
          AND is_deleted = FALSE
      `;

      const result = await db.query(query, [userId]);

      return {
        sent: parseInt(result.rows[0].sent_count),
        received: parseInt(result.rows[0].received_count),
        unread: parseInt(result.rows[0].unread_count),
        imagesSent: parseInt(result.rows[0].images_sent),
        videosSent: parseInt(result.rows[0].videos_sent),
        voiceSent: parseInt(result.rows[0].voice_sent)
      };

    } catch (err) {
      logger.error(`Failed to get user stats: ${err.message}`);
      throw err;
    }
  }
}

module.exports = Message;
