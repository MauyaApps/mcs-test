/**
 * MCS (Mauya Chat&Social) - Authentication Middleware
 * Код 4: Middleware для проверки JWT токенов
 */

const jwt = require('jsonwebtoken');
const redis = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Основной middleware для проверки JWT токена
 * Используется для защиты приватных маршрутов
 */
const verifyToken = async (req, res, next) => {
  try {
    // 1. Получение токена из заголовка Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn('No authorization header provided');
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        message: 'Требуется аутентификация. Токен не предоставлен.'
      });
    }

    // 2. Проверка формата: "Bearer TOKEN"
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      logger.warn('Invalid authorization header format');
      return res.status(401).json({
        success: false,
        error: 'Invalid token format',
        message: 'Неверный формат токена. Используйте: Bearer <token>'
      });
    }

    const token = parts[1];

    // 3. Верификация JWT токена
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        logger.warn('Expired token provided');
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          message: 'Токен истёк. Пожалуйста, обновите токен.',
          expired: true
        });
      }

      if (err.name === 'JsonWebTokenError') {
        logger.warn('Invalid token provided');
        return res.status(401).json({
          success: false,
          error: 'Invalid token',
          message: 'Невалидный токен.'
        });
      }

      throw err; // Другие ошибки
    }

    // 4. Проверка типа токена (должен быть access token)
    if (decoded.type !== 'access') {
      logger.warn('Wrong token type provided:', decoded.type);
      return res.status(401).json({
        success: false,
        error: 'Invalid token type',
        message: 'Неверный тип токена. Используйте access token.'
      });
    }

    // 5. Проверка в чёрном списке Redis (токены после logout)
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    
    if (isBlacklisted) {
      logger.warn(`Blacklisted token used by user: ${decoded.userId}`);
      return res.status(401).json({
        success: false,
        error: 'Token revoked',
        message: 'Токен был отозван. Пожалуйста, войдите снова.'
      });
    }

    // 6. Проверка существования refresh token в Redis (валидная сессия)
    const sessionExists = await redis.get(`refresh_token:${decoded.userId}`);
    
    if (!sessionExists) {
      logger.warn(`No active session for user: ${decoded.userId}`);
      return res.status(401).json({
        success: false,
        error: 'No active session',
        message: 'Сессия истекла. Пожалуйста, войдите снова.'
      });
    }

    // 7. Добавление данных пользователя в request объект
    req.userId = decoded.userId;
    req.username = decoded.username;
    req.token = token;

    // 8. Логирование успешной аутентификации (только в debug режиме)
    if (process.env.LOG_LEVEL === 'debug') {
      logger.debug(`User authenticated: ${decoded.username} (${decoded.userId})`);
    }

    // 9. Переход к следующему middleware или route handler
    next();

  } catch (err) {
    logger.error(`Authentication middleware error: ${err.message}`, { stack: err.stack });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Ошибка при проверке аутентификации'
    });
  }
};

/**
 * Опциональный middleware - не требует обязательной аутентификации
 * Если токен есть - проверяет и добавляет userId, если нет - пропускает
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Если токена нет - просто продолжаем без аутентификации
    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next();
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.type === 'access') {
        const isBlacklisted = await redis.get(`blacklist:${token}`);
        
        if (!isBlacklisted) {
          req.userId = decoded.userId;
          req.username = decoded.username;
          req.authenticated = true;
        }
      }
    } catch (err) {
      // Игнорируем ошибки - просто не добавляем userId
      logger.debug('Optional auth failed, continuing without auth');
    }

    next();

  } catch (err) {
    logger.error(`Optional auth error: ${err.message}`);
    next();
  }
};

/**
 * Middleware для проверки прав администратора
 * Должен использоваться ПОСЛЕ verifyToken
 */
const requireAdmin = async (req, res, next) => {
  try {
    // Проверяем что userId уже добавлен через verifyToken
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Требуется аутентификация'
      });
    }

    // Получаем пользователя из БД
    const db = require('../config/database');
    const result = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Пользователь не найден'
      });
    }

    const user = result.rows[0];

    // Проверка роли администратора
    if (user.role !== 'admin') {
      logger.warn(`Non-admin user attempted admin action: ${req.userId}`);
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Недостаточно прав. Требуются права администратора.'
      });
    }

    req.isAdmin = true;
    next();

  } catch (err) {
    logger.error(`Admin check error: ${err.message}`, { stack: err.stack });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Ошибка при проверке прав'
    });
  }
};

/**
 * Middleware для rate limiting (ограничение частоты запросов)
 * Защита от злоупотребления API
 */
const rateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  return async (req, res, next) => {
    try {
      const identifier = req.userId || req.ip; // По userId или IP
      const key = `rate_limit:${identifier}`;

      // Получение текущего счётчика
      const current = await redis.get(key);
      
      if (current && parseInt(current) >= maxRequests) {
        const ttl = await redis.ttl(key);
        
        logger.warn(`Rate limit exceeded for: ${identifier}`);
        
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          message: `Превышен лимит запросов. Попробуйте через ${Math.ceil(ttl / 60)} минут.`,
          retryAfter: ttl
        });
      }

      // Увеличение счётчика
      if (current) {
        await redis.incr(key);
      } else {
        await redis.setex(key, Math.floor(windowMs / 1000), '1');
      }

      // Добавление заголовков ответа
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - (parseInt(current) || 0) - 1);
      
      next();

    } catch (err) {
      logger.error(`Rate limiter error: ${err.message}`);
      // В случае ошибки - пропускаем запрос
      next();
    }
  };
};

/**
 * Middleware для проверки блокировки пользователя
 */
const checkUserBlocked = async (req, res, next) => {
  try {
    if (!req.userId) {
      return next();
    }

    const db = require('../config/database');
    const result = await db.query(
      'SELECT is_blocked, blocked_until, block_reason FROM users WHERE id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'Пользователь не найден'
      });
    }

    const user = result.rows[0];

    // Если пользователь заблокирован
    if (user.is_blocked) {
      // Проверяем временную блокировку
      if (user.blocked_until && new Date(user.blocked_until) < new Date()) {
        // Снимаем блокировку если время истекло
        await db.query(
          'UPDATE users SET is_blocked = FALSE, blocked_until = NULL WHERE id = $1',
          [req.userId]
        );
      } else {
        logger.warn(`Blocked user attempted access: ${req.userId}`);
        return res.status(403).json({
          success: false,
          error: 'User blocked',
          message: `Ваш аккаунт заблокирован. Причина: ${user.block_reason || 'Не указана'}`,
          blockedUntil: user.blocked_until
        });
      }
    }

    next();

  } catch (err) {
    logger.error(`Block check error: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Добавление токена в чёрный список при logout
 */
const blacklistToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
    
    if (expiresIn > 0) {
      await redis.setex(`blacklist:${token}`, expiresIn, 'true');
      logger.info(`Token blacklisted: ${token.substring(0, 20)}...`);
    }
  } catch (err) {
    logger.error(`Failed to blacklist token: ${err.message}`);
  }
};

module.exports = {
  verifyToken,
  optionalAuth,
  requireAdmin,
  rateLimiter,
  checkUserBlocked,
  blacklistToken
};
