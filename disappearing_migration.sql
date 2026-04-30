-- Миграция: исчезающие сообщения
ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS disappearing_timer INTEGER DEFAULT NULL; -- секунды

-- Таблица настроек исчезающих сообщений для каждого чата
CREATE TABLE IF NOT EXISTS disappearing_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timer_seconds INTEGER NOT NULL DEFAULT 0, -- 0 = выключено
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON messages(expires_at) WHERE expires_at IS NOT NULL;
