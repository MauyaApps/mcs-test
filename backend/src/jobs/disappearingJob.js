/**
 * MCS - Disappearing Messages Job
 * Удаляет истёкшие сообщения каждую минуту
 */

const db = require('../config/database');

const deleteExpiredMessages = async () => {
  try {
    const result = await db.query(
      `UPDATE messages
       SET is_deleted = TRUE,
           deleted_at = NOW(),
           encrypted_content = '[Сообщение удалено]'
       WHERE expires_at IS NOT NULL
         AND expires_at <= NOW()
         AND is_deleted = FALSE
       RETURNING id, sender_id, receiver_id`
    );

    if (result.rows.length > 0) {
      console.log(`🗑️ Deleted ${result.rows.length} expired messages`);
    }

    return result.rows;
  } catch (err) {
    console.error('Error deleting expired messages:', err);
    return [];
  }
};

const startDisappearingJob = (io) => {
  // Запускать каждые 30 секунд
  setInterval(async () => {
    const deleted = await deleteExpiredMessages();

    // Уведомить клиентов через WebSocket
    if (io && deleted.length > 0) {
      deleted.forEach(msg => {
        // Уведомить отправителя и получателя
        io.to(`user_${msg.sender_id}`).emit('message_deleted', { messageId: msg.id });
        io.to(`user_${msg.receiver_id}`).emit('message_deleted', { messageId: msg.id });
      });
    }
  }, 30000);

  console.log('⏱️ Disappearing messages job started');
};

module.exports = { startDisappearingJob, deleteExpiredMessages };
