-- Migration 014: Allow 'all' and 'suggest' types in search_cache check constraint
ALTER TABLE search_cache DROP CONSTRAINT IF EXISTS search_cache_type_check;
ALTER TABLE search_cache ADD CONSTRAINT search_cache_type_check
  CHECK (type IN ('video', 'podcast', 'audio', 'movie', 'music', 'video_podcast', 'all', 'suggest'));
