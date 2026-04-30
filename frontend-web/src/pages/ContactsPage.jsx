/**
 * MCS - Contacts Page
 * Страница управления контактами
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Contacts.css';

const ContactsPage = () => {
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }

    loadContacts(token);
  }, [navigate]);

  const loadContacts = async (token) => {
    try {
      const response = await fetch('/api/users/contacts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setContacts(data.data.contacts || []);
      }
    } catch (err) {
      console.error('Error loading contacts:', err);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 2) {
      alert('Введите минимум 2 символа');
      return;
    }

    setLoading(true);
    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data.users || []);
      }
    } catch (err) {
      console.error('Error searching users:', err);
      alert('Ошибка поиска');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async (userId) => {
    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch('/api/users/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contactId: userId
        })
      });

      if (response.ok) {
        alert('✅ Контакт добавлен!');
        loadContacts(token);
        setSearchResults([]);
        setSearchQuery('');
      } else {
        const data = await response.json();
        alert(`Ошибка: ${data.message}`);
      }
    } catch (err) {
      console.error('Error adding contact:', err);
      alert('Ошибка при добавлении контакта');
    }
  };

  const handleRemoveContact = async (contactId) => {
    if (!confirm('Удалить контакт?')) return;

    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch(`/api/users/contacts/${contactId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Контакт удалён');
        loadContacts(token);
      }
    } catch (err) {
      console.error('Error removing contact:', err);
      alert('Ошибка при удалении');
    }
  };

  return (
    <div className="contacts-page">
      <div className="contacts-header">
        <h1>Контакты</h1>
        <button onClick={() => navigate('/dashboard')} className="btn-back">
          ← Назад
        </button>
      </div>

      <div className="search-section">
        <h2>Поиск пользователей</h2>
        <div className="search-bar">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Введите username или имя..."
          />
          <button onClick={handleSearch} disabled={loading}>
            {loading ? '🔍 Поиск...' : '🔍 Найти'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="search-results">
            <h3>Результаты поиска:</h3>
            {searchResults.map(user => (
              <div key={user.id} className="user-card">
                <div className="avatar">
                  {user.display_name?.[0]?.toUpperCase() || user.username[0].toUpperCase()}
                </div>
                <div className="user-info">
                  <h4>{user.display_name || user.username}</h4>
                  <p>@{user.username}</p>
                  {user.bio && <p className="bio">{user.bio}</p>}
                </div>
                <button
                  onClick={() => handleAddContact(user.id)}
                  className="btn-add-contact"
                >
                  ➕ Добавить
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="contacts-section">
        <h2>Мои контакты ({contacts.length})</h2>
        {contacts.length === 0 ? (
          <div className="no-contacts">
            <p>📭 У вас пока нет контактов</p>
            <p>Используйте поиск выше чтобы найти друзей</p>
          </div>
        ) : (
          <div className="contacts-grid">
            {contacts.map(contact => (
              <div key={contact.user_id} className="contact-card">
                <div className="avatar large">
                  {contact.display_name?.[0]?.toUpperCase() || contact.username[0].toUpperCase()}
                </div>
                <div className="contact-details">
                  <h4>{contact.display_name || contact.username}</h4>
                  <p>@{contact.username}</p>
                  <span className={`status ${contact.is_online ? 'online' : 'offline'}`}>
                    {contact.is_online ? '🟢 Онлайн' : '⚫ Оффлайн'}
                  </span>
                </div>
                <div className="contact-actions">
                  <button
                    onClick={() => navigate('/messages')}
                    className="btn-message"
                  >
                    💬 Написать
                  </button>
                  <button
                    onClick={() => handleRemoveContact(contact.user_id)}
                    className="btn-remove"
                  >
                    🗑️ Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactsPage;
