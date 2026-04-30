FROM node:18-alpine

# Установка дополнительных зависимостей
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client

# Рабочая директория
WORKDIR /app

# Копирование package.json и package-lock.json
COPY package*.json ./

# Установка зависимостей
RUN npm install && npm cache clean --force

# Копирование исходного кода
COPY . .

# Создание директории для логов
RUN mkdir -p logs

# Открытие порта
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Запуск приложения
CMD ["npm", "start"]
