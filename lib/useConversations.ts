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

const KEY = 'animegpt-conversations';

export function readStorage(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeStorage(list: Conversation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const saved = readStorage().sort((a, b) => b.updatedAt - a.updatedAt);
    setConversations(saved);
    if (saved.length > 0) setActiveId(saved[0].id);
  }, []);

  const persist = useCallback((list: Conversation[]) => {
    const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
    writeStorage(sorted);
    setConversations(sorted);
  }, []);

  const createConversation = useCallback((): Conversation => {
    const c: Conversation = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const fresh = readStorage();
    persist([c, ...fresh]);
    setActiveId(c.id);
    return c;
  }, [persist]);

  const saveMessages = useCallback((id: string, messages: Message[]) => {
    if (!id) return;
    const fresh = readStorage();
    const updated = fresh.map(c =>
      c.id === id ? { ...c, messages, updatedAt: Date.now() } : c
    );
    persist(updated);
  }, [persist]);

  const saveTitle = useCallback((id: string, title: string) => {
    const fresh = readStorage();
    const updated = fresh.map(c =>
      c.id === id ? { ...c, title } : c
    );
    persist(updated);
  }, [persist]);

  const deleteConversation = useCallback((id: string, currentActiveId: string | null): string | null => {
    const filtered = readStorage().filter(c => c.id !== id);
    persist(filtered);
    if (id === currentActiveId) {
      const next = filtered[0]?.id ?? null;
      setActiveId(next);
      return next;
    }
    return currentActiveId;
  }, [persist]);

  const clearAll = useCallback(() => {
    writeStorage([]);
    setConversations([]);
    setActiveId(null);
  }, []);

  return {
    conversations,
    activeId,
    setActiveId,
    createConversation,
    saveMessages,
    saveTitle,
    deleteConversation,
    clearAll,
  };
}
