import type { DiscoveryMedia, PublicPlaylistCard } from '../types';

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null
      && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
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
