/**
 * MCS - TwoFactorVerify
 * Встраивается в LoginPage — запрашивает код после успешной проверки пароля.
 */

import React, { useState, useRef, useEffect } from 'react';

const TwoFactorVerify = ({ onSubmit, onBack, loading, error }) => {
  const [code, setCode] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.length === 6) onSubmit(code);
  };

  return (
    <div className="twofa-verify">
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔐</div>
        <h3 style={{ margin: 0, color: 'var(--text-primary, #1a1a2e)', fontSize: '1.25rem' }}>
          Двухфакторная аутентификация
        </h3>
        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary, #666)', fontSize: '0.9rem' }}>
          Введите 6-значный код из вашего приложения-аутентификатора
        </p>
      </div>

      {error && (
        <div className="error-message" style={{ marginBottom: '1rem' }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            style={{
              textAlign: 'center',
              fontSize: '2rem',
              letterSpacing: '0.4em',
              fontWeight: 700,
              padding: '0.75rem',
            }}
            required
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={loading || code.length !== 6}
          style={{ marginBottom: '0.75rem' }}
        >
          {loading ? 'Проверка...' : 'Подтвердить →'}
        </button>

        <button
          type="button"
          onClick={onBack}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary, #666)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            padding: '0.5rem',
          }}
        >
          ← Назад к входу
        </button>
      </form>
    </div>
  );
};

export default TwoFactorVerify;
