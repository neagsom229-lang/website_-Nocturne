export type MediaType = 'video' | 'podcast' | 'audio';
export type MediaProvider = 'youtube' | 'itunes';

export type MediaItem = {
  id?: string;
  type: MediaType;
  provider: MediaProvider;
  externalId: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  streamUrl: string;
  externalUrl: string | null;
  createdAt?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export async function searchMedia(query: string, type: MediaType): Promise<MediaItem[]> {
  const params = new URLSearchParams({ q: query, type });
  const response = await request<{ results: MediaItem[] }>(`/api/search?${params}`);
  return response.results;
}

export async function fetchMediaLibrary(): Promise<MediaItem[]> {
  const response = await request<{ items: MediaItem[] }>('/api/library');
  return response.items;
}

export async function saveMedia(item: MediaItem): Promise<{ item: MediaItem; alreadySaved: boolean }> {
  return request('/api/library/save', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function deleteLibraryItem(id: string): Promise<void> {
  await request(`/api/library/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
