CREATE TABLE IF NOT EXISTS media_genres (
  media_library_id TEXT NOT NULL REFERENCES media_library(id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL,
  genre_name TEXT NOT NULL,
  PRIMARY KEY (media_library_id, genre_id)
);

CREATE INDEX IF NOT EXISTS media_genres_genre_id_idx
  ON media_genres (genre_id, media_library_id);
