import type { DiscoveryMedia, PublicPlaylistCard } from '../types';

async function request<T>(path: string, retries = 3, delayMs = 500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(path, { credentials: 'same-origin' });
      const payload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof payload === 'object' && payload !== null
          && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : `Request failed (${response.status})`;
        const error: any = new Error(message);
        error.status = response.status;
        throw error;
      }
      return payload as T;
    } catch (error: any) {
      lastError = error;
      const status = error?.status;
      if (status && status >= 400 && status < 500) {
        break;
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

export type TrendingFeed = {
  movies: DiscoveryMedia[];
  podcasts: DiscoveryMedia[];
  music: DiscoveryMedia[];
};

export type NewReleases = {
  movies: DiscoveryMedia[];
  podcasts: DiscoveryMedia[];
};

export async function getTrending(): Promise<TrendingFeed> {
  try {
    return await request<TrendingFeed>('/api/discover/trending');
  } catch {
    return { movies: [], podcasts: [], music: [] };
  }
}

export async function getNewReleases(): Promise<NewReleases> {
  try {
    return await request<NewReleases>('/api/discover/new-releases');
  } catch {
    return { movies: [], podcasts: [] };
  }
}

export async function getForYou(): Promise<TrendingFeed> {
  try {
    return await request<TrendingFeed>('/api/discover/for-you');
  } catch {
    return { movies: [], podcasts: [], music: [] };
  }
}

export async function getPublicPlaylists(): Promise<PublicPlaylistCard[]> {
  try {
    const response = await fetch('/api/discover/public-playlists?limit=8', { credentials: 'same-origin' });
    if (!response.ok) return [];
    const data = await response.json().catch(() => ({}));
    return data.playlists || data.items || [];
  } catch {
    return [];
  }
}

export async function getCommunityPlaylists(): Promise<PublicPlaylistCard[]> {
  return getPublicPlaylists();
}
