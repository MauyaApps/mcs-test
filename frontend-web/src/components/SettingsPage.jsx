import React, { useState, useEffect, useRef, useCallback } from 'react';
import TwoFactorSetup from './TwoFactorSetup';
import './SettingsPage.css';

// ═══════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════

const DEFAULT_SETTINGS = {
  // Дизайн
  theme: 'dark',
  accentColor: '#FF6B35',
  fontSize: 'medium',
  chatBg: 'none',
  chatBgCustom: null,
  // Конфиденциальность
  privacyOnlineStatus: 'everyone',   // everyone | contacts | nobody
  privacyPhoto: 'everyone',
  privacyReadReceipts: true,
  privacyCanMessage: 'everyone',
  // Папки
  chatFolders: [
    { id: 'all', name: 'Все чаты', icon: '💬', system: true },
    { id: 'unread', name: 'Непрочитанные', icon: '🔴', system: true },
  ],
};

const ACCENT_COLORS = [
  '#FF6B35', '#F7931E', '#E74C3C', '#9B59B6',
  '#3498DB', '#2ECC71', '#1ABC9C', '#F39C12',
  '#E91E63', '#00BCD4',
];

const CHAT_BG_PATTERNS = [
  { id: 'none', label: 'Нет', preview: null },
  { id: 'dots', label: 'Точки', preview: 'radial-gradient(circle, #ffffff15 1px, transparent 1px)' },
  { id: 'grid', label: 'Сетка', preview: 'linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px)' },
  { id: 'waves', label: 'Волны', preview: 'repeating-linear-gradient(45deg, #ffffff08 0, #ffffff08 1px, transparent 0, transparent 50%)' },
  { id: 'bubbles', label: 'Пузыри', preview: 'radial-gradient(circle at 20% 50%, #ffffff06 10%, transparent 10%), radial-gradient(circle at 80% 20%, #ffffff06 15%, transparent 15%)' },
];

const applyTheme = (settings) => {
  const root = document.documentElement;
  const isDark = settings.theme === 'dark';

  root.style.setProperty('--accent', settings.accentColor);
  root.style.setProperty('--accent-light', settings.accentColor + '33');
  root.style.setProperty('--bg-primary', isDark ? '#0f0f23' : '#f0f2f5');
  root.style.setProperty('--bg-secondary', isDark ? '#1a1a2e' : '#ffffff');
  root.style.setProperty('--bg-tertiary', isDark ? '#2a2a4a' : '#e8eaf0');
  root.style.setProperty('--text-primary', isDark ? '#ffffff' : '#1a1a2e');
  root.style.setProperty('--text-secondary', isDark ? '#aaaaaa' : '#666666');
  root.style.setProperty('--border', isDark ? '#2a2a4a' : '#dde1e8');

  const fontSizes = { small: '13px', medium: '15px', large: '17px' };
  root.style.setProperty('--font-size', fontSizes[settings.fontSize] || '15px');

  document.body.setAttribute('data-theme', settings.theme);
};

const saveSettings = (settings) => {
  localStorage.setItem('mcs_settings', JSON.stringify(settings));
  applyTheme(settings);
};

const loadSettings = () => {
  try {
    const saved = localStorage.getItem('mcs_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

// ═══════════════════════════════════════════════════════
// ГЛАВНЫЙ КОМПОНЕНТ
// ═══════════════════════════════════════════════════════

const SettingsPage = ({ user, onClose, onUserUpdate }) => {
  const [section, setSection] = useState('profile');
  const [settings, setSettings] = useState(loadSettings);
  const [profile, setProfile] = useState({
    display_name: user?.display_name || user?.username || '',
    bio: user?.bio || '',
    status: user?.status || '',
    avatar: user?.avatar || null,
  });
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newFolder, setNewFolder] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📁');
  const fileInputRef = useRef();

  // Применяем тему при изменении настроек
  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  const updateSettings = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('accessToken');

      // Сначала обновляем текстовые поля
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: profile.display_name,
          bio: profile.bio,
        }),
      });
      const data = await res.json();

      // Если есть новый аватар — загружаем отдельно
      if (fileInputRef.current?.files[0]) {
        const formData = new FormData();
        formData.append('avatar', fileInputRef.current.files[0]);
        await fetch('/api/users/avatar', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }

      // Сохраняем локально в любом случае
      const updatedUser = {
        ...user,
        display_name: profile.display_name,
        bio: profile.bio,
        status: profile.status,
        avatar: avatarPreview,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      onUserUpdate?.(updatedUser);
      showSaved();
    } catch {
      // Сохраняем локально если API недоступен
      const updatedUser = { ...user, display_name: profile.display_name, bio: profile.bio, status: profile.status, avatar: avatarPreview };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      onUserUpdate?.(updatedUser);
      showSaved();
    }
    setSaving(false);
  };

  const handleSavePrivacy = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/users/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          online_status_visibility: settings.privacyOnlineStatus,
          photo_visibility: settings.privacyPhoto,
          read_receipts: settings.privacyReadReceipts,
          can_message: settings.privacyCanMessage,
        }),
      });
    } catch {}
    saveSettings(settings);
    showSaved();
    setSaving(false);
  };

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addFolder = () => {
    if (!newFolder.trim()) return;
    const folder = {
      id: Date.now().toString(),
      name: newFolder.trim(),
      icon: newFolderIcon,
      system: false,
    };
    updateSettings('chatFolders', [...settings.chatFolders, folder]);
    setNewFolder('');
  };

  const removeFolder = (id) => {
    updateSettings('chatFolders', settings.chatFolders.filter(f => f.id !== id));
  };

  const SECTIONS = [
    { id: 'profile', icon: '👤', label: 'Профиль' },
    { id: 'privacy', icon: '🔒', label: 'Конфиденциальность' },
    { id: 'security', icon: '🛡️', label: 'Безопасность' },
    { id: 'design', icon: '🎨', label: 'Дизайн' },
    { id: 'folders', icon: '📁', label: 'Папки чатов' },
  ];

  return (
    <div className="settings-overlay">
      <div className="settings-modal">

        {/* Шапка */}
        <div className="settings-header">
          <h2>⚙️ Настройки</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-body">
          {/* Боковое меню */}
          <nav className="settings-nav">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`settings-nav-item ${section === s.id ? 'active' : ''}`}
                onClick={() => setSection(s.id)}
              >
                <span className="settings-nav-icon">{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </nav>

          {/* Контент */}
          <div className="settings-content">

            {/* ─────────────────────────────────────────── ПРОФИЛЬ */}
            {section === 'profile' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Кастомизация профиля</h3>

                {/* Аватар */}
                <div className="avatar-editor">
                  <div
                    className="avatar-preview"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ backgroundImage: avatarPreview ? `url(${avatarPreview})` : 'none' }}
                  >
                    {!avatarPreview && <span className="avatar-placeholder">
                      {profile.display_name?.[0]?.toUpperCase() || '?'}
                    </span>}
                    <div className="avatar-overlay">📷 Изменить</div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarChange}
                  />
                  <div className="avatar-info">
                    <p>Нажмите на аватар чтобы изменить</p>
                    <p className="text-muted">JPG, PNG до 5 МБ</p>
                    {avatarPreview && (
                      <button className="btn-text-danger" onClick={() => {
                        setAvatarPreview(null);
                        setProfile(p => ({ ...p, avatar: null }));
                      }}>Удалить фото</button>
                    )}
                  </div>
                </div>

                {/* Поля */}
                <div className="settings-field">
                  <label>Отображаемое имя</label>
                  <input
                    type="text"
                    value={profile.display_name}
                    onChange={e => setProfile(p => ({ ...p, display_name: e.target.value }))}
                    placeholder="Ваше имя"
                    maxLength={50}
                  />
                  <span className="field-hint">{profile.display_name.length}/50</span>
                </div>

                <div className="settings-field">
                  <label>Статус</label>
                  <input
                    type="text"
                    value={profile.status}
                    onChange={e => setProfile(p => ({ ...p, status: e.target.value }))}
                    placeholder="На связи 🟢"
                    maxLength={80}
                  />
                  <span className="field-hint">Виден всем контактам</span>
                </div>

                <div className="settings-field">
                  <label>О себе (Bio)</label>
                  <textarea
                    value={profile.bio}
                    onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                    placeholder="Расскажите о себе..."
                    maxLength={300}
                    rows={4}
                  />
                  <span className="field-hint">{profile.bio.length}/300</span>
                </div>

                <div className="settings-field readonly">
                  <label>Имя пользователя</label>
                  <input type="text" value={`@${user?.username || ''}`} readOnly />
                  <span className="field-hint">Нельзя изменить</span>
                </div>

                <div className="settings-field readonly">
                  <label>Email</label>
                  <input type="text" value={user?.email || ''} readOnly />
                </div>

                <button
                  className="settings-save-btn"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? '⏳ Сохранение...' : saved ? '✅ Сохранено!' : '💾 Сохранить профиль'}
                </button>
              </div>
            )}

            {/* ─────────────────────────────────────────── КОНФИДЕНЦИАЛЬНОСТЬ */}
            {section === 'privacy' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Конфиденциальность</h3>

                <div className="privacy-group">
                  <div className="privacy-group-title">👁️ Статус онлайн</div>
                  <p className="privacy-desc">Кто видит когда вы в сети</p>
                  <div className="radio-group">
                    {[
                      { value: 'everyone', label: 'Все' },
                      { value: 'contacts', label: 'Только контакты' },
                      { value: 'nobody', label: 'Никто' },
                    ].map(opt => (
                      <label key={opt.value} className="radio-option">
                        <input
                          type="radio"
                          name="onlineStatus"
                          value={opt.value}
                          checked={settings.privacyOnlineStatus === opt.value}
                          onChange={() => updateSettings('privacyOnlineStatus', opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="privacy-group">
                  <div className="privacy-group-title">🖼️ Фото профиля</div>
                  <p className="privacy-desc">Кто видит вашу аватарку</p>
                  <div className="radio-group">
                    {[
                      { value: 'everyone', label: 'Все' },
                      { value: 'contacts', label: 'Только контакты' },
                      { value: 'nobody', label: 'Никто' },
                    ].map(opt => (
                      <label key={opt.value} className="radio-option">
                        <input
                          type="radio"
                          name="photo"
                          value={opt.value}
                          checked={settings.privacyPhoto === opt.value}
                          onChange={() => updateSettings('privacyPhoto', opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="privacy-group">
                  <div className="privacy-group-title">💬 Кто может писать мне</div>
                  <p className="privacy-desc">Ограничьте входящие сообщения</p>
                  <div className="radio-group">
                    {[
                      { value: 'everyone', label: 'Все' },
                      { value: 'contacts', label: 'Только контакты' },
                    ].map(opt => (
                      <label key={opt.value} className="radio-option">
                        <input
                          type="radio"
                          name="canMessage"
                          value={opt.value}
                          checked={settings.privacyCanMessage === opt.value}
                          onChange={() => updateSettings('privacyCanMessage', opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="privacy-group">
                  <div className="privacy-row">
                    <div>
                      <div className="privacy-group-title">✅ Галочки прочтения</div>
                      <p className="privacy-desc">Показывать когда вы прочли сообщение</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings.privacyReadReceipts}
                        onChange={e => updateSettings('privacyReadReceipts', e.target.checked)}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>

                <button
                  className="settings-save-btn"
                  onClick={handleSavePrivacy}
                  disabled={saving}
                >
                  {saving ? '⏳ Сохранение...' : saved ? '✅ Сохранено!' : '💾 Сохранить'}
                </button>
              </div>
            )}

            {/* ─────────────────────────────────────────── БЕЗОПАСНОСТЬ */}
            {section === 'security' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Безопасность</h3>
                <TwoFactorSetup user={user} />
              </div>
            )}

            {/* ─────────────────────────────────────────── ДИЗАЙН */}
            {section === 'design' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Дизайн и внешний вид</h3>

                {/* Тема */}
                <div className="design-group">
                  <label className="design-label">Тема</label>
                  <div className="theme-cards">
                    <button
                      className={`theme-card ${settings.theme === 'dark' ? 'active' : ''}`}
                      onClick={() => updateSettings('theme', 'dark')}
                    >
                      <div className="theme-preview dark-preview">
                        <div className="tp-header" />
                        <div className="tp-msg tp-msg-in" />
                        <div className="tp-msg tp-msg-out" />
                      </div>
                      <span>🌙 Тёмная</span>
                    </button>
                    <button
                      className={`theme-card ${settings.theme === 'light' ? 'active' : ''}`}
                      onClick={() => updateSettings('theme', 'light')}
                    >
                      <div className="theme-preview light-preview">
                        <div className="tp-header" />
                        <div className="tp-msg tp-msg-in" />
                        <div className="tp-msg tp-msg-out" />
                      </div>
                      <span>☀️ Светлая</span>
                    </button>
                  </div>
                </div>

                {/* Акцентный цвет */}
                <div className="design-group">
                  <label className="design-label">Акцентный цвет</label>
                  <div className="color-picker">
                    {ACCENT_COLORS.map(color => (
                      <button
                        key={color}
                        className={`color-swatch ${settings.accentColor === color ? 'active' : ''}`}
                        style={{ background: color }}
                        onClick={() => updateSettings('accentColor', color)}
                        title={color}
                      />
                    ))}
                    <div className="color-custom">
                      <input
                        type="color"
                        value={settings.accentColor}
                        onChange={e => updateSettings('accentColor', e.target.value)}
                        title="Свой цвет"
                      />
                      <span>Свой</span>
                    </div>
                  </div>
                  {/* Превью */}
                  <div className="accent-preview" style={{ '--preview-accent': settings.accentColor }}>
                    <div className="ap-bubble ap-in">Привет! 👋</div>
                    <div className="ap-bubble ap-out">Привет! Как дела?</div>
                    <div className="ap-btn">Отправить</div>
                  </div>
                </div>

                {/* Размер шрифта */}
                <div className="design-group">
                  <label className="design-label">
                    Размер шрифта
                    <span className="design-value">
                      {{ small: 'Маленький', medium: 'Средний', large: 'Большой' }[settings.fontSize]}
                    </span>
                  </label>
                  <div className="font-sizes">
                    {[
                      { value: 'small', label: 'Аа', size: '13px' },
                      { value: 'medium', label: 'Аа', size: '16px' },
                      { value: 'large', label: 'Аа', size: '20px' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        className={`font-size-btn ${settings.fontSize === opt.value ? 'active' : ''}`}
                        onClick={() => updateSettings('fontSize', opt.value)}
                        style={{ fontSize: opt.size }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="font-preview" style={{ fontSize: { small: '13px', medium: '15px', large: '17px' }[settings.fontSize] }}>
                    Пример текста сообщения в чате
                  </div>
                </div>

                {/* Фон чата */}
                <div className="design-group">
                  <label className="design-label">Фон чата</label>
                  <div className="bg-patterns">
                    {CHAT_BG_PATTERNS.map(bg => (
                      <button
                        key={bg.id}
                        className={`bg-pattern-btn ${settings.chatBg === bg.id ? 'active' : ''}`}
                        onClick={() => updateSettings('chatBg', bg.id)}
                      >
                        <div
                          className="bg-pattern-preview"
                          style={bg.preview ? {
                            backgroundImage: bg.preview,
                            backgroundSize: bg.id === 'dots' ? '20px 20px' : '20px 20px',
                          } : {}}
                        />
                        <span>{bg.label}</span>
                      </button>
                    ))}
                    <label className="bg-pattern-btn custom-bg">
                      <div className="bg-pattern-preview">🖼️</div>
                      <span>Своя</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => {
                            updateSettings('chatBg', 'custom');
                            updateSettings('chatBgCustom', ev.target.result);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="settings-autosave-note">
                  ✨ Дизайн применяется мгновенно и сохраняется автоматически
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────── ПАПКИ */}
            {section === 'folders' && (
              <div className="settings-section">
                <h3 className="settings-section-title">Папки и разделы чатов</h3>
                <p className="settings-desc">
                  Организуйте чаты по папкам. Системные папки нельзя удалить.
                </p>

                {/* Список папок */}
                <div className="folders-list">
                  {settings.chatFolders.map((folder, idx) => (
                    <div key={folder.id} className={`folder-item ${folder.system ? 'system' : ''}`}>
                      <span className="folder-drag">⠿</span>
                      <span className="folder-icon">{folder.icon}</span>
                      <span className="folder-name">{folder.name}</span>
                      {folder.system
                        ? <span className="folder-system-badge">системная</span>
                        : <button
                            className="folder-delete"
                            onClick={() => removeFolder(folder.id)}
                            title="Удалить папку"
                          >✕</button>
                      }
                    </div>
                  ))}
                </div>

                {/* Добавить папку */}
                <div className="folder-add">
                  <h4>Создать папку</h4>
                  <div className="folder-add-row">
                    <div className="folder-icon-picker">
                      {['📁', '⭐', '👔', '🏠', '❤️', '🔥', '🎮', '📚', '💼', '🌍'].map(icon => (
                        <button
                          key={icon}
                          className={`icon-option ${newFolderIcon === icon ? 'active' : ''}`}
                          onClick={() => setNewFolderIcon(icon)}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                    <div className="folder-name-input">
                      <input
                        type="text"
                        placeholder="Название папки"
                        value={newFolder}
                        onChange={e => setNewFolder(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addFolder()}
                        maxLength={30}
                      />
                      <button
                        className="settings-save-btn inline"
                        onClick={addFolder}
                        disabled={!newFolder.trim()}
                      >
                        + Добавить
                      </button>
                    </div>
                  </div>
                </div>

                <div className="settings-autosave-note">
                  💡 Папки сохраняются автоматически. Перетащите для изменения порядка (скоро).
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

// Экспорт утилиты для применения темы при загрузке приложения
export { loadSettings, applyTheme };
export default SettingsPage;
