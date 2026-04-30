/**
 * MCS - Full Chat Component
 * Встроенный чат — рендерит только область сообщений.
 * Список контактов управляется родительским UnifiedChatView.
 */

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { encryptMessage, decryptMessage, getPrivateKeyFromIndexedDB } from '../../utils/encryption';
import './FullChat.css';

const FullChat = ({ currentUser, openChatWith, onChatOpened }) => {
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [privateKey, setPrivateKey] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const selectedContactRef = useRef(null);
  const privateKeyRef = useRef(null);

  useEffect(() => { selectedContactRef.current = selectedContact; }, [selectedContact]);
  useEffect(() => { privateKeyRef.current = privateKey; }, [privateKey]);

  // Открыть чат с переданным контактом
  useEffect(() => {
    if (openChatWith) {
      selectContact({
        id: openChatWith.id,
        username: openChatWith.username,
        display_name: openChatWith.display_name,
        avatar: openChatWith.avatar,
        public_key: openChatWith.public_key || null
      });
      onChatOpened?.();
    }
  }, [openChatWith]);

  // Загрузка приватного ключа
  useEffect(() => {
    getPrivateKeyFromIndexedDB().then(key => setPrivateKey(key));
  }, []);

  // Получить публичный ключ пользователя
  const fetchPublicKey = async (userId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data.data?.user?.public_key || null;
      }
    } catch {}
    return null;
  };

  // WebSocket — инициализируется один раз
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const newSocket = io(window.location.origin, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));

    newSocket.on('new_message', async (data) => {
      const contact = selectedContactRef.current;
      const pk = privateKeyRef.current;
      if (!data?.message) return;

      if (
        data.message.sender_id === contact?.id ||
        data.message.receiver_id === currentUser.id
      ) {
        let decrypted = data.message.encrypted_content;
        try {
          decrypted = await decryptMessage(data.message.encrypted_content, pk);
        } catch {
          try { decrypted = decodeURIComponent(escape(atob(data.message.encrypted_content))); } catch {}
        }
        setMessages(prev => [...prev, {
          ...data.message,
          decryptedContent: decrypted,
          isOwn: data.message.sender_id === currentUser.id
        }]);
      }
    });

    newSocket.on('message_sent', (data) => {
      setMessages(prev => prev.map(msg =>
        msg.tempId === data.tempId
          ? { ...data.message, decryptedContent: msg.decryptedContent, isOwn: true, isPending: false }
          : msg
      ));
    });

    newSocket.on('message_error', (data) => {
      setMessages(prev => prev.map(msg =>
        msg.isPending ? { ...msg, isPending: false, failed: true } : msg
      ));
    });

    newSocket.on('user_typing', (data) => {
      if (data.userId === selectedContactRef.current?.id) setIsTyping(true);
    });

    newSocket.on('user_stopped_typing', (data) => {
      if (data.userId === selectedContactRef.current?.id) setIsTyping(false);
    });

    setSocket(newSocket);
    return () => newSocket.close();
  }, [currentUser]);

  const selectContact = async (contact) => {
    let pk = contact.public_key;
    if (!pk) pk = await fetchPublicKey(contact.id);
    setSelectedContact({ ...contact, public_key: pk });
    setMessages([]);
    loadMessageHistory(contact.id);
  };

  const loadMessageHistory = async (contactId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/messages/history/${contactId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const msgs = data.data?.messages || [];
        const pk = privateKeyRef.current;

        const decrypted = await Promise.all(msgs.map(async (msg) => {
          let content = msg.encrypted_content;
          try {
            content = await decryptMessage(msg.encrypted_content, pk);
          } catch {
            try { content = decodeURIComponent(escape(atob(msg.encrypted_content))); } catch {}
          }
          return { ...msg, decryptedContent: content, isOwn: msg.sender_id === currentUser.id };
        }));

        setMessages(decrypted);
      }
    } catch (err) {
      console.error('Error loading message history:', err);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !selectedContact) return;

    try {
      let encrypted;
      try {
        encrypted = await encryptMessage(newMessage, selectedContact.public_key);
      } catch {
        encrypted = btoa(unescape(encodeURIComponent(newMessage)));
      }

      const tempId = Date.now().toString();
      setMessages(prev => [...prev, {
        tempId,
        sender_id: currentUser.id,
        receiver_id: selectedContact.id,
        decryptedContent: newMessage,
        timestamp: new Date().toISOString(),
        isOwn: true,
        isPending: true
      }]);

      socket.emit('send_message', {
        receiverId: selectedContact.id,
        encryptedContent: encrypted,
        messageType: 'text',
        tempId
      });

      setNewMessage('');
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.emit('typing_stop', { receiverId: selectedContact.id });
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!socket || !selectedContact) return;
    socket.emit('typing_start', { receiverId: selectedContact.id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', { receiverId: selectedContact.id });
    }, 2000);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  if (!selectedContact) {
    return (
      <div className="full-chat">
        <div className="no-chat-selected">
          <p>👈 Выберите контакт для начала общения</p>
        </div>
      </div>
    );
  }

  return (
    <div className="full-chat">
      <div className="chat-area">
        <div className="chat-header">
          <div className="chat-user-info">
            <div className="chat-avatar">
              {(selectedContact.display_name || selectedContact.username)?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <h3>{selectedContact.display_name || selectedContact.username}</h3>
              <p>{isConnected ? '🟢 Онлайн' : '⚫ Оффлайн'}</p>
            </div>
          </div>
          <div className="connection-status">{isConnected ? '🟢' : '🔴'}</div>
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
                className={`message ${msg.isOwn ? 'own' : 'other'} ${msg.isPending ? 'pending' : ''} ${msg.failed ? 'failed' : ''}`}
              >
                <div className="message-content">
                  {msg.decryptedContent || msg.content || '...'}
                  {msg.isPending && <span className="pending-indicator">⏳</span>}
                  {msg.failed && <span className="pending-indicator">❌</span>}
                </div>
                <div className="message-meta">
                  <span className="time">{formatTime(msg.timestamp || msg.created_at)}</span>
                  {msg.isOwn && msg.is_read && <span className="read-receipt">✓✓</span>}
                  {msg.isOwn && !msg.is_read && !msg.isPending && <span className="sent-receipt">✓</span>}
                </div>
              </div>
            ))
          )}

          {isTyping && (
            <div className="typing-indicator">
              <span>{selectedContact.display_name} печатает</span>
              <div className="dots"><span>.</span><span>.</span><span>.</span></div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form className="message-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder={isConnected ? 'Введите сообщение...' : 'Нет соединения...'}
            disabled={!isConnected}
          />
          <button type="submit" disabled={!newMessage.trim() || !isConnected}>📤</button>
        </form>
      </div>
    </div>
  );
};

export default FullChat;
