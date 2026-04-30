/**
 * MCS (Mauya Chat&Social) - Authentication Controller
 * Код 1: Регистрация пользователя с генерацией ключей E2EE
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const db = require('../config/database');
const { validateRegistration } = require('../utils/validation');

/**
 * Регистрация нового пользователя
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { username, email, password, publicKey, displayName } = req.body;

    // 1. Валидация входных данных
    const { error } = validateRegistration(req.body);
    if (error) {
      logger.warn(`Registration validation failed: ${error.details[0].message}`);
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message
      });
    }

    // 2. Проверка существования пользователя
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      logger.warn(`Registration attempt with existing credentials: ${username} or ${email}`);
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        message: 'Пользователь с таким именем или email уже существует'
      });
    }

    // 3. Хеширование пароля с использованием bcrypt (SALT_ROUNDS = 12)
    const SALT_ROUNDS = 12;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. Генерация уникального ID пользователя
    const userId = uuidv4();

    // 5. Сохранение пользователя в PostgreSQL
    const insertQuery = `
      INSERT INTO users (
        id, 
        username, 
        email, 
        password_hash, 
        display_name, 
        public_key,
        is_online,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING id, username, email, display_name, created_at
    `;

    const newUser = await db.query(insertQuery, [
      userId,
      username,
      email,
      passwordHash,
      displayName || username, // Если displayName не указан, используем username
      publicKey, // Публичный ключ для E2EE (сгенерирован на клиенте)
      false // По умолчанию пользователь оффлайн
    ]);

    // 6. Генерация JWT токенов
    const accessToken = jwt.sign(
      { 
        userId: userId,
        username: username,
        type: 'access'
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // Access token действует 15 минут
    );

    const refreshToken = jwt.sign(
      {
        userId: userId,
        username: username,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' } // Refresh token действует 7 дней
    );

    // 7. Сохранение refresh token в Redis для управления сессиями
    const redis = require('../config/redis');
    await redis.setex(
      `refresh_token:${userId}`,
      7 * 24 * 60 * 60, // 7 дней в секундах
      refreshToken
    );

    // 8. Логирование успешной регистрации
    logger.info(`New user registered: ${username} (${userId})`);

    // 9. Возврат успешного ответа
    return res.status(201).json({
      success: true,
      message: 'Регистрация успешна',
      data: {
        user: {
          id: newUser.rows[0].id,
          username: newUser.rows[0].username,
          email: newUser.rows[0].email,
          displayName: newUser.rows[0].display_name,
          createdAt: newUser.rows[0].created_at
        },
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresIn: 900 // 15 минут в секундах
        }
      }
    });

  } catch (err) {
    // Обработка ошибок
    logger.error(`Registration error: ${err.message}`, { stack: err.stack });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Произошла ошибка при регистрации. Попробуйте позже.'
    });
  }
};

/**
 * Вход в систему
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // 1. Валидация
    if ((!username && !email) || !password) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Укажите username или email и пароль'
      });
    }

    // 2. Поиск пользователя
    const query = username
      ? 'SELECT * FROM users WHERE username = $1'
      : 'SELECT * FROM users WHERE email = $1';
    
    const userResult = await db.query(query, [username || email]);

    if (userResult.rows.length === 0) {
      logger.warn(`Login attempt for non-existent user: ${username || email}`);
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
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'Неверное имя пользователя или пароль'
      });
    }

    // 4. Проверка 2FA (если включена)
    if (user.two_factor_secret) {
      // Если 2FA включена, требуем код
      const { twoFactorCode } = req.body;
      
      if (!twoFactorCode) {
        return res.status(403).json({
          success: false,
          error: '2FA required',
          message: 'Требуется код двухфакторной аутентификации',
          requires2FA: true
        });
      }

      // Проверка TOTP кода
      const speakeasy = require('speakeasy');
      const isValidCode = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 2 // Разрешаем +/- 2 интервала (60 секунд)
      });

      if (!isValidCode) {
        logger.warn(`Invalid 2FA code for user: ${user.username}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid 2FA code',
          message: 'Неверный код двухфакторной аутентификации'
        });
      }
    }

    // 5. Генерация токенов
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

    // 6. Сохранение refresh token в Redis
    const redis = require('../config/redis');
    await redis.setex(
      `refresh_token:${user.id}`,
      7 * 24 * 60 * 60,
      refreshToken
    );

    // 7. Обновление статуса пользователя на "онлайн"
    await db.query(
      'UPDATE users SET is_online = $1, last_seen = NOW() WHERE id = $2',
      [true, user.id]
    );

    // 8. Логирование успешного входа
    logger.info(`User logged in: ${user.username} (${user.id})`);

    // 9. Возврат данных
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
          publicKey: user.public_key
        },
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken,
          expiresIn: 900
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
 * Обновление токена
 * POST /api/auth/refresh
 */
const refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
        message: 'Refresh token обязателен'
      });
    }

    // 1. Верификация refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        message: 'Невалидный или истёкший refresh token'
      });
    }

    // 2. Проверка в Redis
    const redis = require('../config/redis');
    const storedToken = await redis.get(`refresh_token:${decoded.userId}`);

    if (storedToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Token mismatch',
        message: 'Refresh token не совпадает'
      });
    }

    // 3. Генерация нового access token
    const newAccessToken = jwt.sign(
      { 
        userId: decoded.userId,
        username: decoded.username,
        type: 'access'
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    logger.info(`Access token refreshed for user: ${decoded.userId}`);

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        expiresIn: 900
      }
    });

  } catch (err) {
    logger.error(`Token refresh error: ${err.message}`, { stack: err.stack });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Ошибка при обновлении токена'
    });
  }
};

/**
 * Выход из системы
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const userId = req.userId; // Из middleware

    // 1. Удаление refresh token из Redis
    const redis = require('../config/redis');
    await redis.del(`refresh_token:${userId}`);

    // 2. Обновление статуса пользователя
    await db.query(
      'UPDATE users SET is_online = $1, last_seen = NOW() WHERE id = $2',
      [false, userId]
    );

    logger.info(`User logged out: ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Выход выполнен успешно'
    });

  } catch (err) {
    logger.error(`Logout error: ${err.message}`, { stack: err.stack });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Ошибка при выходе'
    });
  }
};

/**
 * Проверка доступности username
 * GET /api/auth/check-username/:username
 */
const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.params;

    const result = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    return res.status(200).json({
      success: true,
      data: {
        available: result.rows.length === 0
      }
    });

  } catch (err) {
    logger.error(`Username check error: ${err.message}`);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Проверка доступности email
 * GET /api/auth/check-email/:email
 */
const checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.params;

    const result = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    return res.status(200).json({
      success: true,
      data: {
        available: result.rows.length === 0
      }
    });

  } catch (err) {
    logger.error(`Email check error: ${err.message}`);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  checkUsernameAvailability,
  checkEmailAvailability
};
