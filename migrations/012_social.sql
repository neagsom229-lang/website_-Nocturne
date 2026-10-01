ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE users
  ALTER COLUMN is_public SET DEFAULT false;

UPDATE users SET is_public = false;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_display_name_length_check,
  ADD CONSTRAINT users_display_name_length_check
    CHECK (length(display_name) <= 60) NOT VALID,
  DROP CONSTRAINT IF EXISTS users_bio_length_check,
  ADD CONSTRAINT users_bio_length_check
    CHECK (bio IS NULL OR length(bio) <= 280) NOT VALID;

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);

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
