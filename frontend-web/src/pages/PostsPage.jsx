/**
 * MCS - Posts Feed Page
 * Лента постов
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './PostsPage.css';

const PostsPage = () => {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      navigate('/login');
      return;
    }

    loadPosts(token);
  }, [navigate]);

  const loadPosts = async (token) => {
    try {
      const response = await fetch('/api/posts/feed', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPosts(data.data.posts || []);
      }
    } catch (err) {
      console.error('Error loading posts:', err);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    setLoading(true);
    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newPost,
          privacy: 'public'
        })
      });

      if (response.ok) {
        setNewPost('');
        loadPosts(token);
      } else {
        alert('Ошибка создания поста');
      }
    } catch (err) {
      console.error('Error creating post:', err);
      alert('Ошибка создания поста');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId) => {
    const token = localStorage.getItem('accessToken');

    try {
      const response = await fetch(`/api/posts/${postId}/react`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reactionType: 'like'
        })
      });

      if (response.ok) {
        loadPosts(token);
      }
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} дн назад`;
    return date.toLocaleDateString('ru-RU');
  };

  return (
    <div className="posts-page">
      <div className="posts-header">
        <h1>Лента новостей</h1>
        <button onClick={() => navigate('/dashboard')} className="btn-back">
          ← Назад
        </button>
      </div>

      <div className="create-post-card">
        <h3>Создать пост</h3>
        <form onSubmit={handleCreatePost}>
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Что нового?"
            rows="4"
            maxLength="5000"
          />
          <div className="post-actions">
            <span className="char-count">{newPost.length}/5000</span>
            <button type="submit" disabled={loading || !newPost.trim()}>
              {loading ? 'Публикация...' : '📤 Опубликовать'}
            </button>
          </div>
        </form>
      </div>

      <div className="posts-feed">
        {posts.length === 0 ? (
          <div className="no-posts">
            <p>📭 Пока нет постов</p>
            <p>Создайте первый пост!</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="post-card">
              <div className="post-header">
                <div className="avatar">
                  {post.display_name?.[0]?.toUpperCase() || post.username[0].toUpperCase()}
                </div>
                <div className="post-author">
                  <h4>{post.display_name || post.username}</h4>
                  <span className="post-time">{formatDate(post.created_at)}</span>
                </div>
              </div>

              <div className="post-content">
                <p>{post.content}</p>
              </div>

              <div className="post-footer">
                <button
                  onClick={() => handleLike(post.id)}
                  className={`btn-like ${post.my_reaction === 'like' ? 'active' : ''}`}
                >
                  ❤️ {post.total_reactions || 0}
                </button>
                <button className="btn-comment">
                  💬 Комментарии
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PostsPage;
