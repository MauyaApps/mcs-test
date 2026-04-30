import { useState, useRef, useEffect } from "react";
import "./EmojiReactions.css";

// Категории эмодзи
const EMOJI_CATEGORIES = {
  "❤️ Эмоции": ["❤️","😍","😂","😭","😮","😡","🥳","😎","🤔","🥹","😅","🤣","😢","🥰","😏","🤯","🤩","😬","🙄","😤"],
  "👍 Жесты": ["👍","👎","👏","🙌","🤝","💪","🤜","✌️","🤞","👋","🫶","🤙","☝️","🙏","💅","🫵"],
  "🔥 Символы": ["🔥","💯","⚡","✨","💥","🎉","🎊","❗","💔","💙","💚","💛","🖤","💜","🤍","🧡","❤️‍🔥"],
  "🐱 Животные": ["🐱","🐶","🦊","🐸","🐼","🦁","🐯","🦄","🐙","🦋","🐝","🦉","🐧","🦈","🐉"],
  "🍕 Еда": ["🍕","🍔","🍜","🍣","🎂","🍩","☕","🍺","🍾","🍫","🍿","🥑","🌮","🍦","🥗"],
  "⚽ Спорт": ["⚽","🏀","🎮","🏆","🎯","🎸","🎵","🎬","📸","🚀","✈️","🏖️","⛰️","🌍","🌙"],
};

// Компонент пикера эмодзи
function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState(Object.keys(EMOJI_CATEGORIES)[0]);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="emoji-picker" ref={ref}>
      <div className="emoji-picker-tabs">
        {Object.keys(EMOJI_CATEGORIES).map((cat) => (
          <button
            key={cat}
            className={`emoji-tab ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
            title={cat}
          >
            {cat.split(" ")[0]}
          </button>
        ))}
      </div>
      <div className="emoji-grid">
        {EMOJI_CATEGORIES[activeCategory].map((emoji) => (
          <button
            key={emoji}
            className="emoji-btn"
            onClick={() => { onSelect(emoji); onClose(); }}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// Компонент реакций под постом
export default function EmojiReactions({ postId, reactions = {}, userReaction, token, onUpdate }) {
  const [showPicker, setShowPicker] = useState(false);
  const [localReactions, setLocalReactions] = useState(reactions);
  const [localUserReaction, setLocalUserReaction] = useState(userReaction);
  const [loading, setLoading] = useState(false);

  // Синхронизируем с props
  useEffect(() => {
    setLocalReactions(reactions);
    setLocalUserReaction(userReaction);
  }, [reactions, userReaction]);

  const handleReact = async (emoji) => {
    if (loading) return;
    setLoading(true);

    // Оптимистичное обновление UI
    const newReactions = { ...localReactions };
    const prevReaction = localUserReaction;

    if (prevReaction) {
      // Убираем старую реакцию
      newReactions[prevReaction] = (newReactions[prevReaction] || 1) - 1;
      if (newReactions[prevReaction] <= 0) delete newReactions[prevReaction];
    }

    if (prevReaction !== emoji) {
      // Добавляем новую
      newReactions[emoji] = (newReactions[emoji] || 0) + 1;
      setLocalUserReaction(emoji);
    } else {
      // Убираем (toggle)
      setLocalUserReaction(null);
    }

    setLocalReactions(newReactions);

    try {
      const res = await fetch(`/api/posts/${postId}/react`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json();
      if (data.success) {
        setLocalReactions(data.reactions);
        setLocalUserReaction(data.userReaction);
        if (onUpdate) onUpdate(postId, data.reactions, data.userReaction);
      }
    } catch (e) {
      // Откатываем при ошибке
      setLocalReactions(reactions);
      setLocalUserReaction(userReaction);
    }

    setLoading(false);
  };

  const totalReactions = Object.values(localReactions).reduce((a, b) => a + b, 0);

  return (
    <div className="emoji-reactions-container">
      {/* Существующие реакции */}
      <div className="reactions-bar">
        {Object.entries(localReactions)
          .sort((a, b) => b[1] - a[1])
          .map(([emoji, count]) => (
            <button
              key={emoji}
              className={`reaction-pill ${localUserReaction === emoji ? "active" : ""}`}
              onClick={() => handleReact(emoji)}
              title={`${count} ${count === 1 ? "реакция" : "реакций"}`}
            >
              <span className="reaction-emoji">{emoji}</span>
              <span className="reaction-count">{count}</span>
            </button>
          ))}

        {/* Кнопка добавить реакцию */}
        <div className="add-reaction-wrapper">
          <button
            className="add-reaction-btn"
            onClick={() => setShowPicker((v) => !v)}
            title="Добавить реакцию"
          >
            {localUserReaction ? localUserReaction : "🙂"}
            <span className="add-icon">+</span>
          </button>

          {showPicker && (
            <EmojiPicker
              onSelect={handleReact}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
