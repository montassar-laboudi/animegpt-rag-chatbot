'use client';
import { useState, useCallback } from 'react';

const KEY = 'animegpt-profile';

interface ProfileOverride {
  name?: string;
  image?: string;
}

function readStorage(): ProfileOverride {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writeStorage(data: ProfileOverride): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
}

export function useProfile(sessionName?: string | null, sessionImage?: string | null) {
  const [override, setOverride] = useState<ProfileOverride>(() => readStorage());

  const displayName = override.name ?? sessionName ?? 'User';
  const displayImage = override.image ?? sessionImage ?? null;

  const save = useCallback((updates: Partial<ProfileOverride>) => {
    const current = readStorage();
    const next = { ...current, ...updates };
    writeStorage(next);
    setOverride(next);
  }, []);

  const clear = useCallback(() => {
    writeStorage({});
    setOverride({});
  }, []);

  return { displayName, displayImage, save, clear };
}
