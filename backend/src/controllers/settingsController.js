/**
 * MCS (Mauya Chat&Social) - Settings Controller
 * Код 18: Контроллер настроек и приватности (Backend)
 */

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Получение настроек пользователя
 * GET /api/settings
 */
const getSettings = async (req, res) => {
  try {
    const userId = req.userId;

    let query = `
      SELECT * FROM user_settings WHERE user_id = $1
    `;

    let result = await db.query(query, [userId]);

    // Если настроек нет - создать дефолтные
    if (result.rows.length === 0) {
      query = `
        INSERT INTO user_settings (user_id)
        VALUES ($1)
        RETURNING *
      `;
      result = await db.query(query, [userId]);
    }

    const settings = result.rows[0];

    return res.status(200).json({
      success: true,
      data: {
        settings: {
          ...settings,
          notifications: JSON.parse(settings.notifications),
          privacy: JSON.parse(settings.privacy)
        }
      }
    });

  } catch (err) {
    logger.error('Get settings error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Обновление настроек уведомлений
 * PATCH /api/settings/notifications
 */
const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.userId;
    const { messages, mentions, likes, comments, follows, groupInvites } = req.body;

    const notifications = {
      messages: messages !== undefined ? messages : true,
      mentions: mentions !== undefined ? mentions : true,
      likes: likes !== undefined ? likes : true,
      comments: comments !== undefined ? comments : true,
      follows: follows !== undefined ? follows : true,
      groupInvites: groupInvites !== undefined ? groupInvites : true
    };

    const query = `
      UPDATE user_settings
      SET notifications = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [JSON.stringify(notifications), userId]);

    logger.info(`Notification settings updated for ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Настройки уведомлений обновлены',
      data: {
        notifications: notifications
      }
    });

  } catch (err) {
    logger.error('Update notification settings error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Обновление настроек приватности
 * PATCH /api/settings/privacy
 */
const updatePrivacySettings = async (req, res) => {
  try {
    const userId = req.userId;
    const { profileVisible, lastSeen, readReceipts, groupInvites, storyView } = req.body;

    const privacy = {
      profileVisible: profileVisible || 'everyone', // everyone, contacts, nobody
      lastSeen: lastSeen || 'everyone',
      readReceipts: readReceipts !== undefined ? readReceipts : true,
      groupInvites: groupInvites || 'everyone',
      storyView: storyView || 'everyone'
    };

    const query = `
      UPDATE user_settings
      SET privacy = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [JSON.stringify(privacy), userId]);

    logger.info(`Privacy settings updated for ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Настройки приватности обновлены',
      data: {
        privacy: privacy
      }
    });

  } catch (err) {
    logger.error('Update privacy settings error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Изменение темы
 * PATCH /api/settings/theme
 */
const updateTheme = async (req, res) => {
  try {
    const userId = req.userId;
    const { theme } = req.body;

    const validThemes = ['light', 'dark', 'auto'];

    if (!validThemes.includes(theme)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid theme',
        message: 'Тема должна быть: light, dark или auto'
      });
    }

    const query = `
      UPDATE user_settings
      SET theme = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING theme
    `;

    const result = await db.query(query, [theme, userId]);

    return res.status(200).json({
      success: true,
      message: 'Тема изменена',
      data: {
        theme: result.rows[0].theme
      }
    });

  } catch (err) {
    logger.error('Update theme error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Изменение языка
 * PATCH /api/settings/language
 */
const updateLanguage = async (req, res) => {
  try {
    const userId = req.userId;
    const { language } = req.body;

    const validLanguages = ['ru', 'en', 'es', 'de', 'fr'];

    if (!validLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid language',
        message: 'Неподдерживаемый язык'
      });
    }

    const query = `
      UPDATE user_settings
      SET language = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING language
    `;

    const result = await db.query(query, [language, userId]);

    return res.status(200).json({
      success: true,
      message: 'Язык изменён',
      data: {
        language: result.rows[0].language
      }
    });

  } catch (err) {
    logger.error('Update language error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Экспорт данных пользователя (GDPR)
 * GET /api/settings/export-data
 */
const exportUserData = async (req, res) => {
  try {
    const userId = req.userId;

    // Сбор всех данных пользователя
    const userData = {};

    // Профиль
    const profile = await db.query(
      'SELECT username, email, display_name, bio, created_at FROM users WHERE id = $1',
      [userId]
    );
    userData.profile = profile.rows[0];

    // Сообщения
    const messages = await db.query(
      'SELECT COUNT(*) as count FROM messages WHERE sender_id = $1',
      [userId]
    );
    userData.messages = { count: parseInt(messages.rows[0].count) };

    // Посты
    const posts = await db.query(
      'SELECT id, content, created_at FROM posts WHERE author_id = $1 AND is_deleted = FALSE',
      [userId]
    );
    userData.posts = posts.rows;

    // Контакты
    const contacts = await db.query(
      'SELECT COUNT(*) as count FROM contacts WHERE user_id = $1',
      [userId]
    );
    userData.contacts = { count: parseInt(contacts.rows[0].count) };

    logger.info(`Data export requested by ${userId}`);

    return res.status(200).json({
      success: true,
      data: userData
    });

  } catch (err) {
    logger.error('Export data error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Удаление аккаунта
 * DELETE /api/settings/delete-account
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password required',
        message: 'Для удаления аккаунта требуется пароль'
      });
    }

    // Проверка пароля
    const bcrypt = require('bcrypt');
    const user = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    const isValid = await bcrypt.compare(password, user.rows[0].password_hash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
        message: 'Неверный пароль'
      });
    }

    // Удаление аккаунта (каскадно удалятся все связанные данные)
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    logger.warn(`Account deleted: ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Аккаунт удалён'
    });

  } catch (err) {
    logger.error('Delete account error:', { error: err.message });
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  getSettings,
  updateNotificationSettings,
  updatePrivacySettings,
  updateTheme,
  updateLanguage,
  exportUserData,
  deleteAccount
};
