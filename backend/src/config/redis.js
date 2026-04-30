/**
 * MCS (Mauya Chat&Social) - Redis Configuration
 * Redis подключение для кеширования, сессий, очередей
 */

const redis = require('redis');

// Конфигурация подключения к Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  
  // Настройки переподключения
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  // Таймауты
  connectTimeout: 10000,
  maxRetriesPerRequest: 3
};

// Создание Redis клиента
const clientOptions = {
  socket: {
    host: redisConfig.host,
    port: redisConfig.port,
    reconnectStrategy: redisConfig.retryStrategy,
    connectTimeout: redisConfig.connectTimeout
  }
};
if (redisConfig.password) clientOptions.password = redisConfig.password;
const client = redis.createClient(clientOptions);

// Обработка событий подключения
client.on('connect', () => {
  console.log('🔗 Connecting to Redis...');
});

client.on('ready', () => {
  console.log('✅ Redis connection ready');
});

client.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

client.on('end', () => {
  console.log('Redis connection closed');
});

client.on('reconnecting', () => {
  console.log('🔄 Reconnecting to Redis...');
});

/**
 * Подключение к Redis
 */
const connect = async () => {
  try {
    await client.connect();
    console.log('✅ Redis connected successfully');
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', err.message);
    return false;
  }
};

/**
 * Проверка подключения
 */
const testConnection = async () => {
  try {
    const pong = await client.ping();
    console.log('✅ Redis ping successful:', pong);
    return true;
  } catch (err) {
    console.error('❌ Redis ping failed:', err.message);
    return false;
  }
};

/**
 * Установка значения с TTL
 * @param {string} key - Ключ
 * @param {string} value - Значение
 * @param {number} ttl - Время жизни в секундах (опционально)
 */
const set = async (key, value, ttl = null) => {
  try {
    if (ttl) {
      await client.setEx(key, ttl, value);
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (err) {
    console.error('Redis SET error:', err.message);
    throw err;
  }
};

/**
 * Установка значения с TTL (alias для set с TTL)
 * @param {string} key - Ключ
 * @param {number} seconds - TTL в секундах
 * @param {string} value - Значение
 */
const setex = async (key, seconds, value) => {
  try {
    await client.setEx(key, seconds, value);
    return true;
  } catch (err) {
    console.error('Redis SETEX error:', err.message);
    throw err;
  }
};

/**
 * Получение значения
 * @param {string} key - Ключ
 * @returns {string|null} Значение или null
 */
const get = async (key) => {
  try {
    const value = await client.get(key);
    return value;
  } catch (err) {
    console.error('Redis GET error:', err.message);
    throw err;
  }
};

/**
 * Удаление ключа
 * @param {string} key - Ключ
 * @returns {number} Количество удалённых ключей
 */
const del = async (key) => {
  try {
    const result = await client.del(key);
    return result;
  } catch (err) {
    console.error('Redis DEL error:', err.message);
    throw err;
  }
};

/**
 * Проверка существования ключа
 * @param {string} key - Ключ
 * @returns {boolean} true если ключ существует
 */
const exists = async (key) => {
  try {
    const result = await client.exists(key);
    return result === 1;
  } catch (err) {
    console.error('Redis EXISTS error:', err.message);
    throw err;
  }
};

/**
 * Инкремент значения
 * @param {string} key - Ключ
 * @returns {number} Новое значение
 */
const incr = async (key) => {
  try {
    const result = await client.incr(key);
    return result;
  } catch (err) {
    console.error('Redis INCR error:', err.message);
    throw err;
  }
};

/**
 * Декремент значения
 * @param {string} key - Ключ
 * @returns {number} Новое значение
 */
const decr = async (key) => {
  try {
    const result = await client.decr(key);
    return result;
  } catch (err) {
    console.error('Redis DECR error:', err.message);
    throw err;
  }
};

/**
 * Установка TTL для существующего ключа
 * @param {string} key - Ключ
 * @param {number} seconds - TTL в секундах
 * @returns {boolean} true если успешно
 */
const expire = async (key, seconds) => {
  try {
    const result = await client.expire(key, seconds);
    return result === 1;
  } catch (err) {
    console.error('Redis EXPIRE error:', err.message);
    throw err;
  }
};

/**
 * Получение TTL ключа
 * @param {string} key - Ключ
 * @returns {number} TTL в секундах (-1 если нет TTL, -2 если ключ не существует)
 */
const ttl = async (key) => {
  try {
    const result = await client.ttl(key);
    return result;
  } catch (err) {
    console.error('Redis TTL error:', err.message);
    throw err;
  }
};

/**
 * Получение всех ключей по паттерну
 * ВНИМАНИЕ: Используйте осторожно на продакшене!
 * @param {string} pattern - Паттерн (например: "user:*")
 * @returns {Array} Массив ключей
 */
const keys = async (pattern) => {
  try {
    const result = await client.keys(pattern);
    return result;
  } catch (err) {
    console.error('Redis KEYS error:', err.message);
    throw err;
  }
};

/**
 * Работа с Hash (объект)
 */
const hSet = async (key, field, value) => {
  try {
    await client.hSet(key, field, value);
    return true;
  } catch (err) {
    console.error('Redis HSET error:', err.message);
    throw err;
  }
};

const hGet = async (key, field) => {
  try {
    const value = await client.hGet(key, field);
    return value;
  } catch (err) {
    console.error('Redis HGET error:', err.message);
    throw err;
  }
};

const hGetAll = async (key) => {
  try {
    const value = await client.hGetAll(key);
    return value;
  } catch (err) {
    console.error('Redis HGETALL error:', err.message);
    throw err;
  }
};

const hDel = async (key, field) => {
  try {
    const result = await client.hDel(key, field);
    return result;
  } catch (err) {
    console.error('Redis HDEL error:', err.message);
    throw err;
  }
};

/**
 * Работа с List (очередь)
 */
const lPush = async (key, value) => {
  try {
    await client.lPush(key, value);
    return true;
  } catch (err) {
    console.error('Redis LPUSH error:', err.message);
    throw err;
  }
};

const rPush = async (key, value) => {
  try {
    await client.rPush(key, value);
    return true;
  } catch (err) {
    console.error('Redis RPUSH error:', err.message);
    throw err;
  }
};

const lPop = async (key) => {
  try {
    const value = await client.lPop(key);
    return value;
  } catch (err) {
    console.error('Redis LPOP error:', err.message);
    throw err;
  }
};

const rPop = async (key) => {
  try {
    const value = await client.rPop(key);
    return value;
  } catch (err) {
    console.error('Redis RPOP error:', err.message);
    throw err;
  }
};

const lRange = async (key, start, stop) => {
  try {
    const values = await client.lRange(key, start, stop);
    return values;
  } catch (err) {
    console.error('Redis LRANGE error:', err.message);
    throw err;
  }
};

/**
 * Работа с Set (множество)
 */
const sAdd = async (key, member) => {
  try {
    await client.sAdd(key, member);
    return true;
  } catch (err) {
    console.error('Redis SADD error:', err.message);
    throw err;
  }
};

const sRem = async (key, member) => {
  try {
    await client.sRem(key, member);
    return true;
  } catch (err) {
    console.error('Redis SREM error:', err.message);
    throw err;
  }
};

const sMembers = async (key) => {
  try {
    const members = await client.sMembers(key);
    return members;
  } catch (err) {
    console.error('Redis SMEMBERS error:', err.message);
    throw err;
  }
};

const sIsMember = async (key, member) => {
  try {
    const result = await client.sIsMember(key, member);
    return result;
  } catch (err) {
    console.error('Redis SISMEMBER error:', err.message);
    throw err;
  }
};

/**
 * Очистка всей базы данных (ОСТОРОЖНО!)
 */
const flushAll = async () => {
  try {
    await client.flushAll();
    console.warn('⚠️ Redis database flushed!');
    return true;
  } catch (err) {
    console.error('Redis FLUSHALL error:', err.message);
    throw err;
  }
};

/**
 * Закрытие подключения
 */
const close = async () => {
  try {
    await client.quit();
    console.log('Redis connection closed gracefully');
  } catch (err) {
    console.error('Error closing Redis connection:', err.message);
  }
};

// Экспорт методов
module.exports = {
  client,
  connect,
  testConnection,
  
  // Основные операции
  set,
  setex,
  get,
  del,
  exists,
  incr,
  decr,
  expire,
  ttl,
  keys,
  
  // Hash операции
  hSet,
  hGet,
  hGetAll,
  hDel,
  
  // List операции
  lPush,
  rPush,
  lPop,
  rPop,
  lRange,
  
  // Set операции
  sAdd,
  sRem,
  sMembers,
  sIsMember,
  
  // Утилиты
  flushAll,
  close
};
