/**
 * MCS - Login Page
 * Страница входа с поддержкой 2FA
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import TwoFactorVerify from '../components/TwoFactorVerify';
import './Auth.css';

const LoginPage = () => {
  const [formData, setFormData] = useState({ username: '', password: '', rememberMe: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password })
      });

      const data = await response.json();

      if (data.requires2FA) {
        // Пароль верный, но нужен код 2FA
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      if (data.success) {
        localStorage.setItem('accessToken', data.data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        navigate('/dashboard');
      } else {
        setError(data.message || 'Ошибка входа');
      }
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (twoFactorCode) => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          twoFactorCode
        })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('accessToken', data.data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        navigate('/dashboard');
      } else {
        setError(data.message || 'Неверный код');
      }
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      {/* Левая панель с описанием */}
      <div className="auth-features-panel">
        <div className="auth-brand">
          <h1 className="auth-brand-title">MCS</h1>
          <p className="auth-brand-slogan">Твоё общение, твои правила</p>
        </div>
        <div className="auth-features-list">
          <div className="auth-feature-item">
            <span className="auth-feature-icon">🔒</span>
            <div>
              <h3>Сквозное шифрование</h3>
              <p>Все сообщения защищены E2EE</p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon">⚡</span>
            <div>
              <h3>Мгновенные сообщения</h3>
              <p>Общайтесь в реальном времени</p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon">📸</span>
            <div>
              <h3>Истории</h3>
              <p>Делитесь моментами с друзьями</p>
            </div>
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-icon">📢</span>
            <div>
              <h3>Каналы</h3>
              <p>Создавайте и подписывайтесь</p>
            </div>
          </div>
        </div>
      </div>

      {/* Правая форма */}
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>MCS</h1>
            <p>{requires2FA ? 'Подтверждение входа' : 'Добро пожаловать!'}</p>
          </div>

          {requires2FA ? (
            <TwoFactorVerify
              onSubmit={handle2FASubmit}
              onBack={() => { setRequires2FA(false); setError(''); }}
              loading={loading}
              error={error}
            />
          ) : (
            <form onSubmit={handleSubmit} className="auth-form">
              {error && <div className="error-message">⚠️ {error}</div>}

              <div className="form-group">
                <label htmlFor="username">Username или Email</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Введите username или email"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Пароль</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Введите пароль"
                  required
                />
              </div>

              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                  />
                  Запомнить меня
                </label>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </form>
          )}

          {!requires2FA && (
            <div className="auth-footer">
              <p>Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
