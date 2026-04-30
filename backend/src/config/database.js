/**
 * MCS (Mauya Chat&Social) - Database Configuration
 * PostgreSQL подключение и настройки
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');

// Конфигурация подключения к PostgreSQL
const poolConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'mcs_db',
  user: process.env.DATABASE_USER || 'mcs_user',
  password: process.env.DATABASE_PASSWORD || 'mcs_secure_password_2024',
  
  // Connection pool настройки
  max: 20,                    // Максимум соединений в пуле
  min: 2,                     // Минимум соединений
  idleTimeoutMillis: 30000,   // Закрытие неактивных соединений через 30 сек
  connectionTimeoutMillis: 10000, // Таймаут подключения 10 сек
  
  // SSL (для продакшена)
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
};

// Создание пула подключений
const pool = new Pool(poolConfig);

// Обработка событий пула
pool.on('connect', (client) => {
  console.log('New PostgreSQL client connected');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

/**
 * Выполнение SQL запроса
 * @param {string} text - SQL запрос
 * @param {Array} params - Параметры запроса
 * @returns {Object} Результат запроса
 */
const query = async (text, params) => {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Логирование медленных запросов (более 1 секунды)
    if (duration > 1000) {
      console.warn(`Slow query detected: ${duration}ms`);
    }
    
    return result;
    
  } catch (err) {
    console.error('Database query error:', err.message);
    throw err;
  }
};

/**
 * Получение клиента из пула для транзакций
 * @returns {Object} PostgreSQL клиент
 */
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Проверка подключения к базе данных
 * @returns {boolean} true если подключение успешно
 */
const testConnection = async () => {
  try {
    const result = await query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connected:', result.rows[0].current_time);
    return true;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    return false;
  }
};

/**
 * Выполнение транзакции
 * @param {Function} callback - Функция с операциями БД
 * @returns {*} Результат callback функции
 */
const transaction = async (callback) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Закрытие пула подключений
 */
const close = async () => {
  try {
    await pool.end();
    console.log('Database pool closed');
  } catch (err) {
    console.error('Error closing database pool:', err.message);
  }
};

// Экспорт методов
module.exports = {
  query,
  getClient,
  testConnection,
  transaction,
  close,
  pool
};
