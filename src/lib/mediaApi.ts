import type { DiscoveryMedia } from '../types';
import { saveMovie } from './moviesApi';

export type MediaType = 'video' | 'podcast' | 'audio' | 'video_podcast';
export type MediaProvider = 'youtube' | 'itunes' | 'tmdb' | 'omdb' | 'deezer' | 'audius';
export type LibraryMediaType = 'music' | 'podcast' | 'movie' | 'tv' | 'video_podcast';

export type MediaItem = {
  id?: string;
  type: 'video' | 'podcast' | 'audio';
  provider: MediaProvider;
  externalId: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  streamUrl: string;
  externalUrl: string | null;
  mediaType?: LibraryMediaType;
  durationSeconds?: number | null;
  createdAt?: string;
};

type VideoPodcastSearchResult = {
  id: string;
  title: string;
  channel: string;
  thumbnail_url: string | null;
  stream_url: string;
  duration_seconds: number | null;
  media_type: 'video_podcast';
  source: 'itunes';
  external_url: string | null;
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

export async function searchVideoPodcasts(query: string): Promise<{ items: MediaItem[]; hint?: string }> {
  const params = new URLSearchParams({ q: query });
  const response = await request<{ results: VideoPodcastSearchResult[]; hint?: string }>(
    `/api/podcasts/video-search?${params}`,
  );
  return {
    items: response.results.map((item) => ({
      type: 'video',
      provider: 'itunes',
      externalId: item.id,
      title: item.title,
      artist: item.channel,
      thumbnailUrl: item.thumbnail_url,
      streamUrl: item.stream_url,
      externalUrl: item.external_url,
      mediaType: item.media_type,
      durationSeconds: item.duration_seconds,
    })),
    hint: response.hint,
  };
}

export async function fetchMediaLibrary(): Promise<MediaItem[]> {
  const response = await request<{ items: MediaItem[] }>('/api/library');
  return response.items;
}

export async function saveMedia(item: MediaItem): Promise<{ item: MediaItem; alreadySaved: boolean }> {
  if (item.mediaType === 'video_podcast') {
    return saveVideoPodcast(item);
  }
  return request('/api/library/save', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

async function saveVideoPodcast(item: MediaItem): Promise<{ item: MediaItem; alreadySaved: boolean }> {
  return request('/api/podcasts/save-video', {
    method: 'POST',
    body: JSON.stringify({
      id: item.externalId,
      title: item.title,
      channel: item.artist,
      thumbnail_url: item.thumbnailUrl,
      stream_url: item.streamUrl,
      duration_seconds: item.durationSeconds,
      external_url: item.externalUrl,
    }),
  });
}

export async function deleteLibraryItem(id: string): Promise<void> {
  await request(`/api/library/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export type UnifiedSearchOptions = {
  q: string;
  type?: string;
  sort?: string;
  limit?: number;
  offset?: number;
};

export type UnifiedSearchResultItem = {
  id: string;
  title: string;
  subtitle: string | null;
  thumbnail_url: string | null;
  media_type: 'music' | 'podcast' | 'movie' | 'video_podcast';
  source: 'audius' | 'itunes' | 'tmdb' | 'youtube';
  stream_url: string | null;
  external_url: string | null;
  duration_seconds: number | null;
  release_year: number | null;
  rating: number | null;
  description: string | null;
};

export type UnifiedSearchResponse = {
  query: string;
  type: string;
  sort: string;
  results: UnifiedSearchResultItem[];
  total: number;
  limit: number;
  offset: number;
  sources: Record<string, { count: number; error: string | null }>;
};

export type SuggestionItem = {
  id: string;
  title: string;
  media_type: 'music' | 'podcast' | 'movie' | 'video_podcast';
  thumbnail_url: string | null;
  source: string;
};

export async function searchUnified(options: UnifiedSearchOptions): Promise<UnifiedSearchResponse> {
  const params = new URLSearchParams();
  params.set('q', options.q);
  if (options.type) params.set('type', options.type);
  if (options.sort) params.set('sort', options.sort);
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));
  return request<UnifiedSearchResponse>(`/api/search/unified?${params}`);
}

export async function searchSuggest(query: string): Promise<SuggestionItem[]> {
  const params = new URLSearchParams({ q: query });
  const response = await request<{ suggestions: SuggestionItem[] }>(`/api/search/suggest?${params}`);
  return response.suggestions;
}

export async function saveDiscoveryMedia(media: DiscoveryMedia): Promise<string> {
  if (media.source === 'tmdb') return saveMovie(Number(media.id));
  const provider = media.source;
  const type = media.media_type === 'podcast' ? 'podcast' : 'audio';
  const result = await saveMedia({
    type,
    provider,
    externalId: media.id,
    title: media.title,
    artist: media.artist ?? media.channel ?? null,
    thumbnailUrl: media.thumbnail_url,
    streamUrl: media.stream_url ?? '',
    externalUrl: media.external_url ?? null,
    mediaType: media.media_type === 'video' ? 'video_podcast' : media.media_type,
  });
  if (!result.item.id) throw new Error('The item was saved, but its library ID was not returned.');
  return result.item.id;
}
