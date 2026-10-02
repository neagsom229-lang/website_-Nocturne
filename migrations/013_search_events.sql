-- Diagnostic query for search_cache constraints:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'search_cache'::regclass;
-- Actual constraint name found: search_cache_pkey (PRIMARY KEY (query, type))

ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS sort TEXT NOT NULL DEFAULT 'relevance';
ALTER TABLE search_cache DROP CONSTRAINT IF EXISTS search_cache_pkey;
ALTER TABLE search_cache ADD PRIMARY KEY (query, type, sort);

CREATE TABLE IF NOT EXISTS search_events (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  type TEXT NOT NULL,
  result_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_events_created_at_idx ON search_events(created_at DESC);
CREATE INDEX IF NOT EXISTS search_events_query_idx ON search_events(query);

-- Retention maintenance command (run manually as needed):
-- DELETE FROM search_events WHERE created_at < NOW() - INTERVAL '90 days';
