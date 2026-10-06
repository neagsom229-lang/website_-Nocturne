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
        const error = new Error(message) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      return payload as T;
    } catch (error: unknown) {
      lastError = error;
      const status = (error as { status?: number })?.status;
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
  music: DiscoveryMedia[];
};

export type ForYouFeed = {
  movies: DiscoveryMedia[];
  podcasts: DiscoveryMedia[];
  music: DiscoveryMedia[];
  topGenres: { id: number; name: string; count: number }[];
  fallback: string | null;
};

export async function getTrendingFeed(): Promise<TrendingFeed> {
  return request<TrendingFeed>('/api/discover/trending');
}

export async function getNewReleases(): Promise<NewReleases> {
  return request<NewReleases>('/api/discover/new-releases');
}

export async function getForYouFeed(): Promise<ForYouFeed> {
  return request<ForYouFeed>('/api/discover/for-you');
}

export async function getPublicPlaylists(): Promise<{ playlists: PublicPlaylistCard[] }> {
  return request<{ playlists: PublicPlaylistCard[] }>('/api/discover/public-playlists');
}

export async function getCommunityPlaylists(): Promise<PublicPlaylistCard[]> {
  const res = await request<{ playlists: PublicPlaylistCard[] }>('/api/discover/public-playlists');
  return res.playlists || [];
}

export const getTrending = getTrendingFeed;
export const getForYou = getForYouFeed;
