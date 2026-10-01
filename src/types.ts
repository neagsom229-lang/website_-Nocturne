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
