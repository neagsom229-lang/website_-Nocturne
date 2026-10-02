import type { DiscoveryMedia, PublicPlaylistCard } from '../types';

async function request<T>(path: string, retries = 3, delayMs = 500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(path);
      const payload: unknown = await response.json();
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
  return request('/api/discover/trending');
}

export async function getNewReleases(): Promise<NewReleases> {
  return request('/api/discover/new-releases');
}

export async function getForYou(): Promise<TrendingFeed> {
  return request('/api/discover/for-you');
}

export async function getCommunityPlaylists(): Promise<PublicPlaylistCard[]> {
  const response = await request<{ playlists: PublicPlaylistCard[] }>('/api/discover/public-playlists?limit=8');
  return response.playlists;
}
