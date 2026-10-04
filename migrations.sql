CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  bio TEXT CHECK (bio IS NULL OR length(bio) <= 280),
  avatar_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  welcomed_at TIMESTAMPTZ,
  deletion_scheduled_for TIMESTAMPTZ,
  email TEXT UNIQUE,
  password_hash TEXT,
  supabase_uid TEXT UNIQUE,
  email_verified BOOLEAN DEFAULT false,
  legacy_auth BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_display_name_length_check CHECK (length(display_name) <= 60)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_case_insensitive
  ON users (LOWER(email)) WHERE email IS NOT NULL;

-- Backfill email_verified for legacy users
UPDATE users
SET email_verified = true
WHERE password_hash IS NOT NULL
  AND deleted_at IS NULL
  AND email_verified = false;

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS music_mixes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  note TEXT NOT NULL,
  cover TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS music_tracks (
  id TEXT PRIMARY KEY,
  mix_id TEXT NOT NULL REFERENCES music_mixes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  cover TEXT NOT NULL,
  UNIQUE (mix_id, position)
);

CREATE TABLE IF NOT EXISTS now_playing_states (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mix_id TEXT NOT NULL REFERENCES music_mixes(id),
  track_id TEXT NOT NULL REFERENCES music_tracks(id),
  is_playing BOOLEAN NOT NULL DEFAULT FALSE,
  progress_seconds INTEGER NOT NULL DEFAULT 0 CHECK (progress_seconds >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mix_swipes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mix_id TEXT NOT NULL REFERENCES music_mixes(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, mix_id)
);

CREATE TABLE IF NOT EXISTS podcast_shows (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  host TEXT NOT NULL,
  blurb TEXT NOT NULL,
  art TEXT NOT NULL,
  cadence TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS podcast_episodes (
  id TEXT PRIMARY KEY,
  show_id TEXT NOT NULL REFERENCES podcast_shows(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  published TEXT NOT NULL,
  season INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  audio_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS podcast_listen_later (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES podcast_episodes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, episode_id)
);

CREATE TABLE IF NOT EXISTS podcast_player_states (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES podcast_episodes(id),
  is_playing BOOLEAN NOT NULL DEFAULT FALSE,
  progress_seconds INTEGER NOT NULL DEFAULT 0 CHECK (progress_seconds >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_library (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('video', 'podcast', 'audio')),
  provider TEXT NOT NULL CHECK (provider IN ('youtube', 'itunes', 'tmdb', 'omdb', 'deezer', 'audius')),
  external_id TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('music', 'podcast', 'movie', 'tv', 'video_podcast')),
  external_source TEXT CHECK (external_source IN ('tmdb', 'omdb', 'itunes', 'deezer')),
  title TEXT NOT NULL,
  artist TEXT,
  thumbnail_url TEXT,
  stream_url TEXT NOT NULL,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  release_year INTEGER,
  rating NUMERIC,
  description TEXT,
  trailer_url TEXT,
  external_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider, external_id)
);

CREATE INDEX IF NOT EXISTS media_library_user_created
  ON media_library (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_library_id TEXT NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, media_library_id)
);
CREATE INDEX IF NOT EXISTS likes_media_idx ON likes(media_library_id);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_library_id TEXT NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_media_idx ON comments(media_library_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_user_idx ON comments(user_id);

CREATE TABLE IF NOT EXISTS media_genres (
  media_library_id TEXT NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL,
  genre_name TEXT NOT NULL,
  PRIMARY KEY (media_library_id, genre_id)
);

CREATE INDEX IF NOT EXISTS media_genres_genre_id_idx
  ON media_genres (genre_id, media_library_id);

CREATE TABLE IF NOT EXISTS playlists (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  description TEXT CHECK (length(description) <= 500),
  is_public BOOLEAN NOT NULL DEFAULT false,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playlists_user_id_idx ON playlists(user_id);
CREATE INDEX IF NOT EXISTS playlists_public_idx ON playlists(is_public) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS playlist_items (
  id SERIAL PRIMARY KEY,
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  media_library_id TEXT NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (playlist_id, media_library_id)
);

CREATE INDEX IF NOT EXISTS playlist_items_playlist_id_idx ON playlist_items (playlist_id, position);

CREATE TABLE IF NOT EXISTS search_cache (
  query TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('video', 'podcast', 'audio', 'movie', 'music', 'video_podcast', 'all', 'suggest')),
  sort TEXT NOT NULL DEFAULT 'relevance',
  response_json TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (query, type, sort)
);

CREATE TABLE IF NOT EXISTS random_music_cache (
  genre TEXT PRIMARY KEY,
  track_json TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  human_date TEXT NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('tender', 'restless', 'quiet', 'hopeful', 'wrecked')),
  song TEXT NOT NULL,
  artist TEXT NOT NULL,
  note TEXT NOT NULL,
  photo TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, entry_date)
);

CREATE TABLE IF NOT EXISTS dating_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 18),
  distance_km INTEGER NOT NULL CHECK (distance_km >= 0),
  headline TEXT NOT NULL,
  bio TEXT NOT NULL,
  interests_json TEXT NOT NULL DEFAULT '[]',
  song TEXT NOT NULL,
  prompt_question TEXT NOT NULL,
  prompt_answer TEXT NOT NULL,
  photo TEXT NOT NULL,
  last_active TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS dating_user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 18),
  headline TEXT NOT NULL,
  bio TEXT NOT NULL,
  song TEXT NOT NULL,
  interests_json TEXT NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dating_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  answers_json TEXT NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dating_swipes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES dating_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, profile_id)
);

CREATE TABLE IF NOT EXISTS dating_matches (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES dating_profiles(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, profile_id)
);

CREATE TABLE IF NOT EXISTS dating_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES dating_profiles(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('me', 'them')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sort_order INTEGER NOT NULL DEFAULT 0
);
