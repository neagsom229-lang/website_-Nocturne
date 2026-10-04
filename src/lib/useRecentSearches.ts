import { useState, useCallback } from 'react';

const STORAGE_KEY = 'nocturne.recent-searches';

export function useRecentSearches() {
  const [recents, setRecents] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });

  const addRecent = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    setRecents((current) => {
      const filtered = current.filter((item) => item.toLowerCase() !== q.toLowerCase());
      const next = [q, ...filtered].slice(0, 5);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeRecent = useCallback((query: string) => {
    setRecents((current) => {
      const next = current.filter((item) => item !== query);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecents = useCallback(() => {
    setRecents([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { recents, addRecent, removeRecent, clearRecents };
}
