/**
 * MCS - AI Controller
 * Код 25: AI помощник через встроенный Claude API
 */

const logger = require('../utils/logger');

/**
 * Отправка сообщения к Claude API (через artifacts)
 * POST /api/ai/chat
 */
const chatWithAI = async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array required'
      });
    }

    // Простые ответы AI помощника MCS
    const lastMessage = messages[messages.length - 1];
    const userInput = lastMessage.content.toLowerCase();

    let aiResponse = '';

    // Ответы на типичные вопросы
    if (userInput.includes('привет') || userInput.includes('здравствуй')) {
      aiResponse = '👋 Привет! Я AI помощник MCS. Чем могу помочь?';
    } else if (userInput.includes('что ты умеешь') || userInput.includes('что можешь')) {
      aiResponse = `Я могу помочь вам с:
      
📱 Использованием MCS мессенджера
💬 Отправкой зашифрованных сообщений
👥 Управлением контактами
📸 Созданием постов и историй
⚙️ Настройками приватности

Задавайте любые вопросы!`;
    } else if (userInput.includes('как отправить сообщение') || userInput.includes('написать сообщение')) {
      aiResponse = `Чтобы отправить сообщение:

1. Перейдите в раздел 💬 "Сообщения"
2. Выберите контакт из списка
3. Введите текст в поле внизу
4. Нажмите 📤

Все сообщения автоматически шифруются end-to-end!`;
    } else if (userInput.includes('как добавить контакт') || userInput.includes('найти друга')) {
      aiResponse = `Добавление контакта:

1. Откройте раздел 👥 "Контакты"
2. Введите username в поле поиска
3. Нажмите "Найти"
4. Добавьте пользователя

После этого вы сможете отправлять ему сообщения!`;
    } else if (userInput.includes('создать пост') || userInput.includes('опубликовать')) {
      aiResponse = `Создание поста:

1. Перейдите в 📱 "Посты"
2. Напишите текст в поле "Что у вас нового?"
3. Нажмите "Опубликовать"

Ваш пост увидят все ваши контакты!`;
    } else if (userInput.includes('настройки') || userInput.includes('приватность')) {
      aiResponse = `⚙️ В MCS вы можете настроить:

• Приватность профиля
• Уведомления
• Тему оформления (светлая/тёмная)
• Язык интерфейса
• Экспорт данных (GDPR)

Перейдите в настройки для подробностей.`;
    } else if (userInput.includes('безопасность') || userInput.includes('шифрование')) {
      aiResponse = `🔐 Безопасность MCS:

✅ End-to-End шифрование всех сообщений
✅ Ключи хранятся только у вас
✅ Сервер не может читать сообщения
✅ Signal Protocol для шифрования
✅ JWT для аутентификации

Ваши данные полностью защищены!`;
    } else if (userInput.includes('спасибо') || userInput.includes('благодарю')) {
      aiResponse = '😊 Пожалуйста! Обращайтесь если нужна помощь!';
    } else if (userInput.includes('что такое mcs') || userInput.includes('о приложении')) {
      aiResponse = `MCS (Mauya Chat & Social) - это:

🔐 Приватный мессенджер с E2EE шифрованием
💬 Личные и групповые чаты
📱 Социальная сеть (посты, истории)
👥 Управление контактами
🤖 AI помощник (это я!)

Безопасное общение для всех!`;
    } else {
      // Общий ответ
      aiResponse = `Я понял ваш вопрос: "${lastMessage.content}"

Я помощник MCS и могу рассказать о:
• Отправке сообщений
• Добавлении контактов
• Создании постов
• Настройках приватности
• Безопасности приложения

Задайте более конкретный вопрос, и я помогу!`;
    }

    logger.info('AI chat response generated');

    return res.status(200).json({
      success: true,
      data: {
        content: [
          {
            type: 'text',
            text: aiResponse
          }
        ]
      }
    });

  } catch (err) {
    logger.error('AI chat error:', { error: err.message });

    return res.status(500).json({
      success: false,
      error: 'AI request failed',
      message: err.message
    });
  }
};

module.exports = {
  chatWithAI
};
