'use client';

import { Conversation } from '@/lib/useConversations';

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClearAll,
  isOpen,
}: Props) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-top">
        <span className="sidebar-logo">✦ AnimeGPT</span>
        <button className="new-chat-btn" onClick={onNew}>+ New Chat</button>
      </div>

      <div className="conversations-list">
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`conv-item ${conv.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(conv.id)}
          >
            <div className="conv-info">
              <span className="conv-title">{conv.title}</span>
              <span className="conv-date">
                {new Date(conv.updatedAt).toLocaleDateString()}
              </span>
            </div>
            <button
              className="conv-delete"
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              aria-label="Delete"
            >✕</button>
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="conv-empty">No conversations yet</p>
        )}
      </div>

      {conversations.length > 0 && (
        <div className="sidebar-footer">
          <button className="clear-btn" onClick={onClearAll}>
            Clear all chats
          </button>
        </div>
      )}
    </aside>
  );
}
