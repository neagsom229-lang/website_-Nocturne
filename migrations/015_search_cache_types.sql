-- Migration 015: Expand search_cache type constraint for full provider coverage
ALTER TABLE search_cache DROP CONSTRAINT IF EXISTS search_cache_type_check;
ALTER TABLE search_cache ADD CONSTRAINT search_cache_type_check
  CHECK (type IN ('video', 'podcast', 'audio', 'movie', 'music', 'video_podcast', 'tv', 'audiobook', 'youtube', 'deezer', 'librivox', 'all', 'suggest'));
