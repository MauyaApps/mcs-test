/**
 * MCS (Mauya Chat&Social) - Message Socket Handler
 * Код 6: Отправка сообщения через WebSocket (Backend)
 */

const Message = require('../models/Message');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

const initializeMessageSocket = (io) => {

  // Middleware аутентификации WebSocket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId   = decoded.userId;
      socket.username = decoded.username;

      logger.info(`WebSocket authenticated: ${decoded.username} (${decoded.userId})`);
      next();

    } catch (err) {
      logger.error('WebSocket auth failed:', { error: err.message });
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    logger.info(`User connected via WebSocket: ${socket.username} (${userId})`);

    socket.join(`user:${userId}`);

    socket.emit('connected', {
      success: true,
      message: 'Connected to MCS WebSocket',
      userId,
      timestamp: new Date().toISOString()
    });

    // Обновляем онлайн статус
    const db = require('../config/database');
    db.query('UPDATE users SET is_online = TRUE WHERE id = $1', [userId]).catch(() => {});

    // ── ОТПРАВКА ЛИЧНОГО СООБЩЕНИЯ ──────────────────────────────────────────
    socket.on('send_message', async (data) => {
      try {
        logger.debug(`Message from ${socket.username}:`, data);

        // Базовая валидация
        if (!data.receiverId && !data.groupId) {
          socket.emit('message_error', {
            success: false,
            error: 'Validation error',
            message: 'Укажите получателя'
          });
          return;
        }

        if (!data.encryptedContent) {
          socket.emit('message_error', {
            success: false,
            error: 'Validation error',
            message: 'Сообщение не может быть пустым'
          });
          return;
        }

        // Создание сообщения в БД
        // Проверяем таймер исчезающих сообщений
        let expiresAt = null;
        if (data.receiverId) {
          const timerResult = await db.query(
            `SELECT timer_seconds FROM disappearing_settings
             WHERE user_id = $1 AND contact_id = $2`,
            [userId, data.receiverId]
          );
          const timerSeconds = timerResult.rows[0]?.timer_seconds || 0;
          if (timerSeconds > 0) {
            expiresAt = new Date(Date.now() + timerSeconds * 1000);
          }
        }

        const message = await Message.create({
          senderId:          userId,
          receiverId:        data.receiverId || null,
          groupId:           data.groupId    || null,
          encryptedContent:  data.encryptedContent,
          messageType:       data.messageType || 'text',
          mediaUrl:          data.mediaUrl    || null,
          replyToMessageId:  data.replyToMessageId || null,
          expiresAt
        });

        logger.info(`Message created: ${message.id}`);

        // Подтверждение отправителю
        socket.emit('message_sent', {
          success: true,
          message,
          tempId: data.tempId
        });

        // Доставка получателю
        if (data.receiverId) {
          io.to(`user:${data.receiverId}`).emit('new_message', {
            message,
            from: { userId, username: socket.username }
          });
        }

        // Доставка в группу
        if (data.groupId) {
          const members = await db.query(
            'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id != $2',
            [data.groupId, userId]
          );
          members.rows.forEach(member => {
            io.to(`user:${member.user_id}`).emit('new_message', {
              message,
              from: { userId, username: socket.username }
            });
          });
        }

      } catch (err) {
        logger.error('Error sending message:', { error: err.message });
        socket.emit('message_error', {
          success: false,
          error: 'Failed to send message',
          message: err.message
        });
      }
    });

    // ── ПЕЧАТАЕТ... ────────────────────────────────────────────────────────
    socket.on('typing_start', ({ receiverId }) => {
      if (receiverId) {
        io.to(`user:${receiverId}`).emit('user_typing', {
          userId, username: socket.username
        });
      }
    });

    socket.on('typing_stop', ({ receiverId }) => {
      if (receiverId) {
        io.to(`user:${receiverId}`).emit('user_stopped_typing', { userId });
      }
    });

    // ── ПРОЧИТАНО ──────────────────────────────────────────────────────────
    socket.on('mark_read', async ({ messageId, senderId }) => {
      try {
        await Message.markAsRead(messageId, userId);
        io.to(`user:${senderId}`).emit('message_read', {
          messageId,
          readBy: userId,
          readAt: new Date().toISOString()
        });
      } catch (err) {
        logger.error('Error marking as read:', { error: err.message });
      }
    });

    // ── ОТКЛЮЧЕНИЕ ─────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      try {
        logger.info(`User disconnected: ${socket.username}`);
        await db.query(
          'UPDATE users SET is_online = FALSE, last_seen = NOW() WHERE id = $1',
          [userId]
        );
      } catch (err) {
        logger.error('Error in disconnect:', { error: err.message });
      }
    });
  });

  logger.info('✅ Message WebSocket handlers initialized');
};

module.exports = { initializeMessageSocket };
