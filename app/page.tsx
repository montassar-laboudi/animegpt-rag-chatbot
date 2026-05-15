'use client';

import { useChat } from 'ai/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useSession, signIn, signOut } from 'next-auth/react';
import Bubble from './components/Bubble';
import PromptSuggestionsRow from './components/PromptSuggestionsRow';
import Sidebar from './components/Sidebar';
import SignInModal from './components/SignInModal';
import UsageBanner from './components/UsageBanner';
import UserMenu from './components/UserMenu';
import { useConversations, Conversation, StoredMessage } from '../lib/useConversations';
import { useUsageCounter } from '../lib/useUsageCounter';
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
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  const {
    conversations, activeId, setActiveId,
    loading, createConversation, saveMessages, saveTitle,
    deleteConversation, clearAll, migrateLocalToCloud,
  } = useConversations(isLoggedIn);

  const [convId, setConvId] = useState<string | null>(null);
  const convIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const prevLoggedInRef = useRef(false);

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
  const blobUrlsRef = useRef<Record<string, string>>({});

  const { count, increment, reset, isAtLimit, showWarning, remaining } = useUsageCounter(isLoggedIn);

  // Keep conversationsRef in sync for onFinish (avoids stale closure)
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // Keep convIdRef in sync
  useEffect(() => { convIdRef.current = convId; }, [convId]);

  const { messages, setMessages, input, handleInputChange, setInput,
          handleSubmit, append, isLoading } = useChat({
    onFinish: async (message) => {
      const currentId = convIdRef.current;
      if (!currentId) return;

      const current = messagesRef.current;
      const all = current.some(m => m.id === message.id)
        ? current
        : [...current, message];
      const storedMessages: StoredMessage[] = all.map(m => ({
        ...m,
        imageUrl: blobUrlsRef.current[m.id],
      }));
      await saveMessages(currentId, storedMessages);

      // Generate title only once per conversation
      const stored = conversationsRef.current.find(c => c.id === currentId);
      const needsTitle = !stored || stored.title === 'New Chat';
      if (needsTitle && !titleDoneRef.current.has(currentId)) {
        titleDoneRef.current.add(currentId);
        const first = all.find(m => m.role === 'user');
        const firstAssistant = all.find(m => m.role === 'assistant');
        if (first) {
          try {
            const res = await fetch('/api/generate-title', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: typeof first.content === 'string' ? first.content : '',
                assistantMessage: firstAssistant && typeof firstAssistant.content === 'string'
                  ? firstAssistant.content
                  : undefined,
              }),
            });
            const { title } = await res.json() as { title: string };
            await saveTitle(currentId, title);
          } catch {}
        }
      }
    },
  });

  useEffect(() => {
    messagesRef.current = messages;
    if (pendingImagePreviewRef.current && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'user') {
        const preview = pendingImagePreviewRef.current;
        pendingImagePreviewRef.current = null;
        setMessageImages(prev => ({ ...prev, [last.id]: preview }));
      }
    }
  }, [messages]);

  // ── Theme ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const savedTheme = (localStorage.getItem('anime-gpt-theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // ── Suggestions (cached 24 h) ─────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const cached = localStorage.getItem(SUGGESTIONS_CACHE_KEY);
        if (cached) {
          const { suggestions: s, generatedAt } = JSON.parse(cached) as {
            suggestions: Array<{ title: string; prompt: string }>;
            generatedAt: number;
          };
          if (Date.now() - generatedAt < SUGGESTIONS_TTL) {
            setSuggestions(s);
            setSuggestionsLoading(false);
            return;
          }
        }
      } catch {}
      try {
        const res = await fetch('/api/suggestions');
        const data = await res.json() as {
          suggestions: Array<{ title: string; prompt: string }>;
          generatedAt: number;
        };
        setSuggestions(data.suggestions);
        localStorage.setItem(SUGGESTIONS_CACHE_KEY, JSON.stringify(data));
      } catch {}
      finally { setSuggestionsLoading(false); }
    };
    load();
  }, []);

  // ── Initial conversation load (after hook finishes loading) ───────────────

  useEffect(() => {
    if (loading) return;
    if (convId !== null) return; // already active — don't override
    if (conversations.length === 0) return;
    const latest = conversations[0]; // hook sorts by updatedAt desc
    convIdRef.current = latest.id;
    setConvId(latest.id);
    setMessages(latest.messages);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, conversations.length]);

  // ── Sign-in / sign-out transitions ────────────────────────────────────────

  useEffect(() => {
    const wasGuest = !prevLoggedInRef.current;
    const isNowLoggedIn = isLoggedIn;
    prevLoggedInRef.current = isLoggedIn;

    if (wasGuest && isNowLoggedIn) {
      // Migration runs inside useConversations when isLoggedIn flips.
      // Reset chat state so the UI starts fresh for the authenticated session.
      migrateLocalToCloud().then(() => {
        setMessages([]);
        setConvId(null);
        convIdRef.current = null;
        reset(); // clear usage counter
      });
    }

    if (!wasGuest && !isNowLoggedIn) {
      // Signed out — clear in-memory state immediately
      setMessages([]);
      setConvId(null);
      convIdRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('anime-gpt-theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const ensureConv = useCallback(async () => {
    if (!convIdRef.current) {
      const c = await createConversation();
      convIdRef.current = c.id;
      setConvId(c.id);
    }
  }, [createConversation]);

  const handleNew = async () => {
    const c = await createConversation();
    convIdRef.current = c.id;
    setConvId(c.id);
    setMessages([]);
    setSidebarOpen(false);
  };

  const handleSelect = (id: string) => {
    if (convIdRef.current && messagesRef.current.length > 0) {
      saveMessages(convIdRef.current, messagesRef.current as StoredMessage[]);
    }
    const found = conversations.find(c => c.id === id);
    if (found) {
      convIdRef.current = id;
      setActiveId(id);
      setConvId(id);
      setMessages(found.messages);
    }
    setSidebarOpen(false);
  };

  const handleDelete = async (id: string) => {
    // Compute next state from current in-memory list before the async delete
    const afterDelete = conversations.filter(c => c.id !== id);
    const switchingAway = id === convId;
    const nextConv = switchingAway ? (afterDelete[0] ?? null) : null;

    await deleteConversation(id, convId);

    if (switchingAway) {
      convIdRef.current = nextConv?.id ?? null;
      setConvId(nextConv?.id ?? null);
      setMessages(nextConv?.messages ?? []);
    }
  };

  const handleClearAll = async () => {
    await clearAll();
    convIdRef.current = null;
    setConvId(null);
    setMessages([]);
  };

  const handleSignOut = async () => {
    setMessages([]);
    setConvId(null);
    convIdRef.current = null;
    await signOut({ redirect: false });
  };

  // ── Mic ───────────────────────────────────────────────────────────────────

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
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
          const data = await res.json() as { text?: string };
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

  // ── Image / submit ────────────────────────────────────────────────────────

  const submitImageIdentify = async (imageData: { base64: string; mimeType: string; previewUrl: string }) => {
    await ensureConv();
    const messageId = crypto.randomUUID();

    if (isLoggedIn && convIdRef.current) {
      try {
        const byteString = atob(imageData.base64);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const file = new File([new Blob([ab], { type: imageData.mimeType })], `${messageId}.jpg`, { type: imageData.mimeType });
        const fd = new FormData();
        fd.append('image', file);
        fd.append('conversationId', convIdRef.current);
        fd.append('messageId', messageId);
        const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
        if (res.ok) {
          const { url } = await res.json() as { url: string };
          blobUrlsRef.current[messageId] = url;
        }
      } catch (err) {
        console.error('Image upload failed:', err);
      }
    }

    pendingImagePreviewRef.current = imageData.previewUrl;
    append(
      { id: messageId, role: 'user', content: '🔍 Identify this anime' },
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
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const imageData = {
        base64: result.split(',')[1],
        mimeType: file.type,
        previewUrl: result,
      };
      if (isFeatureModeRef.current) {
        isFeatureModeRef.current = false;
        submitImageIdentify(imageData);
      } else {
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
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10MB'); return; }
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

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;
    if (!input.trim() && !pendingImage) return;
    if (isAtLimit) return;

    if (!isLoggedIn) increment();

    if (pendingImage) {
      const snap = pendingImage;
      setPendingImage(null);
      if (!input.trim()) {
        await submitImageIdentify(snap);
      } else {
        await ensureConv();
        const messageId = crypto.randomUUID();
        if (isLoggedIn && convIdRef.current) {
          try {
            const byteString = atob(snap.base64);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const file = new File([new Blob([ab], { type: snap.mimeType })], `${messageId}.jpg`, { type: snap.mimeType });
            const fd = new FormData();
            fd.append('image', file);
            fd.append('conversationId', convIdRef.current);
            fd.append('messageId', messageId);
            const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
            if (res.ok) {
              const { url } = await res.json() as { url: string };
              blobUrlsRef.current[messageId] = url;
            }
          } catch (err) {
            console.error('Image upload failed:', err);
          }
        }
        pendingImagePreviewRef.current = snap.previewUrl;
        append(
          { id: messageId, role: 'user', content: input },
          { body: { imageBase64: snap.base64, mimeType: snap.mimeType } }
        );
        setInput('');
      }
      return;
    }

    await ensureConv();
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

  useEffect(() => {
    if (!input && inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Wrap append so prompt suggestions also ensure a conversation exists
  const handleSuggestionAppend = useCallback(async (
    message: Parameters<typeof append>[0],
    options?: Parameters<typeof append>[1]
  ) => {
    await ensureConv();
    return append(message, options);
  }, [ensureConv, append]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            {session ? (
              <UserMenu
                name={session.user?.name}
                email={session.user?.email}
                image={session.user?.image}
                onSignOut={handleSignOut}
              />
            ) : (
              <button
                className="signin-header-btn"
                onClick={() => signIn('google')}
                aria-label="Sign in"
              >
                <svg width="16" height="16" viewBox="0 0 48 48" style={{ marginRight: '6px' }}>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Sign in
              </button>
            )}
          </div>
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
                <Bubble key={index} message={message as StoredMessage} imagePreview={messageImages[message.id]} />
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
              onSubmit={handleSuggestionAppend}
              suggestions={suggestions}
              isLoading={suggestionsLoading}
            />
          </div>
        )}

        <footer className="input-footer">
          <div className="input-bar-wrapper">

            {showWarning && <UsageBanner remaining={remaining} />}

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
                disabled={isLoading || (!input.trim() && !pendingImage) || isAtLimit}
                aria-label="Send"
              >
                {isLoading ? <span className="loader" /> : <span className="send-icon">→</span>}
              </button>
            </form>
          </div>
        </footer>
      </div>

      {isAtLimit && <SignInModal />}
    </div>
  );
}
