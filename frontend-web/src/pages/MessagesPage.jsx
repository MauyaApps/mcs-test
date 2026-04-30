/**
 * MCS - Messages Page
 * Страница со списком чатов
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatWindow from '../components/Chat/ChatWindow';
import './Messages.css';

const MessagesPage = () => {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Проверка авторизации
    const token = localStorage.getItem('accessToken');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    setCurrentUser(JSON.parse(userData));
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

  const handleSelectContact = (contact) => {
    setSelectedContact(contact);
  };

  if (!currentUser) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="messages-page">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Чаты</h2>
          <button onClick={() => navigate('/dashboard')} className="btn-back">
            ← Назад
          </button>
        </div>

        <div className="contacts-list">
          {contacts.length === 0 ? (
            <div className="no-contacts">
              <p>📭 Нет контактов</p>
              <button onClick={() => navigate('/contacts')} className="btn-add">
                Добавить контакты
              </button>
            </div>
          ) : (
            contacts.map(contact => (
              <div
                key={contact.user_id}
                className={`contact-item ${selectedContact?.user_id === contact.user_id ? 'active' : ''}`}
                onClick={() => handleSelectContact(contact)}
              >
                <div className="avatar">
                  {contact.display_name?.[0]?.toUpperCase() || contact.username[0].toUpperCase()}
                </div>
                <div className="contact-info">
                  <h4>{contact.display_name || contact.username}</h4>
                  <p className={contact.is_online ? 'online' : 'offline'}>
                    {contact.is_online ? '🟢 Онлайн' : '⚫ Оффлайн'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chat-area">
        {selectedContact ? (
          <ChatWindow
            currentUserId={currentUser.id}
            recipientId={selectedContact.user_id}
            recipientPublicKey={selectedContact.public_key}
            recipientName={selectedContact.display_name || selectedContact.username}
          />
        ) : (
          <div className="no-chat-selected">
            <h3>👈 Выберите чат слева</h3>
            <p>Выберите контакт чтобы начать общение</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
