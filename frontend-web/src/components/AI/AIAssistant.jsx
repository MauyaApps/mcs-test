/**
 * MCS AI Assistant
 * Код 23: AI Помощник на базе Claude API
 */

import React, { useState, useRef, useEffect } from 'react';
import './AIAssistant.css';

const AIAssistant = () => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Привет! Я AI помощник MCS. Задавайте любые вопросы!',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: messages
            .filter(m => m.role !== 'system')
            .map(m => ({
              role: m.role,
              content: m.content
            }))
            .concat([{ role: 'user', content: input }])
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      
      const assistantMessage = {
        role: 'assistant',
        content: data.data.content[0].text,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Ошибка: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm('Очистить историю чата?')) {
      setMessages([{
        role: 'assistant',
        content: '👋 История очищена. Чем могу помочь?',
        timestamp: new Date()
      }]);
    }
  };

  return (
    <div className={`ai-assistant ${isOpen ? 'open' : ''}`}>
      {/* Кнопка открытия */}
      {!isOpen && (
        <button className="ai-toggle-btn" onClick={() => setIsOpen(true)}>
          <div className="ai-logo">
            <span className="logo-text">MCS</span>
            <span className="ai-badge">AI</span>
          </div>
        </button>
      )}

      {/* Окно чата */}
      {isOpen && (
        <div className="ai-chat-window">
          <div className="ai-header">
            <div className="ai-header-info">
              <div className="ai-logo-small">
                <span>MCS</span>
              </div>
              <div>
                <h3>AI Помощник</h3>
                <p>Powered by Claude</p>
              </div>
            </div>
            <div className="ai-header-actions">
              <button onClick={clearChat} title="Очистить">
                🗑️
              </button>
              <button onClick={() => setIsOpen(false)} title="Свернуть">
                ✕
              </button>
            </div>
          </div>

          <div className="ai-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'assistant' ? '🤖' : '👤'}
                </div>
                <div className="message-bubble">
                  <div className="message-content">{msg.content}</div>
                  <div className="message-time">
                    {msg.timestamp.toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="ai-message assistant">
                <div className="message-avatar">🤖</div>
                <div className="message-bubble loading">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form className="ai-input-form" onSubmit={sendMessage}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Задайте вопрос AI..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? '⏳' : '📤'}
            </button>
          </form>

          <div className="ai-footer">
            <small>MCS AI Assistant • Claude Sonnet 4</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
