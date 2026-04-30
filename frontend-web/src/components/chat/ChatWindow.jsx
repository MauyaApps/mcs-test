/**
 * MCS (Mauya Chat&Social) - Chat Window Component
 * Код 8: Компонент окна чата (Frontend)
 */

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { encryptMessage, decryptMessage, getPrivateKeyFromIndexedDB } from '../../utils/encryption';
import './ChatWindow.css';

const ChatWindow = ({ currentUserId, recipientId, recipientPublicKey, recipientName }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [privateKey, setPrivateKey] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Инициализация WebSocket соединения
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      console.error('No access token found');
      return;
    }

    const newSocket = io('http://localhost:5000', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('new_message', async (data) => {
      const decrypted = await decryptMessage(
        data.message.encrypted_content,
        privateKey
      );

      setMessages(prev => [...prev, {
        ...data.message,
        decryptedContent: decrypted,
        isOwn: false
      }]);
    });

    newSocket.on('message_sent', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.tempId === data.tempId 
          ? { ...data.message, decryptedContent: msg.decryptedContent, isOwn: true }
          : msg
      ));
    });

    newSocket.on('user_typing', (data) => {
      if (data.userId === recipientId) {
        setIsTyping(true);
      }
    });

    newSocket.on('user_stopped_typing', (data) => {
      if (data.userId === recipientId) {
        setIsTyping(false);
      }
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [recipientId, privateKey]);

  // Загрузка приватного ключа
  useEffect(() => {
    const loadPrivateKey = async () => {
      const key = await getPrivateKeyFromIndexedDB();
      setPrivateKey(key);
    };
    loadPrivateKey();
  }, []);

  // Автоскролл
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Отправка сообщения
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !socket || !recipientPublicKey) {
      return;
    }

    try {
      const encrypted = await encryptMessage(newMessage, recipientPublicKey);
      const tempId = Date.now();

      const tempMessage = {
        tempId,
        sender_id: currentUserId,
        receiver_id: recipientId,
        decryptedContent: newMessage,
        timestamp: new Date().toISOString(),
        isOwn: true,
        isPending: true
      };

      setMessages(prev => [...prev, tempMessage]);

      socket.emit('send_message', {
        receiverId: recipientId,
        encryptedContent: encrypted,
        messageType: 'text',
        tempId: tempId
      });

      setNewMessage('');
      socket.emit('typing_stop', { receiverId: recipientId });

    } catch (error) {
      console.error('Error sending message:', error);
      alert('Ошибка при отправке сообщения');
    }
  };

  // Обработка печати
  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!socket) return;

    socket.emit('typing_start', { receiverId: recipientId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { receiverId: recipientId });
    }, 2000);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="recipient-info">
          <div className="avatar">{recipientName?.[0]?.toUpperCase()}</div>
          <div className="details">
            <h3>{recipientName}</h3>
            <span className={`status ${isConnected ? 'online' : 'offline'}`}>
              {isConnected ? '🟢 Онлайн' : '⚫ Оффлайн'}
            </span>
          </div>
        </div>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>Нет сообщений. Начните общение! 👋</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg.id || msg.tempId || index}
              className={`message ${msg.isOwn ? 'own' : 'other'} ${msg.isPending ? 'pending' : ''}`}
            >
              <div className="message-content">
                {msg.decryptedContent}
                {msg.isPending && <span className="pending-indicator">⏳</span>}
              </div>
              <div className="message-meta">
                <span className="time">{formatTime(msg.timestamp)}</span>
                {msg.isOwn && msg.is_read && <span className="read-receipt">✓✓</span>}
                {msg.isOwn && !msg.is_read && !msg.isPending && <span className="sent-receipt">✓</span>}
              </div>
            </div>
          ))
        )}

        {isTyping && (
          <div className="typing-indicator">
            <span>{recipientName} печатает</span>
            <div className="dots">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="message-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={handleTyping}
          placeholder="Введите сообщение..."
          disabled={!isConnected || !recipientPublicKey}
        />
        <button 
          type="submit" 
          disabled={!newMessage.trim() || !isConnected}
        >
          📤 Отправить
        </button>
      </form>

      {!isConnected && (
        <div className="connection-warning">
          ⚠️ Подключение к серверу потеряно. Переподключение...
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
