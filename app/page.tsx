'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Bubble from './components/Bubble';
import PromptSuggestionsRow from './components/PromptSuggestionsRow';
import Sidebar from './components/Sidebar';
import { useConversations, readStorage } from '../lib/useConversations';
import logoSrc from './assets/AG-Logo.png';
import aotSrc from './assets/Camera.png';
import denDenMochiSrc from './assets/DenDenMochi.png';

const SUGGESTIONS_CACHE_KEY = 'animegpt-suggestions';
const SUGGESTIONS_TTL = 1000 * 60 * 60 * 24; // 24 h

const ANIME_IDENTIFY_PROMPT = `
You are AnimeGPT — an expert anime identifier with encyclopedic knowledge of every anime series, film, and OVA ever made.

Carefully analyze every visual detail in this image and respond STRICTLY using the template below. Fill every section — if you are uncertain, make your best guess and note it inline.

---
🎌 **Anime:** [Full official title — both English and Japanese if known]

👤 **Characters:** [List each visible character: Name · Role · Notable trait. If unidentified, describe appearance: hair color, outfit, weapon, etc.]

📺 **Scene Context:** [Name the arc, saga, or episode type if recognizable. Otherwise describe what kind of scene this appears to be.]

📖 **Synopsis:** [2–3 sentence spoiler-free description that captures the essence of the series]

⭐ **Genres:** [Use tag format: Action · Dark Fantasy · Shounen · etc.]

💡 **Why Watch:** [One enthusiastic, persuasive sentence — write it like a passionate anime fan]

🔗 **You Might Also Like:** [3 recommendations in format: Anime Name — one-word reason]
---

Important rules:
- NEVER leave a section blank. Use all visual clues (art style, costume, setting, color palette, character design) if the title is unclear.
- Keep the tone enthusiastic and fan-like throughout.
- If confidence is low on the title, note it with "(possibly)" but still commit to your best answer.
`.trim();

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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
  } | null>(null);
  const pendingImagePreviewRef = useRef<string | null>(null);
  const isFeatureModeRef = useRef(false);
  const [messageImages, setMessageImages] = useState<Record<string, string>>({});

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

  useEffect(() => {
    messagesRef.current = messages;
    // When a new user message lands, attach the pending image preview to it
    if (pendingImagePreviewRef.current && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'user') {
        const preview = pendingImagePreviewRef.current;
        pendingImagePreviewRef.current = null;
        setMessageImages(prev => ({ ...prev, [last.id]: preview }));
      }
    }
  }, [messages]);

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

  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        });

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();
          if (data.text) {
            const syntheticEvent = {
              target: { value: input + (input ? ' ' : '') + data.text },
            } as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange(syntheticEvent);
          }
        } catch (err) {
          console.error('Transcription failed:', err);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access denied. Please allow microphone access and try again.');
    }
  };

  // Ensure a conversation exists before any append/submit — updates refs synchronously
  const ensureConv = () => {
    if (!convIdRef.current) {
      const c = createConversation();
      convIdRef.current = c.id;
      setConvId(c.id);
    }
  };

  // Auto-identify flow: friendly display text in chat, full structured prompt sent to API
  const submitImageIdentify = (imageData: { base64: string; mimeType: string; previewUrl: string }) => {
    ensureConv();
    pendingImagePreviewRef.current = imageData.previewUrl;
    append(
      { role: 'user', content: '🔍 Identify this anime' },
      {
        body: {
          imageBase64: imageData.base64,
          mimeType: imageData.mimeType,
          hiddenPrompt: ANIME_IDENTIFY_PROMPT,
        },
      }
    );
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
      const imageData = {
        base64: result.split(',')[1],
        mimeType: file.type,
        previewUrl: result,
      };
      if (isFeatureModeRef.current) {
        // Feature card path: auto-submit immediately with hidden structured prompt
        isFeatureModeRef.current = false;
        submitImageIdentify(imageData);
      } else {
        // Normal attach path: show preview, let user add text or hit send
        setPendingImage(imageData);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
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
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;
    if (!input.trim() && !pendingImage) return;

    if (pendingImage) {
      const snap = pendingImage;
      setPendingImage(null);

      if (!input.trim()) {
        // Image only → structured identify (same as feature card flow)
        submitImageIdentify(snap);
      } else {
        // Image + custom text → send user's question to GPT-4o
        ensureConv();
        pendingImagePreviewRef.current = snap.previewUrl;
        handleSubmit(e, {
          body: { imageBase64: snap.base64, mimeType: snap.mimeType },
        });
      }
      return;
    }

    ensureConv();
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
              <div className="find-anime-card" onClick={() => { isFeatureModeRef.current = true; fileInputRef.current?.click(); }}>
                <Image src={aotSrc} alt="Find Anime" width={36} height={36} className="find-anime-icon" />
                <div className="find-anime-text">
                  <span className="find-anime-title">Find your anime using images</span>
                  <span className="find-anime-desc">Upload or paste a screenshot — AnimeGPT will identify it</span>
                </div>
                <span className="find-anime-arrow">→</span>
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((message, index) => (
                <Bubble key={index} message={message} imagePreview={messageImages[message.id]} />
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

            {pendingImage && (
              <div className="image-preview-bar">
                <img src={pendingImage.previewUrl} alt="preview" className="image-thumb" />
                <span className="image-hint">
                  Send to identify this anime, or type a question first
                </span>
                <button
                  type="button"
                  className="image-remove"
                  onClick={() => setPendingImage(null)}
                >✕</button>
              </div>
            )}

            <form onSubmit={onSubmit} className="input-form">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                className="attach-btn"
                onClick={() => { isFeatureModeRef.current = false; fileInputRef.current?.click(); }}
                disabled={isLoading}
                aria-label="Find your anime using images"
                title="Find your anime using images"
              >
                <Image src={aotSrc} alt="Find anime" width={26} height={26} className="attach-icon" />
              </button>

              <button
                type="button"
                className={`mic-btn${isRecording ? ' recording' : ''}${isTranscribing ? ' transcribing' : ''}`}
                onClick={handleMicClick}
                disabled={isLoading || isTranscribing}
                aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                title={isRecording ? 'Stop recording' : 'Speak your question'}
              >
                <div className="mic-btn-inner">
                  <Image
                    src={denDenMochiSrc}
                    alt="Voice input"
                    width={26}
                    height={26}
                    className="mic-icon"
                  />
                  {isTranscribing && <span className="mic-loader" />}
                </div>
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onInput={e => autoResize(e.currentTarget)}
                onPaste={handlePaste}
                placeholder={
                  pendingImage
                    ? 'Ask something about this image, or just hit send...'
                    : 'Ask me about anime, characters, recommendations...'
                }
                className="input-field"
                disabled={isLoading}
                rows={1}
              />

              <button
                type="submit"
                className="send-button"
                disabled={isLoading || (!input.trim() && !pendingImage)}
                aria-label="Send"
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
