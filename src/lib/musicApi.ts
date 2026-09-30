import type { Mix, Track } from '../data/types';

export type NowPlaying = {
  mix: Pick<Mix, 'id' | 'title' | 'note' | 'cover'>;
  track: Track;
  isPlaying: boolean;
  progressSeconds: number;
};

export type MixSwipe = {
  mixId: string;
  action: 'like' | 'pass';
  createdAt: string;
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

export async function fetchMixes(): Promise<Mix[]> {
  const response = await request<{ mixes: Mix[] }>('/api/music/mixes');
  return response.mixes;
}

export async function fetchNowPlaying(): Promise<NowPlaying> {
  const response = await request<{ nowPlaying: NowPlaying }>('/api/music/now-playing');
  return response.nowPlaying;
}

export async function updateNowPlaying(
  mix: Mix,
  track: Track,
  isPlaying: boolean,
  progressSeconds = 0,
): Promise<NowPlaying> {
  const response = await request<{ nowPlaying: NowPlaying }>('/api/music/now-playing', {
    method: 'PUT',
    body: JSON.stringify({ mixId: mix.id, trackId: track.id, isPlaying, progressSeconds }),
  });
  return response.nowPlaying;
}

export async function fetchSwipes(): Promise<MixSwipe[]> {
  const response = await request<{ swipes: MixSwipe[] }>('/api/music/swipes');
  return response.swipes;
}

export async function saveSwipe(mixId: string, action: MixSwipe['action']): Promise<void> {
  await request<{ mixId: string; action: MixSwipe['action'] }>('/api/music/swipes', {
    method: 'POST',
    body: JSON.stringify({ mixId, action }),
  });
}
