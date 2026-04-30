import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';

import './App.css';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('accessToken');
  return token ? children : <Navigate to="/login" />;
}

// Сохраняет текущий маршрут в localStorage при каждом переходе
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    localStorage.setItem('lastRoute', location.pathname);
  }, [location]);
  return null;
}

function App() {
  return (
    <Router>
      <RouteTracker />
      <div className="app-main-wrapper">
        <Routes>
          <Route path="/" element={<SmartRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          } />
          <Route path="*" element={<SmartRedirect />} />
        </Routes>
      </div>
    </Router>
  );
}

// При обновлении страницы восстанавливает последний маршрут
function SmartRedirect() {
  const token = localStorage.getItem('accessToken');
  const lastRoute = localStorage.getItem('lastRoute');

  if (token && lastRoute && lastRoute !== '/' && lastRoute !== '/login' && lastRoute !== '/register') {
    return <Navigate to={lastRoute} replace />;
  }
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
}

function LandingPage() {
  const [serverStatus, setServerStatus] = useState('checking...');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/status-check')
      .then(res => res.json())
      .then(() => setServerStatus('connected ✅'))
      .catch(() => setServerStatus('disconnected ❌'));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <div className="logo">
          <h1>MCS</h1>
          <p className="tagline">Твоё общение, твои правила</p>
        </div>

        <div className="status">
          Backend: <strong>{serverStatus}</strong>
        </div>

        <div className="features">
          <div className="feature">
            <span style={{ fontSize: '2rem' }}>🔒</span>
            <h3>Сквозное шифрование</h3>
            <p>Все сообщения защищены E2EE</p>
          </div>
          <div className="feature">
            <span style={{ fontSize: '2rem' }}>⚡</span>
            <h3>Мгновенные сообщения</h3>
            <p>Общайтесь в реальном времени</p>
          </div>
          <div className="feature">
            <span style={{ fontSize: '2rem' }}>📸</span>
            <h3>Истории</h3>
            <p>Делитесь моментами с друзьями</p>
          </div>
          <div className="feature">
            <span style={{ fontSize: '2rem' }}>📢</span>
            <h3>Каналы</h3>
            <p>Создавайте и подписывайтесь</p>
          </div>
        </div>

        <div className="cta">
          <button className="btn-primary" onClick={() => navigate('/register')}>Начать</button>
          <button className="btn-secondary" onClick={() => navigate('/login')}>Войти</button>
        </div>

        <footer>
          <p>MCS v1.0.1 | Made with ❤️</p>
        </footer>
      </header>
    </div>
  );
}

export default App;
