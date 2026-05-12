'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Bubble from './components/Bubble';
import PromptSuggestionsRow from './components/PromptSuggestionsRow';
import Sidebar from './components/Sidebar';
import { useConversations, readStorage } from '../lib/useConversations';
import logoSrc from './assets/AG-Logo.png';

const SUGGESTIONS_CACHE_KEY = 'animegpt-suggestions';
const SUGGESTIONS_TTL = 1000 * 60 * 60 * 24; // 24 h

export default function Chat() {
  const {
    conversations, activeId, setActiveId,
    createConversation, saveMessages, saveTitle,
    deleteConversation, clearAll,
  } = useConversations();

  const [convId, setConvId] = useState<string | null>(null);
  const convIdRef = useRef<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const titleDoneRef = useRef<Set<string>>(new Set());
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [suggestions, setSuggestions] = useState<Array<{ title: string; prompt: string }>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<ReturnType<typeof useChat>['messages']>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
  } | null>(null);

  // Keep refs in sync — onFinish is async and closes over stale values otherwise
  useEffect(() => { convIdRef.current = convId; }, [convId]);

  const { messages, setMessages, input, handleInputChange,
          handleSubmit, append, isLoading } = useChat({
    onFinish: async (message) => {
      const currentId = convIdRef.current;
      if (!currentId) return;

      // messagesRef.current may or may not include the final assistant message
      // depending on whether the state-sync effect ran before this callback.
      // Dedup by id to handle both timing cases without doubling.
      const current = messagesRef.current;
      const all = current.some(m => m.id === message.id)
        ? current
        : [...current, message];
      saveMessages(currentId, all);

      // Only generate title if conversation still has the default "New Chat" title
      const stored = readStorage().find(c => c.id === currentId);
      const needsTitle = !stored || stored.title === 'New Chat';
      if (needsTitle && !titleDoneRef.current.has(currentId)) {
        titleDoneRef.current.add(currentId);
        const first = all.find(m => m.role === 'user');
        if (first) {
          try {
            const res = await fetch('/api/generate-title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: first.content }),
            });
            const { title } = await res.json();
            saveTitle(currentId, title);
          } catch {}
        }
      }
    },
  });

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Load theme
  useEffect(() => {
    const savedTheme = (localStorage.getItem('anime-gpt-theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Load suggestions (cached 24 h)
  useEffect(() => {
    const load = async () => {
      try {
        const cached = localStorage.getItem(SUGGESTIONS_CACHE_KEY);
        if (cached) {
          const { suggestions: s, generatedAt } = JSON.parse(cached);
          if (Date.now() - generatedAt < SUGGESTIONS_TTL) {
            setSuggestions(s);
            setSuggestionsLoading(false);
            return;
          }
        }
      } catch {}

      try {
        const res = await fetch('/api/suggestions');
        const data = await res.json();
        setSuggestions(data.suggestions);
        localStorage.setItem(SUGGESTIONS_CACHE_KEY, JSON.stringify(data));
      } catch {
        // silent — show nothing rather than crash
      } finally {
        setSuggestionsLoading(false);
      }
    };
    load();
  }, []);

  // On mount: restore latest conversation or create a blank one
  useEffect(() => {
    const saved = readStorage();
    if (saved.length > 0) {
      const latest = saved.sort((a, b) => b.updatedAt - a.updatedAt)[0];
      setConvId(latest.id);
      setActiveId(latest.id);
      setMessages(latest.messages);
    } else {
      const c = createConversation();
      setConvId(c.id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('anime-gpt-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleNew = () => {
    const c = createConversation();
    convIdRef.current = c.id;
    setConvId(c.id);
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleSelect = (id: string) => {
    // Save current conversation using ref (always fresh, even if state is stale)
    if (convIdRef.current && messagesRef.current.length > 0) {
      saveMessages(convIdRef.current, messagesRef.current);
    }
    const fresh = readStorage();
    const found = fresh.find(c => c.id === id);
    if (found) {
      convIdRef.current = id;   // update immediately before any async onFinish can fire
      setActiveId(id);
      setConvId(id);
      setMessages(found.messages);
    }
    setSidebarOpen(false);
  };

  const handleDelete = (id: string) => {
    const nextId = deleteConversation(id, convId);
    if (id === convId) {
      if (nextId) {
        const fresh = readStorage();
        const found = fresh.find(c => c.id === nextId);
        convIdRef.current = nextId;
        setConvId(nextId);
        setMessages(found?.messages ?? []);
      } else {
        convIdRef.current = null;
        setConvId(null);
        setMessages([]);
      }
    }
  };

  const handleClearAll = () => {
    clearAll();
    setConvId(null);
    setMessages([]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be under 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPendingImage({
        base64: result.split(',')[1],
        mimeType: file.type,
        previewUrl: result,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;
    if (!input.trim() && !pendingImage) return;

    if (!convId) {
      const c = createConversation();
      convIdRef.current = c.id;
      setConvId(c.id);
    }

    if (pendingImage) {
      handleSubmit(e, {
        body: {
          imageBase64: pendingImage.base64,
          mimeType: pendingImage.mimeType,
        },
      });
      setPendingImage(null);
      return;
    }

    handleSubmit(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((input.trim() || pendingImage) && !isLoading) {
        onSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  // Reset textarea height after submit
  useEffect(() => {
    if (!input && inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input]);

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
        onClearAll={handleClearAll}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
      />

      <div className="main-panel">
        <header className="header">
          <div className="logo-container">
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <div className="logo">✦</div>
            <h1 className="logo-text">AnimeGPT</h1>
          </div>
          <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </header>

        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✦</div>
              <h2>Welcome to AnimeGPT</h2>
              <p>Ask me anything about anime — recommendations, characters, watch orders, and more!</p>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((message, index) => (
                <Bubble key={index} message={message} />
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="bubble-wrapper assistant">
                  <div className="avatar" style={{ background: 'none', overflow: 'hidden' }}>
                    <Image src={logoSrc} alt="AnimeGPT" width={32} height={32} style={{ display: 'block', borderRadius: '8px' }} />
                  </div>
                  <div className="bubble assistant-bubble typing-bubble">
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {messages.length === 0 && (
          <div className="suggestions-section">
            <PromptSuggestionsRow
              onSubmit={append}
              suggestions={suggestions}
              isLoading={suggestionsLoading}
            />
          </div>
        )}

        <footer className="input-footer">
          <div className="input-bar-wrapper">
            <form onSubmit={onSubmit} className="input-form">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onInput={e => autoResize(e.currentTarget)}
                placeholder="Ask me about anime, characters, recommendations..."
                className="input-field"
                disabled={isLoading}
                rows={1}
              />
              <button
                type="submit"
                className="send-button"
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
              >
                {isLoading ? <span className="loader" /> : <span className="send-icon">→</span>}
              </button>
            </form>
          </div>
        </footer>
      </div>
    </div>
  );
}
