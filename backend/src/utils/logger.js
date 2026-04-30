/**
 * MCS (Mauya Chat&Social) - Logger Utility
 * Простая система логирования
 */

const fs = require('fs');
const path = require('path');

// Уровни логирования
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Текущий уровень логирования из ENV
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'];

// Директория для логов
const logDir = path.join(__dirname, '../../logs');

// Создание директории если не существует
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Пути к файлам логов
const errorLogPath = path.join(logDir, 'error.log');
const combinedLogPath = path.join(logDir, 'combined.log');

/**
 * Форматирование даты и времени
 */
const getTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Форматирование сообщения лога
 */
const formatMessage = (level, message, meta = {}) => {
  const timestamp = getTimestamp();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
};

/**
 * Запись в файл
 */
const writeToFile = (filePath, message) => {
  try {
    fs.appendFileSync(filePath, message);
  } catch (err) {
    console.error('Failed to write to log file:', err.message);
  }
};

/**
 * Цвета для консоли
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

/**
 * Логирование с цветом в консоли
 */
const logToConsole = (level, message, meta = {}) => {
  const timestamp = getTimestamp();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  
  let color = colors.reset;
  switch(level) {
    case 'error':
      color = colors.red;
      break;
    case 'warn':
      color = colors.yellow;
      break;
    case 'info':
      color = colors.blue;
      break;
    case 'debug':
      color = colors.gray;
      break;
  }
  
  console.log(`${color}[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}${colors.reset}`);
};

/**
 * Основная функция логирования
 */
const log = (level, message, meta = {}) => {
  // Проверка уровня
  if (LOG_LEVELS[level] > currentLevel) {
    return;
  }
  
  const formattedMessage = formatMessage(level, message, meta);
  
  // Вывод в консоль
  logToConsole(level, message, meta);
  
  // Запись в файлы
  writeToFile(combinedLogPath, formattedMessage);
  
  // Ошибки также в error.log
  if (level === 'error') {
    writeToFile(errorLogPath, formattedMessage);
  }
};

/**
 * Публичные методы логирования
 */
const logger = {
  error: (message, meta = {}) => log('error', message, meta),
  warn: (message, meta = {}) => log('warn', message, meta),
  info: (message, meta = {}) => log('info', message, meta),
  debug: (message, meta = {}) => log('debug', message, meta)
};

module.exports = logger;
