'use client';
import { useState, useEffect } from 'react';

const KEY = 'animegpt-usage-count';
const FREE_LIMIT = 5;
const WARN_AT = 3;

export function useUsageCounter(isLoggedIn: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (isLoggedIn) return;
    const stored = parseInt(localStorage.getItem(KEY) || '0', 5);
    setCount(stored);
  }, [isLoggedIn]);

  const increment = () => {
    if (isLoggedIn) return;
    const next = count + 1;
    setCount(next);
    localStorage.setItem(KEY, next.toString());
  };

  const reset = () => {
    localStorage.removeItem(KEY);
    setCount(0);
  };

  return {
    count,
    increment,
    reset,
    isAtLimit: !isLoggedIn && count >= FREE_LIMIT,
    showWarning: !isLoggedIn && count >= WARN_AT && count < FREE_LIMIT,
    remaining: Math.max(0, FREE_LIMIT - count),
  };
}
