/**
 * MCS (Mauya Chat&Social) - Extended Login Service
 * Код 2: Расширенный функционал входа в систему
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');
const logger = require('../utils/logger');
const db = require('../config/database');
const redis = require('../config/redis');

/**
 * Основная функция входа в систему
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { 
      username, 
      email, 
      password, 
      twoFactorCode,
      rememberDevice = false 
    } = req.body;

    // 1. Валидация входных данных
    if ((!username && !email) || !password) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Укажите username или email и пароль'
      });
    }

    // 2. Поиск пользователя в базе данных
    const query = username
      ? 'SELECT * FROM users WHERE username = $1'
      : 'SELECT * FROM users WHERE email = $1';
    
    const userResult = await db.query(query, [username || email]);

    if (userResult.rows.length === 0) {
      logger.warn(`Login attempt for non-existent user: ${username || email}`);
      
      // Защита от перебора: не указываем что именно неверно
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Неверное имя пользователя или пароль'
      });
    }

    const user = userResult.rows[0];

    // 3. Проверка пароля
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      logger.warn(`Failed login attempt for user: ${user.username}`);
      
      // Увеличение счетчика неудачных попыток
      await incrementFailedLoginAttempts(user.id);
      
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Неверное имя пользователя или пароль'
      });
    }

    // 4. Проверка блокировки аккаунта
    const isLocked = await checkAccountLockStatus(user.id);
    if (isLocked) {
      return res.status(403).json({
        success: false,
        error: 'Account locked',
        message: 'Аккаунт временно заблокирован из-за множественных неудачных попыток входа. Попробуйте через 15 минут.'
      });
    }

    // 5. Проверка 2FA (если включена)
    if (user.two_factor_secret) {
      // Проверяем, является ли это доверенным устройством
      const deviceId = req.headers['x-device-id'];
      const isTrustedDevice = deviceId ? await checkTrustedDevice(user.id, deviceId) : false;

      if (!isTrustedDevice) {
        if (!twoFactorCode) {
          return res.status(403).json({
            success: false,
            error: '2FA required',
            message: 'Требуется код двухфакторной аутентификации',
            requires2FA: true
          });
        }

        // Проверка TOTP кода
        const isValidCode = speakeasy.totp.verify({
          secret: user.two_factor_secret,
          encoding: 'base32',
          token: twoFactorCode,
          window: 2 // Разрешаем +/- 2 интервала (60 секунд)
        });

        if (!isValidCode) {
          logger.warn(`Invalid 2FA code for user: ${user.username}`);
          await incrementFailedLoginAttempts(user.id);
          
          return res.status(401).json({
            success: false,
            error: 'Invalid 2FA code',
            message: 'Неверный код двухфакторной аутентификации'
          });
        }

        // Если пользователь хочет запомнить устройство
        if (rememberDevice && deviceId) {
          await addTrustedDevice(user.id, deviceId, req);
        }
      }
    }

    // 6. Генерация JWT токенов
    const accessToken = jwt.sign(
      { 
        userId: user.id,
        username: user.username,
        type: 'access'
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // 7. Сохранение refresh token в Redis
    await redis.setex(
      `refresh_token:${user.id}`,
      7 * 24 * 60 * 60,
      refreshToken
    );

    // 8. Обновление статуса пользователя
    await db.query(
      'UPDATE users SET is_online = $1, last_seen = NOW() WHERE id = $2',
      [true, user.id]
    );

    // 9. Сброс счетчика неудачных попыток
    await resetFailedLoginAttempts(user.id);

    // 10. Логирование истории входа
    await logLoginHistory(user.id, req);

    // 11. Логирование успешного входа
    logger.info(`User logged in: ${user.username} (${user.id})`);

    // 12. Возврат данных пользователю
    return res.status(200).json({
      success: true,
      message: 'Вход выполнен успешно',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.display_name,
          avatar: user.avatar,
          bio: user.bio,
          publicKey: user.public_key,
          privacySettings: user.privacy_settings
        },
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresIn: 900 // 15 минут в секундах
        }
      }
    });

  } catch (err) {
    logger.error(`Login error: ${err.message}`, { stack: err.stack });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Произошла ошибка при входе. Попробуйте позже.'
    });
  }
};

/**
 * Вход через социальные сети (OAuth)
 * POST /api/auth/login/oauth
 */
const loginWithOAuth = async (req, res) => {
  try {
    const { provider, accessToken: oauthToken } = req.body;

    // Поддерживаемые провайдеры: google, facebook, apple
    const supportedProviders = ['google', 'facebook', 'apple'];
    
    if (!supportedProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider',
        message: 'Неподдерживаемый провайдер OAuth'
      });
    }

    // Верификация OAuth токена (зависит от провайдера)
    let userInfo;
    
    switch(provider) {
      case 'google':
        userInfo = await verifyGoogleToken(oauthToken);
        break;
      case 'facebook':
        userInfo = await verifyFacebookToken(oauthToken);
        break;
      case 'apple':
        userInfo = await verifyAppleToken(oauthToken);
        break;
    }

    if (!userInfo) {
      return res.status(401).json({
        success: false,
        error: 'Invalid OAuth token',
        message: 'Невалидный OAuth токен'
      });
    }

    // Поиск или создание пользователя
    let user = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [userInfo.email]
    );

    if (user.rows.length === 0) {
      // Создаём нового пользователя
      const newUserId = require('uuid').v4();
      const { generateKeyPair } = require('../crypto/keyGeneration');
      const keyPair = await generateKeyPair();

      await db.query(
        `INSERT INTO users (id, username, email, display_name, avatar, public_key, password_hash, oauth_provider)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newUserId,
          userInfo.email.split('@')[0] + '_' + Date.now(), // Генерация уникального username
          userInfo.email,
          userInfo.name,
          userInfo.picture,
          keyPair.publicKey,
          '', // OAuth пользователи не имеют пароля
          provider
        ]
      );

      user = await db.query('SELECT * FROM users WHERE id = $1', [newUserId]);
    }

    const userData = user.rows[0];

    // Генерация токенов
    const accessToken = jwt.sign(
      { userId: userData.id, username: userData.username, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: userData.id, username: userData.username, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    await redis.setex(`refresh_token:${userData.id}`, 7 * 24 * 60 * 60, refreshToken);

    logger.info(`OAuth login successful: ${userData.username} via ${provider}`);

    return res.status(200).json({
      success: true,
      message: 'OAuth вход успешен',
      data: {
        user: {
          id: userData.id,
          username: userData.username,
          email: userData.email,
          displayName: userData.display_name,
          avatar: userData.avatar,
          publicKey: userData.public_key
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 900
        }
      }
    });

  } catch (err) {
    logger.error(`OAuth login error: ${err.message}`, { stack: err.stack });
    return res.status(500).json({
      success: false,
      error: 'OAuth login failed',
      message: 'Ошибка при входе через OAuth'
    });
  }
};

/**
 * Получение истории входов пользователя
 * GET /api/auth/login-history
 */
const getLoginHistory = async (req, res) => {
  try {
    const userId = req.userId; // Из middleware
    const { limit = 10, offset = 0 } = req.query;

    const history = await db.query(
      `SELECT * FROM login_history 
       WHERE user_id = $1 
       ORDER BY logged_in_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        history: history.rows,
        total: history.rowCount
      }
    });

  } catch (err) {
    logger.error(`Get login history error: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Завершение всех активных сессий (кроме текущей)
 * POST /api/auth/logout-all
 */
const logoutAllDevices = async (req, res) => {
  try {
    const userId = req.userId;
    const currentRefreshToken = req.body.currentRefreshToken;

    // Удаление всех refresh токенов
    await redis.del(`refresh_token:${userId}`);

    // Если нужно сохранить текущую сессию
    if (currentRefreshToken) {
      await redis.setex(
        `refresh_token:${userId}`,
        7 * 24 * 60 * 60,
        currentRefreshToken
      );
    }

    // Удаление всех доверенных устройств
    await db.query('DELETE FROM trusted_devices WHERE user_id = $1', [userId]);

    logger.info(`All sessions terminated for user: ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Все сессии завершены'
    });

  } catch (err) {
    logger.error(`Logout all devices error: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// ============ Вспомогательные функции ============

/**
 * Увеличение счётчика неудачных попыток входа
 */
async function incrementFailedLoginAttempts(userId) {
  try {
    const key = `failed_login:${userId}`;
    const attempts = await redis.incr(key);
    
    // Устанавливаем TTL на 15 минут при первой попытке
    if (attempts === 1) {
      await redis.expire(key, 15 * 60);
    }
    
    // Блокируем аккаунт после 5 неудачных попыток
    if (attempts >= 5) {
      await redis.setex(`account_locked:${userId}`, 15 * 60, 'true');
    }
  } catch (err) {
    logger.error(`Failed to increment login attempts: ${err.message}`);
  }
}

/**
 * Сброс счётчика неудачных попыток
 */
async function resetFailedLoginAttempts(userId) {
  try {
    await redis.del(`failed_login:${userId}`);
    await redis.del(`account_locked:${userId}`);
  } catch (err) {
    logger.error(`Failed to reset login attempts: ${err.message}`);
  }
}

/**
 * Проверка блокировки аккаунта
 */
async function checkAccountLockStatus(userId) {
  try {
    const locked = await redis.get(`account_locked:${userId}`);
    return locked === 'true';
  } catch (err) {
    logger.error(`Failed to check lock status: ${err.message}`);
    return false;
  }
}

/**
 * Логирование истории входа
 */
async function logLoginHistory(userId, req) {
  try {
    const parser = new UAParser(req.headers['user-agent']);
    const deviceInfo = parser.getResult();
    const ip = req.ip || req.connection.remoteAddress;
    const geo = geoip.lookup(ip);

    await db.query(
      `INSERT INTO login_history (
        user_id, ip_address, device_type, browser, os, 
        city, country, logged_in_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        userId,
        ip,
        deviceInfo.device.type || 'desktop',
        deviceInfo.browser.name,
        deviceInfo.os.name,
        geo?.city || 'Unknown',
        geo?.country || 'Unknown'
      ]
    );
  } catch (err) {
    logger.error(`Failed to log login history: ${err.message}`);
  }
}

/**
 * Проверка доверенного устройства
 */
async function checkTrustedDevice(userId, deviceId) {
  try {
    const result = await db.query(
      'SELECT id FROM trusted_devices WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId]
    );
    return result.rows.length > 0;
  } catch (err) {
    logger.error(`Failed to check trusted device: ${err.message}`);
    return false;
  }
}

/**
 * Добавление доверенного устройства
 */
async function addTrustedDevice(userId, deviceId, req) {
  try {
    const parser = new UAParser(req.headers['user-agent']);
    const deviceInfo = parser.getResult();

    await db.query(
      `INSERT INTO trusted_devices (user_id, device_id, device_name, added_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, device_id) DO NOTHING`,
      [
        userId,
        deviceId,
        `${deviceInfo.browser.name} on ${deviceInfo.os.name}`
      ]
    );
  } catch (err) {
    logger.error(`Failed to add trusted device: ${err.message}`);
  }
}

/**
 * Верификация Google OAuth токена
 */
async function verifyGoogleToken(token) {
  // Здесь должна быть интеграция с Google OAuth API
  // Для примера возвращаем mock данные
  try {
    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    return {
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };
  } catch (err) {
    logger.error(`Google token verification failed: ${err.message}`);
    return null;
  }
}

/**
 * Верификация Facebook OAuth токена
 */
async function verifyFacebookToken(token) {
  // Интеграция с Facebook Graph API
  try {
    const axios = require('axios');
    const response = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${token}`
    );
    
    return {
      email: response.data.email,
      name: response.data.name,
      picture: response.data.picture.data.url
    };
  } catch (err) {
    logger.error(`Facebook token verification failed: ${err.message}`);
    return null;
  }
}

/**
 * Верификация Apple OAuth токена
 */
async function verifyAppleToken(token) {
  // Интеграция с Apple Sign In
  // Требует дополнительной настройки
  logger.warn('Apple OAuth not fully implemented');
  return null;
}

module.exports = {
  login,
  loginWithOAuth,
  getLoginHistory,
  logoutAllDevices
};
