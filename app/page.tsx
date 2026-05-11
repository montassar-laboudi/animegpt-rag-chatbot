'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Bubble from './components/Bubble';
import PromptSuggestionsRow from './components/PromptSuggestionsRow';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit, append, isLoading } = useChat();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = (localStorage.getItem('anime-gpt-theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('anime-gpt-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim()) {
      handleSubmit(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header with Logo and Theme Toggle */}
      <header className="header">
        <div className="logo-container">
          <div className="logo">✦</div>
          <h1 className="logo-text">AnimeGPT</h1>
        </div>
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>

      {/* Chat Messages Container */}
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
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Prompt Suggestions */}
      {messages.length === 0 && (
        <div className="suggestions-section">
          <PromptSuggestionsRow onSubmit={append} />
        </div>
      )}

      {/* Input Bar */}
      <footer className="input-footer">
        <div className="input-bar-wrapper">
          <form onSubmit={onSubmit} className="input-form">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
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
              {isLoading ? (
                <span className="loader" />
              ) : (
                <span className="send-icon">→</span>
              )}
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
}