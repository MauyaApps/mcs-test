-- ============================================
-- MCS Migration 001: Chat Folders
-- ============================================

-- Таблица папок чатов
CREATE TABLE IF NOT EXISTS folders (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    icon        VARCHAR(10) DEFAULT '📁',
    order_index INTEGER DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT folders_name_not_empty CHECK (char_length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_order   ON folders(user_id, order_index);

-- Таблица чатов в папках
CREATE TABLE IF NOT EXISTS folder_chats (
    folder_id  UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    chat_id    UUID NOT NULL,
    chat_type  VARCHAR(20) NOT NULL DEFAULT 'contact',
    added_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (folder_id, chat_id),
    CONSTRAINT valid_chat_type CHECK (chat_type IN ('contact', 'group', 'channel'))
);

CREATE INDEX IF NOT EXISTS idx_folder_chats_folder ON folder_chats(folder_id);
