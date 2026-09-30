import type { JournalEntry, Mood } from '../data/types';

export type SavedJournalEntry = JournalEntry & { entryDate: string };

export type JournalStats = {
  entries: number;
  songs: number;
  averageRating: number;
  streakDays: number;
  moodCounts: Array<{ mood: Mood; count: number }>;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export async function fetchJournalEntries(mood?: Mood | 'all'): Promise<SavedJournalEntry[]> {
  const query = mood && mood !== 'all' ? `?mood=${encodeURIComponent(mood)}` : '';
  return (await request<{ entries: SavedJournalEntry[] }>(`/api/journal/entries${query}`)).entries;
}

export async function createJournalEntry(entry: Omit<SavedJournalEntry, 'id' | 'date' | 'entryDate'> & {
  entryDate: string;
}): Promise<SavedJournalEntry> {
  return (await request<{ entry: SavedJournalEntry }>('/api/journal/entries', {
    method: 'POST',
    body: JSON.stringify(entry),
  })).entry;
}

export async function fetchJournalStats(): Promise<JournalStats> {
  return request('/api/journal/stats');
}

