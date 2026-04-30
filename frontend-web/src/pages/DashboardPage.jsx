/**
 * MCS - Dashboard Page
 * Главная страница после входа
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullChat from '../components/Chat/FullChat';
import AIAssistant from '../components/AI/AIAssistant';
import EmojiReactions from '../components/EmojiReactions';
import SettingsPage, { loadSettings, applyTheme } from '../components/SettingsPage';
import './Dashboard.css';

// ═══════════════════════════════════════════════════════
// УНИВЕРСАЛЬНАЯ СИСТЕМА МОДАЛЬНЫХ ОКОН
// ═══════════════════════════════════════════════════════

const Modal = ({ modal, onClose }) => {
  if (!modal) return null;

  const icons  = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', confirm: '❓' };
  const colors = { success: '#22c55e', error: '#ef4444', warning: '#f59e0b', info: '#3b82f6', confirm: '#FF6B35' };
  const icon  = icons[modal.type]  || 'ℹ️';
  const color = colors[modal.type] || '#FF6B35';

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 99999,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const boxStyle = {
    background: '#fff', borderRadius: '20px',
    padding: '2.5rem 2rem', maxWidth: '400px', width: '90%',
    textAlign: 'center',
    boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
  };
  const btnBase    = { padding: '0.65rem 1.75rem', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' };
  const btnOk      = { ...btnBase, background: color, color: '#fff', minWidth: '100px' };
  const btnConfirm = { ...btnBase, background: color, color: '#fff' };
  const btnCancel  = { ...btnBase, background: '#f3f4f6', color: '#555' };

  return (
    <div style={overlayStyle} onClick={modal.type === 'confirm' ? undefined : onClose}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem', color }}>{icon}</div>
        {modal.title && <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, color: '#1a1a2e' }}>{modal.title}</h3>}
        <p style={{ margin: '0 0 1.5rem', color: '#555', fontSize: '1rem', lineHeight: 1.5 }}>{modal.message}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          {modal.type === 'confirm' ? (
            <>
              <button style={btnCancel} onClick={() => { modal.onCancel?.(); onClose(); }}>Отмена</button>
              <button style={btnConfirm} onClick={() => { modal.onConfirm?.(); onClose(); }}>{modal.confirmText || 'Подтвердить'}</button>
            </>
          ) : (
            <button style={btnOk} onClick={onClose}>OK</button>
          )}
        </div>
      </div>
    </div>
  );
};

const useModal = () => {
  const [modal, setModal] = useState(null);
  const closeModal = useCallback(() => setModal(null), []);
  const showAlert = useCallback((message, type = 'info', title = '') => setModal({ message, type, title }), []);
  const showConfirm = useCallback((message, onConfirm, options = {}) => {
    setModal({ type: 'confirm', message, title: options.title || '', confirmText: options.confirmText || 'Подтвердить', onConfirm, onCancel: options.onCancel });
  }, []);
  return { modal, closeModal, showAlert, showConfirm };
};

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

const DashboardPage = () => {
  const [user, setUser] = useState(null);
  const [activeView, setActiveView] = useState(() => localStorage.getItem('activeView') || 'home');
  const [showSettings, setShowSettings] = useState(false);

  // Состояние единого чат-интерфейса
  const [chatTarget, setChatTarget] = useState(null); // { type: 'contact'|'channel', data: {...} }

  const navigate = useNavigate();
  const { modal, closeModal, showAlert, showConfirm } = useModal();

  useEffect(() => {
    const token    = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');
    if (!token || !userData) { navigate('/login'); return; }
    setUser(JSON.parse(userData));
    applyTheme(loadSettings());
  }, [navigate]);

  const handleLogout = () => {
    showConfirm(
      'Вы уверены что хотите выйти?',
      () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('activeView');
        showAlert('До встречи! 👋', 'success');
        setTimeout(() => navigate('/'), 1200);
      },
      { title: 'Выход из MCS', confirmText: 'Выйти' }
    );
  };

  const handleNavigation = (view) => {
    setActiveView(view);
    localStorage.setItem('activeView', view);
    if (view !== 'chat') setChatTarget(null);
  };

  // Открыть чат с контактом (из поиска или кнопки)
  const handleOpenChat = (targetUser) => {
    setChatTarget({ type: 'contact', data: targetUser });
    setActiveView('chat');
    localStorage.setItem('activeView', 'chat');
  };

  // Открыть канал
  const handleOpenChannel = (channel) => {
    setChatTarget({ type: 'channel', data: channel });
    setActiveView('chat');
    localStorage.setItem('activeView', 'chat');
  };

  if (!user) return <div className="loading">Загрузка...</div>;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="logo">
          <h1 style={{ userSelect: 'none', cursor: 'pointer' }} onClick={() => handleNavigation('home')}>MCS</h1>
        </div>
        <nav className="main-nav">
          <button className={activeView === 'home'    ? 'active' : ''} onClick={() => handleNavigation('home')}>🏠 Главная</button>
          <button className={activeView === 'chat'    ? 'active' : ''} onClick={() => handleNavigation('chat')}>💬 Чат</button>
          <button className={activeView === 'stories' ? 'active' : ''} onClick={() => handleNavigation('stories')}>📸 Истории</button>
        </nav>
        <div className="user-info">
          <span>Привет, {user.display_name || user.username}!</span>
          <button onClick={() => setShowSettings(true)} className="btn-settings" title="Настройки">⚙️</button>
          <button onClick={handleLogout} className="btn-logout">Выход</button>
        </div>
      </header>

      <div className="dashboard-content">
        {activeView === 'home' && (
          <HomeView user={user} onNavigate={handleNavigation} />
        )}
        {activeView === 'chat' && (
          <UnifiedChatView
            user={user}
            chatTarget={chatTarget}
            onOpenChat={handleOpenChat}
            onOpenChannel={handleOpenChannel}
            onClearTarget={() => setChatTarget(null)}
            showAlert={showAlert}
            showConfirm={showConfirm}
          />
        )}
        {activeView === 'stories' && (
          <StoriesView user={user} showAlert={showAlert} />
        )}
      </div>

      <AIAssistant />

      {showSettings && (
        <SettingsPage
          user={user}
          onClose={() => setShowSettings(false)}
          onUserUpdate={(updatedUser) => setUser(updatedUser)}
        />
      )}

      <Modal modal={modal} onClose={closeModal} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// UNIFIED CHAT VIEW — сайдбар + область контента
// ═══════════════════════════════════════════════════════

const UnifiedChatView = ({ user, chatTarget, onOpenChat, onOpenChannel, onClearTarget, showAlert, showConfirm }) => {
  const [sidebarTab, setSidebarTab] = useState('chats'); // 'chats' | 'channels' | 'contacts'
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [channels, setChannels] = useState([]);
  const searchRef = useRef(null);

  // Закрыть дропдаун при клике вне
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Поиск пользователей с дебаунсом
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    const timer = setTimeout(() => runSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const runSearch = async (q) => {
    setSearchLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.data?.users || data.users || []);
        setShowDropdown(true);
      }
    } catch {}
    setSearchLoading(false);
  };

  // Загрузка данных по активной вкладке
  useEffect(() => {
    if (sidebarTab === 'chats') loadContacts();
    if (sidebarTab === 'channels') loadChannels();
    if (sidebarTab === 'contacts') loadContacts();
  }, [sidebarTab]);

  const loadContacts = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/users/contacts', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.data?.contacts || []);
      }
    } catch {}
  };

  const loadChannels = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/channels/my', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setChannels(data.data?.channels || []);
      }
    } catch {}
  };

  const getInitials = (displayName, username) => (displayName || username || '?').slice(0, 2).toUpperCase();
  const getAvatarColor = (id) => {
    const colors = ['#FF6B35','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8'];
    return colors[id ? String(id).charCodeAt(0) % colors.length : 0];
  };

  // Определяем что показывать в правой части
  const showContactChat = chatTarget?.type === 'contact';
  const showChannelView = chatTarget?.type === 'channel';

  return (
    <div className="unified-chat-view">
      {/* ── ЛЕВЫЙ САЙДБАР ── */}
      <div className="unified-sidebar">

        {/* Поиск */}
        <div className="unified-search-wrap" ref={searchRef}>
          <div className="unified-search-row">
            <span className="search-icon-label">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Поиск пользователей..."
              className="unified-search-input"
            />
            {searchLoading && <span className="search-spinner">⏳</span>}
            {search && (
              <button className="search-clear" onClick={() => { setSearch(''); setShowDropdown(false); }}>✕</button>
            )}
          </div>

          {showDropdown && (
            <div className="search-dropdown">
              {searchResults.length === 0 ? (
                <div className="search-no-results"><span>😕</span><p>Не найдено</p></div>
              ) : (
                <>
                  <div className="search-dropdown-header">Найдено: {searchResults.length}</div>
                  {searchResults.map(u => (
                    <div key={u.id} className="search-result-item">
                      <div
                        className="search-result-avatar"
                        style={{ background: getAvatarColor(u.id), cursor: 'pointer' }}
                        onClick={() => { setShowDropdown(false); onOpenChat(u); }}
                      >
                        {getInitials(u.display_name, u.username)}
                      </div>
                      <div
                        className="search-result-info"
                        style={{ cursor: 'pointer' }}
                        onClick={() => { setShowDropdown(false); onOpenChat(u); }}
                      >
                        <span className="search-result-name">{u.display_name || u.username}</span>
                        <span className="search-result-username">@{u.username} {u.is_online ? '🟢' : ''}</span>
                      </div>
                      <button
                        className="btn-message-contact"
                        onClick={() => { setShowDropdown(false); onOpenChat(u); }}
                        title="Написать"
                      >💬</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Вкладки */}
        <div className="unified-tabs">
          <button
            className={sidebarTab === 'chats' ? 'active' : ''}
            onClick={() => setSidebarTab('chats')}
            title="Чаты"
          >💬</button>
          <button
            className={sidebarTab === 'channels' ? 'active' : ''}
            onClick={() => setSidebarTab('channels')}
            title="Каналы"
          >📡</button>
          <button
            className={sidebarTab === 'contacts' ? 'active' : ''}
            onClick={() => setSidebarTab('contacts')}
            title="Контакты"
          >👥</button>
        </div>

        {/* Список */}
        <div className="unified-list">
          {sidebarTab === 'chats' && (
            contacts.length === 0 ? (
              <div className="unified-empty">
                <p>Нет чатов</p>
                <small>Найдите пользователей выше</small>
              </div>
            ) : (
              contacts.map(c => {
                const id = c.user_id || c.id;
                const isActive = chatTarget?.type === 'contact' && chatTarget.data.id === id;
                return (
                  <div
                    key={id}
                    className={`unified-list-item ${isActive ? 'active' : ''}`}
                    onClick={() => onOpenChat({ id, username: c.username, display_name: c.display_name, avatar: c.avatar, public_key: c.public_key || null })}
                  >
                    <div className="unified-item-avatar" style={{ background: getAvatarColor(id) }}>
                      {getInitials(c.display_name, c.username)}
                    </div>
                    <div className="unified-item-info">
                      <span className="unified-item-name">{c.display_name || c.username}</span>
                      <span className="unified-item-sub">{c.is_online ? '🟢 онлайн' : '⚫ офлайн'}</span>
                    </div>
                  </div>
                );
              })
            )
          )}

          {sidebarTab === 'channels' && (
            channels.length === 0 ? (
              <div className="unified-empty">
                <p>Нет каналов</p>
                <small>Создайте или найдите канал</small>
              </div>
            ) : (
              channels.map(ch => {
                const isActive = chatTarget?.type === 'channel' && chatTarget.data.id === ch.id;
                return (
                  <div
                    key={ch.id}
                    className={`unified-list-item ${isActive ? 'active' : ''}`}
                    onClick={() => onOpenChannel(ch)}
                  >
                    <div className="unified-item-avatar" style={{ background: getAvatarColor(ch.id) }}>
                      {ch.name?.[0]?.toUpperCase() || 'C'}
                    </div>
                    <div className="unified-item-info">
                      <span className="unified-item-name">{ch.name}</span>
                      <span className="unified-item-sub">👥 {ch.subscribers_count || 0}</span>
                    </div>
                  </div>
                );
              })
            )
          )}

          {sidebarTab === 'contacts' && (
            contacts.length === 0 ? (
              <div className="unified-empty">
                <p>Нет контактов</p>
                <small>Найдите пользователей выше</small>
              </div>
            ) : (
              contacts.map(c => {
                const id = c.user_id || c.id;
                return (
                  <div key={id} className="unified-list-item">
                    <div className="unified-item-avatar" style={{ background: getAvatarColor(id) }}>
                      {getInitials(c.display_name, c.username)}
                    </div>
                    <div className="unified-item-info">
                      <span className="unified-item-name">{c.display_name || c.username}</span>
                      <span className="unified-item-sub">@{c.username}</span>
                    </div>
                    <button
                      className="btn-message-contact"
                      onClick={() => onOpenChat({ id, username: c.username, display_name: c.display_name, public_key: c.public_key || null })}
                      title="Написать"
                    >💬</button>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Кнопка создать канал (только на вкладке каналов) */}
        {sidebarTab === 'channels' && (
          <div className="unified-sidebar-footer">
            <button className="btn-primary btn-full" onClick={() => onOpenChannel({ __create: true })}>
              + Создать канал
            </button>
          </div>
        )}
      </div>

      {/* ── ПРАВАЯ ОБЛАСТЬ ── */}
      <div className="unified-main">
        {showContactChat && (
          <FullChat
            currentUser={user}
            openChatWith={chatTarget.data}
            onChatOpened={onClearTarget}
          />
        )}

        {showChannelView && !chatTarget.data.__create && (
          <ChannelDetailView
            channel={chatTarget.data}
            user={user}
            onBack={onClearTarget}
            showAlert={showAlert}
            showConfirm={showConfirm}
          />
        )}

        {showChannelView && chatTarget.data.__create && (
          <CreateChannelView
            onBack={onClearTarget}
            onCreated={(ch) => { onOpenChannel(ch); loadChannels && loadChannels(); }}
            showAlert={showAlert}
          />
        )}

        {!chatTarget && (
          <div className="unified-placeholder">
            <div className="placeholder-icon">💬</div>
            <h3>Выберите чат или канал</h3>
            <p>Найдите пользователя через поиск или выберите из списка слева</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// CHANNEL DETAIL VIEW
// ═══════════════════════════════════════════════════════

const ChannelDetailView = ({ channel, user, onBack, showAlert, showConfirm }) => {
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [showPostForm, setShowPostForm] = useState(false);

  useEffect(() => { loadPosts(); }, [channel.id]);

  const loadPosts = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/channels/${channel.id}/posts`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.data?.posts || []);
      }
    } catch {}
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/channels/${channel.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: newPostContent })
      });
      if (res.ok) {
        const data = await res.json();
        showAlert('Пост опубликован!', 'success', 'Готово');
        setPosts([data.data.post, ...posts]);
        setNewPostContent('');
        setShowPostForm(false);
      } else {
        showAlert('Не удалось опубликовать пост.', 'error', 'Ошибка');
      }
    } catch {
      showAlert('Ошибка соединения.', 'error', 'Ошибка');
    }
  };

  return (
    <div className="channel-detail-view">
      <div className="channel-view-header">
        <button className="btn-back" onClick={onBack}>← Назад</button>
        <div className="channel-header-info">
          <h2>{channel.name}</h2>
          <p>{channel.description}</p>
          <span>👥 {channel.subscribers_count || 0} подписчиков</span>
        </div>
        {channel.role === 'admin' && (
          <button className="btn-primary" onClick={() => setShowPostForm(!showPostForm)}>
            {showPostForm ? 'Отмена' : '+ Новый пост'}
          </button>
        )}
      </div>

      {showPostForm && (
        <div className="create-post-form">
          <form onSubmit={handleCreatePost}>
            <textarea
              value={newPostContent}
              onChange={e => setNewPostContent(e.target.value)}
              placeholder="Содержимое поста..."
              rows="4"
              required
            />
            <button type="submit" className="btn-primary">Опубликовать</button>
          </form>
        </div>
      )}

      <div className="channel-posts-feed">
        {posts.length === 0 ? (
          <p className="empty-state">Нет постов в канале</p>
        ) : (
          posts.map(post => (
            <div key={post.id} className="channel-post-card">
              <div className="post-header">
                <div className="post-avatar">{post.display_name?.[0] || post.username?.[0] || 'U'}</div>
                <div>
                  <h4>{post.display_name || post.username}</h4>
                  <span className="post-time">{new Date(post.created_at).toLocaleString('ru-RU')}</span>
                </div>
              </div>
              <p className="post-content">{post.content}</p>
              <div className="post-stats"><span>👁 {post.views_count || 0} просмотров</span></div>
              <EmojiReactions
                postId={post.id}
                reactions={post.reactions || {}}
                userReaction={post.userReaction || null}
                token={localStorage.getItem('accessToken')}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// CREATE CHANNEL VIEW
// ═══════════════════════════════════════════════════════

const CreateChannelView = ({ onBack, onCreated, showAlert }) => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, description: desc, isPublic: true })
      });
      if (res.ok) {
        const data = await res.json();
        showAlert('Канал создан!', 'success', 'Готово');
        onCreated(data.data?.channel || { name });
      } else {
        showAlert('Не удалось создать канал.', 'error', 'Ошибка');
      }
    } catch {
      showAlert('Ошибка соединения.', 'error', 'Ошибка');
    }
  };

  return (
    <div className="create-channel-view">
      <div className="channel-view-header">
        <button className="btn-back" onClick={onBack}>← Назад</button>
        <h2>Создать канал</h2>
      </div>
      <div className="create-channel-form">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Название канала"
            maxLength="100"
            required
          />
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Описание (необязательно)"
            rows="3"
          />
          <button type="submit" className="btn-primary">Создать</button>
        </form>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// HOME VIEW
// ═══════════════════════════════════════════════════════

const HomeView = ({ user, onNavigate }) => (
  <div>
    <div className="welcome-card">
      <h2>🎉 Добро пожаловать в MCS!</h2>
      <p>Ваш безопасный мессенджер готов к работе</p>
    </div>
    <div className="features-grid">
      <div className="feature-card" onClick={() => onNavigate('chat')}>
        <h3>💬 Сообщения</h3>
        <p>Отправляйте зашифрованные сообщения</p>
        <button className="btn-secondary">Открыть чат</button>
      </div>
      <div className="feature-card" onClick={() => onNavigate('chat')}>
        <h3>👥 Контакты</h3>
        <p>Добавьте друзей и начните общение</p>
        <button className="btn-secondary">Контакты</button>
      </div>
      <div className="feature-card" onClick={() => onNavigate('chat')}>
        <h3>📡 Каналы</h3>
        <p>Создавайте каналы и публикуйте контент</p>
        <button className="btn-secondary">Мои каналы</button>
      </div>
      <div className="feature-card" onClick={() => onNavigate('stories')}>
        <h3>📸 Истории</h3>
        <p>Публикуйте истории на 24 часа</p>
        <button className="btn-secondary">Добавить историю</button>
      </div>
    </div>
    <div className="info-card">
      <h3>ℹ️ Информация об аккаунте</h3>
      <ul>
        <li><strong>Username:</strong> {user.username}</li>
        <li><strong>Email:</strong> {user.email}</li>
        <li><strong>ID:</strong> {user.id}</li>
      </ul>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════
// STORIES VIEW (без изменений)
// ═══════════════════════════════════════════════════════

const StoriesView = ({ user, showAlert }) => {
  const [stories, setStories] = useState([]);
  const [newStoryText, setNewStoryText] = useState('');
  const [selectedStory, setSelectedStory] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);

  useEffect(() => { loadStories(); }, []);

  const loadStories = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/stories', { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setStories(data.data?.stories || []);
      }
    } catch (err) { console.error('Load stories error:', err); }
  };

  const handleCreateStory = async (e) => {
    e.preventDefault();
    if (!newStoryText.trim()) return;
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mediaUrl: `data:text/plain;base64,${btoa(newStoryText)}`, mediaType: 'text', caption: newStoryText })
      });
      if (response.ok) {
        showAlert('История создана! Исчезнет через 24 часа.', 'success', 'Готово');
        setNewStoryText('');
        loadStories();
      } else {
        showAlert('Не удалось создать историю.', 'error', 'Ошибка');
      }
    } catch { showAlert('Ошибка соединения.', 'error', 'Ошибка'); }
  };

  const handleViewStory = async (userStories, index) => {
    setSelectedStory(userStories);
    setStoryIndex(index);
    try {
      const token = localStorage.getItem('accessToken');
      const story = userStories.items[index];
      await fetch(`/api/stories/${story.id}/view`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    } catch {}
  };

  const nextStory = () => {
    if (selectedStory && storyIndex < selectedStory.items.length - 1) {
      handleViewStory(selectedStory, storyIndex + 1);
    } else { setSelectedStory(null); setStoryIndex(0); }
  };

  const prevStory = () => {
    if (storyIndex > 0) handleViewStory(selectedStory, storyIndex - 1);
  };

  const groupedStories = stories.reduce((acc, story) => {
    const existing = acc.find(g => g.user_id === story.user_id);
    if (existing) { existing.items.push(story); }
    else { acc.push({ user_id: story.user_id, username: story.username, display_name: story.display_name, items: [story] }); }
    return acc;
  }, []);

  return (
    <div className="stories-view">
      <div className="create-story">
        <h2>📸 Создать историю</h2>
        <p className="story-info">История исчезнет через 24 часа</p>
        <form onSubmit={handleCreateStory}>
          <textarea value={newStoryText} onChange={e => setNewStoryText(e.target.value)} placeholder="Что нового?" rows="4" maxLength="300" />
          <button type="submit" className="btn-primary">Опубликовать</button>
        </form>
      </div>

      <div className="stories-list">
        <h2>Активные истории</h2>
        {groupedStories.length === 0 ? (
          <p className="empty-state">Нет активных историй</p>
        ) : (
          <div className="stories-grid">
            {groupedStories.map(userStories => (
              <div key={userStories.user_id} className="story-avatar-container" onClick={() => handleViewStory(userStories, 0)}>
                <div className="story-avatar">{userStories.display_name?.[0] || userStories.username?.[0] || 'U'}</div>
                <div className="story-username">{userStories.display_name || userStories.username}</div>
                <div className="story-count">{userStories.items.length}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedStory && (
        <div className="story-viewer" onClick={() => { setSelectedStory(null); setStoryIndex(0); }}>
          <div className="story-viewer-content" onClick={e => e.stopPropagation()}>
            <div className="story-header">
              <div className="story-author">
                <div className="story-avatar-small">{selectedStory.display_name?.[0] || selectedStory.username?.[0] || 'U'}</div>
                <span>{selectedStory.display_name || selectedStory.username}</span>
              </div>
              <button onClick={() => { setSelectedStory(null); setStoryIndex(0); }}>✕</button>
            </div>
            <div className="story-progress">
              {selectedStory.items.map((_, idx) => (
                <div key={idx} className={`progress-bar ${idx < storyIndex ? 'completed' : idx === storyIndex ? 'active' : ''}`} />
              ))}
            </div>
            <div className="story-content"><p>{selectedStory.items[storyIndex].caption}</p></div>
            <div className="story-navigation">
              <button onClick={prevStory} disabled={storyIndex === 0}>←</button>
              <button onClick={nextStory}>{storyIndex < selectedStory.items.length - 1 ? '→' : 'Закрыть'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
