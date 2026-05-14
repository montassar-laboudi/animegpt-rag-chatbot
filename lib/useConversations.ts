'use client';
import { useState, useEffect, useCallback } from 'react';
import { Message } from 'ai';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const LOCAL_KEY = 'animegpt-conversations';

// ── localStorage helpers (guest track only) ──────────────────────────────────

export function readStorage(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  } catch { return []; }
}

function localWrite(list: Conversation[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch {}
}

function localClear() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_KEY);
}

// ── AstraDB helpers ──────────────────────────────────────────────────────────

interface CloudConv {
  _id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

function fromCloud(doc: CloudConv): Conversation {
  return {
    id: doc._id,
    title: doc.title,
    messages: doc.messages ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useConversations(isLoggedIn: boolean) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load conversations — on auth state change, migrate local → cloud then fetch
  useEffect(() => {
    setLoading(true);

    if (!isLoggedIn) {
      // Guest: read localStorage synchronously
      const saved = readStorage().sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(saved);
      setActiveId(saved[0]?.id ?? null);
      setLoading(false);
      return;
    }

    // Signed in: migrate any pending local conversations, then load from AstraDB
    const run = async () => {
      const local = readStorage();
      if (local.length > 0) {
        await Promise.all(
          local.map(conv =>
            fetch('/api/conversations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: conv.title, messages: conv.messages }),
            })
          )
        );
        localClear();
      }

      const res = await fetch('/api/conversations');
      const data = await res.json() as { conversations: CloudConv[] };
      const convs = (data.conversations ?? []).map(fromCloud);
      setConversations(convs);
      setActiveId(convs[0]?.id ?? null);
    };

    run()
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, [isLoggedIn]);

  // ── Create ───────────────────────────────────────────────────────────────

  const createConversation = useCallback(async (): Promise<Conversation> => {
    if (isLoggedIn) {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat', messages: [] }),
      });
      const { conversation: doc } = await res.json() as { conversation: CloudConv };
      const conv = fromCloud(doc);
      setConversations(prev => [conv, ...prev]);
      setActiveId(conv.id);
      return conv;
    }

    const conv: Conversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [conv, ...readStorage()];
    localWrite(updated);
    setConversations(updated);
    setActiveId(conv.id);
    return conv;
  }, [isLoggedIn]);

  // ── Save messages ─────────────────────────────────────────────────────────

  const saveMessages = useCallback(async (id: string, messages: Message[]) => {
    if (!id) return;
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, messages, updatedAt: Date.now() } : c)
    );

    if (isLoggedIn) {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
    } else {
      const all = readStorage().map(c =>
        c.id === id ? { ...c, messages, updatedAt: Date.now() } : c
      );
      localWrite(all);
    }
  }, [isLoggedIn]);

  // ── Save title ────────────────────────────────────────────────────────────

  const saveTitle = useCallback(async (id: string, title: string) => {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, title } : c)
    );

    if (isLoggedIn) {
      await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
    } else {
      const all = readStorage().map(c =>
        c.id === id ? { ...c, title } : c
      );
      localWrite(all);
    }
  }, [isLoggedIn]);

  // ── Delete one ────────────────────────────────────────────────────────────

  const deleteConversation = useCallback(async (
    id: string,
    currentId: string | null
  ): Promise<string | null> => {
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);

    if (isLoggedIn) {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    } else {
      localWrite(remaining);
    }

    if (id === currentId) {
      const next = remaining[0]?.id ?? null;
      setActiveId(next);
      return next;
    }
    return currentId;
  }, [conversations, isLoggedIn]);

  // ── Clear all ─────────────────────────────────────────────────────────────

  const clearAll = useCallback(async () => {
    setConversations([]);
    setActiveId(null);

    if (isLoggedIn) {
      await fetch('/api/conversations', { method: 'DELETE' });
    } else {
      localClear();
    }
  }, [isLoggedIn]);

  // ── Exposed no-op — migration now happens inside the isLoggedIn effect ────

  const migrateLocalToCloud = useCallback(async () => {}, []);

  return {
    conversations,
    activeId,
    setActiveId,
    loading,
    createConversation,
    saveMessages,
    saveTitle,
    deleteConversation,
    clearAll,
    migrateLocalToCloud,
  };
}
