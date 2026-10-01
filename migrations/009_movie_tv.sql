ALTER TABLE media_library
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT,
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS release_year INTEGER,
  ADD COLUMN IF NOT EXISTS rating NUMERIC,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS trailer_url TEXT,
  ADD COLUMN IF NOT EXISTS stream_url TEXT;

ALTER TABLE media_library
  DROP CONSTRAINT IF EXISTS media_library_media_type_check,
  ADD CONSTRAINT media_library_media_type_check
    CHECK (media_type IS NULL OR media_type IN ('music', 'podcast', 'movie', 'tv', 'video_podcast')),
  DROP CONSTRAINT IF EXISTS media_library_external_source_check,
  ADD CONSTRAINT media_library_external_source_check
    CHECK (external_source IS NULL OR external_source IN ('tmdb', 'omdb', 'itunes', 'deezer')),
  DROP CONSTRAINT IF EXISTS media_library_duration_seconds_check,
  ADD CONSTRAINT media_library_duration_seconds_check
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  DROP CONSTRAINT IF EXISTS media_library_provider_check,
  ADD CONSTRAINT media_library_provider_check
    CHECK (provider IN ('youtube', 'itunes', 'tmdb', 'omdb', 'deezer'));

ALTER TABLE search_cache
  DROP CONSTRAINT IF EXISTS search_cache_type_check,
  ADD CONSTRAINT search_cache_type_check
    CHECK (type IN ('video', 'podcast', 'audio', 'movie', 'music', 'video_podcast'));
