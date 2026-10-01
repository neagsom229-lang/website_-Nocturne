import type { Playlist, PlaylistItem } from '../types';

export type PlaylistPatch = Partial<Pick<Playlist, 'name' | 'description' | 'isPublic' | 'coverUrl'>>;

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

export async function createPlaylist(input: {
  name: string;
  description?: string;
  isPublic: boolean;
}): Promise<Playlist> {
  const result = await request<{ playlist: Playlist }>('/api/playlists', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? '',
      is_public: input.isPublic,
    }),
  });
  return result.playlist;
}

export async function getMyPlaylists(): Promise<Playlist[]> {
  const result = await request<{ playlists: Playlist[] }>('/api/playlists/mine');
  return result.playlists;
}

export async function getPublicPlaylists(options: {
  sort: 'recent' | 'popular';
  limit?: number;
  offset?: number;
}): Promise<Playlist[]> {
  const params = new URLSearchParams({ sort: options.sort });
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));
  const result = await request<{ playlists: Playlist[] }>(`/api/playlists/public?${params}`);
  return result.playlists;
}

export async function getPlaylist(id: number | string): Promise<{
  playlist: Playlist;
  items: PlaylistItem[];
}> {
  return request(`/api/playlists/${encodeURIComponent(id)}`);
}

export async function updatePlaylist(id: number | string, patch: PlaylistPatch): Promise<Playlist> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.isPublic !== undefined) body.is_public = patch.isPublic;
  if (patch.coverUrl !== undefined) body.cover_url = patch.coverUrl;
  const result = await request<{ playlist: Playlist }>(`/api/playlists/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return result.playlist;
}

export async function deletePlaylist(id: number | string): Promise<void> {
  await request(`/api/playlists/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function addItemToPlaylist(
  playlistId: number | string,
  mediaLibraryId: string,
): Promise<PlaylistItem> {
  const result = await request<{ item: PlaylistItem }>(
    `/api/playlists/${encodeURIComponent(playlistId)}/items`,
    { method: 'POST', body: JSON.stringify({ media_library_id: mediaLibraryId }) },
  );
  return result.item;
}

export async function removeItemFromPlaylist(
  playlistId: number | string,
  itemId: number | string,
): Promise<void> {
  await request(
    `/api/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' },
  );
}

export async function reorderPlaylistItems(
  playlistId: number | string,
  itemIds: number[],
): Promise<PlaylistItem[]> {
  const result = await request<{ items: PlaylistItem[] }>(
    `/api/playlists/${encodeURIComponent(playlistId)}/reorder`,
    { method: 'POST', body: JSON.stringify({ item_ids: itemIds }) },
  );
  return result.items;
}
