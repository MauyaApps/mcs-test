/**
 * MCS - TwoFactorSetup
 * Компонент настройки 2FA в разделе Настройки
 */

import React, { useState, useEffect } from 'react';

const TwoFactorSetup = ({ user }) => {
  const [status, setStatus] = useState(null); // { enabled, pending }
  const [step, setStep] = useState('idle');   // idle | qr | verify | done
  const [qrData, setQrData] = useState(null);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const token = () => localStorage.getItem('accessToken');

  const loadStatus = async () => {
    try {
      const res = await fetch('/api/2fa/status', {
        headers: { Authorization: `Bearer ${token()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.data);
      }
    } catch {}
  };

  const handleStartSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/2fa/setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (data.success) {
        setQrData(data.data.qrDataUrl);
        setSecret(data.data.secret);
        setStep('qr');
      } else {
        setError(data.message || 'Ошибка');
      }
    } catch {
      setError('Ошибка соединения');
    }
    setLoading(false);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Код должен содержать 6 цифр'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ token: code })
      });
      const data = await res.json();
      if (data.success) {
        setStep('done');
        setStatus({ enabled: true, pending: false });
      } else {
        setError(data.message || 'Неверный код');
      }
    } catch {
      setError('Ошибка соединения');
    }
    setLoading(false);
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    if (disableCode.length !== 6) { setError('Код должен содержать 6 цифр'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ token: disableCode })
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ enabled: false, pending: false });
        setShowDisable(false);
        setDisableCode('');
        setStep('idle');
      } else {
        setError(data.message || 'Неверный код');
      }
    } catch {
      setError('Ошибка соединения');
    }
    setLoading(false);
  };

  if (!status) return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Загрузка...</div>;

  return (
    <div className="twofa-setup">
      <h4 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)', fontSize: '1rem' }}>
        🔐 Двухфакторная аутентификация
      </h4>
      <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        Дополнительная защита аккаунта через приложение-аутентификатор (Google Authenticator, Authy и др.)
      </p>

      {error && (
        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.6rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Статус включён */}
      {status.enabled && step !== 'done' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
              ✅ Включена
            </span>
          </div>

          {!showDisable ? (
            <button
              className="btn-danger"
              onClick={() => { setShowDisable(true); setError(''); }}
              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Отключить 2FA
            </button>
          ) : (
            <form onSubmit={handleDisable} style={{ marginTop: '0.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Введите текущий код из приложения для подтверждения:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={e => setDisableCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '1.1rem', letterSpacing: '0.2em', textAlign: 'center' }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  {loading ? '...' : 'Подтвердить'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDisable(false); setError(''); setDisableCode(''); }}
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Отмена
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Статус выключен — начало настройки */}
      {!status.enabled && step === 'idle' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 600 }}>
              ⭕ Выключена
            </span>
          </div>
          <button
            onClick={handleStartSetup}
            disabled={loading}
            className="settings-save-btn"
            style={{ marginTop: 0 }}
          >
            {loading ? '⏳ Генерация...' : '🔐 Включить 2FA'}
          </button>
        </div>
      )}

      {/* Шаг 1: QR-код */}
      {step === 'qr' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            1. Откройте Google Authenticator или Authy<br />
            2. Отсканируйте QR-код ниже<br />
            3. Введите 6-значный код для подтверждения
          </p>

          {qrData && (
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <img src={qrData} alt="QR Code" style={{ width: 200, height: 200, border: '4px solid var(--border)', borderRadius: '12px' }} />
            </div>
          )}

          <details style={{ marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Ввести ключ вручную
            </summary>
            <code style={{ display: 'block', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '0.8rem', wordBreak: 'break-all', color: 'var(--text-primary)' }}>
              {secret}
            </code>
          </details>

          <button onClick={() => setStep('verify')} className="settings-save-btn" style={{ marginTop: 0 }}>
            Я отсканировал → Ввести код
          </button>
        </div>
      )}

      {/* Шаг 2: Верификация */}
      {step === 'verify' && (
        <form onSubmit={handleVerify}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            Введите 6-значный код из приложения:
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            autoFocus
            style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '2px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '1.5rem', letterSpacing: '0.3em', textAlign: 'center', marginBottom: '0.75rem', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={loading || code.length !== 6} className="settings-save-btn" style={{ marginTop: 0, flex: 1 }}>
              {loading ? '⏳ Проверка...' : '✅ Подтвердить'}
            </button>
            <button type="button" onClick={() => { setStep('qr'); setError(''); }} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
              Назад
            </button>
          </div>
        </form>
      )}

      {/* Успех */}
      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>2FA включена!</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            При следующем входе потребуется код из приложения.
          </p>
        </div>
      )}
    </div>
  );
};

export default TwoFactorSetup;
