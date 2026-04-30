/**
 * MCS - Two-Factor Authentication Service
 */

const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const db = require('../config/database');

/**
 * Генерирует новый TOTP-секрет и сохраняет его в БД (ещё не активен).
 * Возвращает QR-код и секрет для отображения пользователю.
 */
const generateSetup = async (userId, username) => {
  const secret = speakeasy.generateSecret({
    name: `MCS:${username}`,
    issuer: 'MCS Messenger',
    length: 20,
  });

  // Сохраняем секрет с префиксом PENDING — ещё не подтверждён
  await db.query(
    'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
    [`PENDING:${secret.base32}`, userId]
  );

  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    qrDataUrl,
    otpauth_url: secret.otpauth_url,
  };
};

/**
 * Подтверждает настройку 2FA: проверяет код и активирует секрет.
 */
const enableTwoFactor = async (userId, token) => {
  const result = await db.query(
    'SELECT two_factor_secret FROM users WHERE id = $1',
    [userId]
  );

  const row = result.rows[0];
  if (!row?.two_factor_secret) throw new Error('Секрет не найден. Начните настройку заново.');

  const secretValue = row.two_factor_secret.startsWith('PENDING:')
    ? row.two_factor_secret.slice('PENDING:'.length)
    : row.two_factor_secret;

  const isValid = speakeasy.totp.verify({
    secret: secretValue,
    encoding: 'base32',
    token,
    window: 2,
  });

  if (!isValid) throw new Error('Неверный код. Проверьте приложение и попробуйте снова.');

  // Активируем — убираем префикс PENDING
  await db.query(
    'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
    [secretValue, userId]
  );

  return true;
};

/**
 * Отключает 2FA для пользователя.
 */
const disableTwoFactor = async (userId) => {
  await db.query(
    'UPDATE users SET two_factor_secret = NULL WHERE id = $1',
    [userId]
  );
};

/**
 * Проверяет TOTP-код (используется при логине).
 */
const verifyToken = (secret, token) => {
  const secretValue = secret.startsWith('PENDING:') ? secret.slice('PENDING:'.length) : secret;
  return speakeasy.totp.verify({
    secret: secretValue,
    encoding: 'base32',
    token,
    window: 2,
  });
};

/**
 * Возвращает статус 2FA пользователя.
 */
const getStatus = async (userId) => {
  const result = await db.query(
    'SELECT two_factor_secret FROM users WHERE id = $1',
    [userId]
  );
  const secret = result.rows[0]?.two_factor_secret;
  return {
    enabled: !!secret && !secret.startsWith('PENDING:'),
    pending: !!secret && secret.startsWith('PENDING:'),
  };
};

module.exports = { generateSetup, enableTwoFactor, disableTwoFactor, verifyToken, getStatus };
