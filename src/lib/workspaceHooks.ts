import { createContext, useContext } from 'react';
import type { Mix, Track } from '../data/types';
import type { NowPlaying } from './musicApi';

export type ExternalMedia = {
  id?: string;
  type: 'video' | 'podcast' | 'audio';
  provider: 'youtube' | 'itunes' | 'soundcloud' | 'audius' | 'tmdb' | 'omdb' | 'deezer' | 'librivox';
  mediaType?: 'music' | 'podcast' | 'movie' | 'tv' | 'video_podcast' | 'audiobook' | 'video';
  externalId: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  streamUrl: string;
  externalUrl: string | null;
  createdAt?: string;
};

export type WorkspacePlayer = {
  mixes: Mix[];
  nowPlaying: NowPlaying | null;
  externalMedia: ExternalMedia | null;
  externalQueue: ExternalMedia[];
  externalQueueIndex: number;
  externalPlaying: boolean;
  buffering: boolean;
  progress: number;
  duration: number;
  error: string;
  volume: number;
  updateProgress: (seconds: number) => void;
  setDuration: (seconds: number) => void;
  setError: (message: string) => void;
  setExternalPlaying: (playing: boolean) => void;
  selectTrack: (mix: Mix, track: Track) => Promise<void>;
  playExternalMedia: (media: ExternalMedia) => void;
  playExternalQueue: (media: ExternalMedia[]) => void;
  ensureExternalMediaSaved: () => Promise<string>;
  toggle: () => Promise<void>;
  skip: (direction: -1 | 1) => Promise<void>;
  seek: (seconds: number) => void;
  persistSeek: () => Promise<void>;
  setVolume: (value: number) => void;
};

export const PlayerContext = createContext<WorkspacePlayer | null>(null);

export function useWorkspacePlayer() {
  const player = useContext(PlayerContext);
  if (!player) throw new Error('useWorkspacePlayer must be used inside WorkspaceShell');
  return player;
}

export function useOptionalWorkspacePlayer() {
  return useContext(PlayerContext);
}
