export type Playlist = {
  id: number;
  userId?: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
  ownerDisplayName?: string;
};

export type PlaylistItem = {
  id: number;
  mediaLibraryId: string;
  position: number;
  addedAt: string;
  provider?: 'youtube' | 'itunes' | 'tmdb' | 'omdb' | 'deezer' | 'audius';
  externalId?: string;
  externalUrl?: string | null;
  trailerUrl?: string | null;
  type: 'video' | 'podcast' | 'audio';
  mediaType: 'music' | 'podcast' | 'movie' | 'tv' | 'video_podcast' | null;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  streamUrl: string;
  durationSeconds: number | null;
};

export type DiscoveryMedia = {
  id: string;
  title: string;
  description?: string | null;
  thumbnail_url: string | null;
  media_type: 'movie' | 'podcast' | 'music' | 'video' | 'tv' | 'audiobook' | 'video_podcast';
  source: 'tmdb' | 'itunes' | 'audius' | 'youtube' | 'omdb' | 'deezer' | 'librivox';
  stream_url?: string | null;
  external_url?: string | null;
  channel?: string | null;
  artist?: string | null;
  release_year?: string | number | null;
  release_date?: string | null;
  rating?: number | null;
  duration_seconds?: number | null;
  isPlayable?: boolean;
  trailer_url?: string | null;
};

export type PublicPlaylistCard = {
  id: number;
  name: string;
  description: string | null;
  coverUrl: string | null;
  itemCount: number;
  ownerDisplayName: string;
};
