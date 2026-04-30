import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Better Stack frontend logging
const LOGTAIL_TOKEN = 'iarEDayfDiii27YJoFvS1d5Q';
const sendLog = (level, message, data = {}) => {
  fetch('https://in.logs.betterstack.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LOGTAIL_TOKEN}`
    },
    body: JSON.stringify({
      level,
      message,
      ...data,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    })
  }).catch(() => {});
};

// Перехват JS ошибок
window.onerror = (message, source, lineno, colno, error) => {
  sendLog('error', String(message), {
    source, lineno, colno,
    stack: error?.stack
  });
};

// Перехват промис ошибок
window.onunhandledrejection = (event) => {
  sendLog('error', 'Unhandled Promise Rejection', {
    reason: String(event.reason)
  });
};

// Глобальный логгер для использования в приложении
window.mcsLog = {
  error: (msg, data) => sendLog('error', msg, data),
  warn:  (msg, data) => sendLog('warn',  msg, data),
  info:  (msg, data) => sendLog('info',  msg, data),
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
