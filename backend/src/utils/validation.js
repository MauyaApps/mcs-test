/**
 * MCS (Mauya Chat&Social) - Validation Utility
 * Схемы валидации для входных данных
 */

const Joi = require('joi');

/**
 * Схема валидации регистрации
 */
const validateRegistration = (data) => {
  const schema = Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(50)
      .required()
      .messages({
        'string.alphanum': 'Username может содержать только буквы и цифры',
        'string.min': 'Username должен быть не менее 3 символов',
        'string.max': 'Username не может быть длиннее 50 символов',
        'any.required': 'Username обязателен'
      }),
    
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Неверный формат email',
        'any.required': 'Email обязателен'
      }),
    
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .required()
      .messages({
        'string.min': 'Пароль должен быть не менее 8 символов',
        'string.pattern.base': 'Пароль должен содержать заглавные и строчные буквы, и цифры',
        'any.required': 'Пароль обязателен'
      }),
    
    publicKey: Joi.string()
      .required()
      .messages({
        'any.required': 'Публичный ключ обязателен для E2EE'
      }),
    
    displayName: Joi.string()
      .min(1)
      .max(100)
      .optional()
  });

  return schema.validate(data);
};

/**
 * Схема валидации входа
 */
const validateLogin = (data) => {
  const schema = Joi.object({
    username: Joi.string().optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().required(),
    twoFactorCode: Joi.string().length(6).optional(),
    rememberDevice: Joi.boolean().optional()
  }).or('username', 'email'); // Хотя бы один из них

  return schema.validate(data);
};

/**
 * Схема валидации создания сообщения
 */
const validateMessage = (data) => {
  const schema = Joi.object({
    receiverId: Joi.string().uuid().optional(),
    groupId: Joi.string().uuid().optional(),
    encryptedContent: Joi.string().required(),
    messageType: Joi.string()
      .valid('text', 'image', 'video', 'file', 'voice', 'location', 'contact')
      .default('text'),
    mediaUrl: Joi.string().uri().optional().allow(null),
    replyToMessageId: Joi.string().uuid().optional().allow(null)
  }).xor('receiverId', 'groupId'); // Только один из них

  return schema.validate(data);
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateMessage
};
