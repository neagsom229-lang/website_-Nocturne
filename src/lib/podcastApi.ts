import type { Episode, Show } from '../data/types';

export type PodcastEpisode = Episode & {
  audioUrl: string;
  showTitle: string;
  showHost: string;
  showArt: string;
  isSaved: boolean;
};

export type PodcastShow = Show & { episodeCount: number };

export type PodcastPlayerState = {
  episodeId: string;
  isPlaying: boolean;
  progressSeconds: number;
  episode: PodcastEpisode;
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

export async function fetchPodcastShows(): Promise<PodcastShow[]> {
  return (await request<{ shows: PodcastShow[] }>('/api/podcasts/shows')).shows;
}

export async function fetchPodcastShow(showId: string): Promise<{ show: PodcastShow; episodes: PodcastEpisode[] }> {
  return request(`/api/podcasts/shows/${encodeURIComponent(showId)}`);
}

export async function fetchPodcastEpisodes(showId?: string): Promise<PodcastEpisode[]> {
  const query = showId ? `?showId=${encodeURIComponent(showId)}` : '';
  return (await request<{ episodes: PodcastEpisode[] }>(`/api/podcasts/episodes${query}`)).episodes;
}

export async function fetchPodcastEpisode(episodeId: string): Promise<PodcastEpisode> {
  return (await request<{ episode: PodcastEpisode }>(`/api/podcasts/episodes/${encodeURIComponent(episodeId)}`)).episode;
}

export async function fetchListenLater(): Promise<PodcastEpisode[]> {
  return (await request<{ episodes: PodcastEpisode[] }>('/api/podcasts/listen-later')).episodes;
}

export async function savePodcastEpisode(episodeId: string): Promise<void> {
  await request('/api/podcasts/listen-later', {
    method: 'POST',
    body: JSON.stringify({ episodeId }),
  });
}

export async function removePodcastEpisode(episodeId: string): Promise<void> {
  await request(`/api/podcasts/listen-later/${encodeURIComponent(episodeId)}`, { method: 'DELETE' });
}

export async function fetchPodcastPlayer(): Promise<PodcastPlayerState> {
  return (await request<{ nowPlaying: PodcastPlayerState }>('/api/podcasts/now-playing')).nowPlaying;
}

export async function updatePodcastPlayer(
  episodeId: string,
  isPlaying: boolean,
  progressSeconds = 0,
): Promise<PodcastPlayerState> {
  return (await request<{ nowPlaying: PodcastPlayerState }>('/api/podcasts/now-playing', {
    method: 'PUT',
    body: JSON.stringify({ episodeId, isPlaying, progressSeconds }),
  })).nowPlaying;
}

