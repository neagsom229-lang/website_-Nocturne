import { Router } from 'express';
import { searchMovies, normalizeMovie } from '../services/movieSearch.js';
import { searchExternalMedia, normalizeVideoPodcastResults } from '../mediaSearch.js';
import { recordCacheWriteFailure } from '../services/cacheMetrics.js';

const CACHE_TTL = "INTERVAL '1 hour'";
const SUGGEST_CACHE_TTL = "INTERVAL '10 minutes'";
const APP_NAME = 'Nocturne';
const AUDIUS_API = 'https://discoveryprovider.audius.co/v1';

// Sliding window rate limiter for search analytics: max 60 inserts per minute across all users
let analyticsTimestamps = [];
function shouldLogAnalytics() {
  const now = Date.now();
  const windowStart = now - 60000;
  analyticsTimestamps = analyticsTimestamps.filter((t) => t > windowStart);
  if (analyticsTimestamps.length >= 60) return false;
  analyticsTimestamps.push(now);
  return true;
}

async function fetchJsonWithTimeout(url, provider, fetchImpl = fetch, timeoutMs = 3000) {
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`${provider}_rejected_${response.status}`);
    return await response.json();
  } catch (error) {
    throw new Error(`${provider}_unavailable: ${error.message}`);
  }
}

// Audius endpoint matching working service: https://discoveryprovider.audius.co/v1/tracks/search
async function fetchAudius(query, fetchImpl = fetch) {
  const url = new URL(`${AUDIUS_API}/tracks/search`);
  url.search = new URLSearchParams({ app_name: APP_NAME, query, limit: '20' });
  const data = await fetchJsonWithTimeout(url, 'audius', fetchImpl);
  if (!Array.isArray(data?.data)) return [];
  return data.data.flatMap((track) => {
    if (typeof track.id !== 'string' || typeof track.title !== 'string') return [];
    return [{
      id: track.id,
      title: track.title,
      subtitle: track.user?.name ?? 'Unknown artist',
      thumbnail_url: track.artwork?.['480x480'] ?? track.artwork?.['150x150'] ?? null,
      media_type: 'music',
      source: 'audius',
      stream_url: `${AUDIUS_API}/tracks/${encodeURIComponent(track.id)}/stream?app_name=${APP_NAME}`,
      external_url: track.permalink ? `https://audius.co${track.permalink}` : null,
      duration_seconds: Number.isFinite(track.duration) ? track.duration : null,
      release_year: null,
      rating: Number.isFinite(track.play_count) ? track.play_count : null,
      description: null,
    }];
  });
}

async function fetchITunesPodcasts(query, fetchImpl = fetch) {
  const url = new URL('https://itunes.apple.com/search');
  url.search = new URLSearchParams({
    term: query,
    entity: 'podcastEpisode',
    media: 'podcast',
    limit: '20',
  });
  const data = await fetchJsonWithTimeout(url, 'itunes', fetchImpl);
  if (!Array.isArray(data?.results)) return [];
  return data.results.flatMap((item) => {
    const id = item.trackId;
    const title = item.trackName;
    if (id === undefined || typeof title !== 'string') return [];
    const streamUrl = item.episodeUrl ?? item.previewUrl ?? null;
    return [{
      id: String(id),
      title,
      subtitle: item.artistName ?? 'Unknown podcast',
      thumbnail_url: item.artworkUrl600 ?? item.artworkUrl100 ?? null,
      media_type: 'podcast',
      source: 'itunes',
      stream_url: streamUrl,
      external_url: item.trackViewUrl ?? item.collectionViewUrl ?? null,
      duration_seconds: Number.isFinite(item.trackTimeMillis) ? Math.round(item.trackTimeMillis / 1000) : null,
      release_year: item.releaseDate ? new Date(item.releaseDate).getFullYear() : null,
      rating: null,
      description: item.description ?? null,
    }];
  });
}

async function fetchTmdbMovies(query) {
  const result = await searchMovies(query);
  if (!Array.isArray(result?.results)) return [];
  return result.results.map((movie) => {
    const normalized = normalizeMovie(movie);
    return {
      id: String(normalized.tmdb_id),
      title: normalized.title,
      subtitle: normalized.year ? String(normalized.year) : 'Movie',
      thumbnail_url: normalized.poster_url,
      media_type: 'movie',
      source: 'tmdb',
      stream_url: null,
      external_url: `https://www.themoviedb.org/movie/${normalized.tmdb_id}`,
      duration_seconds: null,
      release_year: normalized.year ? Number(normalized.year) : null,
      rating: normalized.rating,
      description: normalized.overview,
    };
  });
}

/**
 * YouTube Quota Strategy:
 * YouTube fires ONLY when type === 'video_podcast' (explicit user intent).
 * For type === 'all', do NOT call YouTube. Video results appear only when the user selects the Video tab.
 * This is predictable and quota-safe.
 */
async function fetchVideoPodcasts(query, type, fetchImpl = fetch) {
  const itunesPromise = fetchJsonWithTimeout(
    new URL(`https://itunes.apple.com/search?${new URLSearchParams({ term: query, entity: 'podcastEpisode', media: 'podcast', limit: '20' })}`),
    'itunes',
    fetchImpl,
  ).then((data) => normalizeVideoPodcastResults(data.results)).catch(() => []);

  const shouldQueryYouTube = type === 'video_podcast';
  const ytPromise = shouldQueryYouTube
    ? searchExternalMedia(`${query} podcast video`, 'video', {
        apiKey: process.env.YOUTUBE_API_KEY,
        fetchImpl,
      }).catch(() => [])
    : Promise.resolve([]);

  const [itunesRes, ytRes] = await Promise.all([itunesPromise, ytPromise]);

  const mappedItunes = itunesRes.map((item) => ({
    id: item.id,
    title: item.title,
    subtitle: item.channel,
    thumbnail_url: item.thumbnail_url,
    media_type: 'video_podcast',
    source: 'itunes',
    stream_url: item.stream_url,
    external_url: item.external_url,
    duration_seconds: item.duration_seconds,
    release_year: null,
    rating: null,
    description: null,
  }));

  const mappedYt = ytRes.map((item) => ({
    id: item.externalId,
    title: item.title,
    subtitle: item.artist ?? 'YouTube Video',
    thumbnail_url: item.thumbnailUrl,
    media_type: 'video_podcast',
    source: 'youtube',
    stream_url: item.streamUrl,
    external_url: item.externalUrl,
    duration_seconds: null,
    release_year: null,
    rating: null,
    description: null,
  }));

  return [...mappedItunes, ...mappedYt];
}

export function createSearchUnifiedRouter({ database }) {
  const router = Router();

  router.get('/unified', async (request, response) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
    if (!query || query.length > 200) {
      return response.status(400).json({ error: 'A search query of 1 to 200 characters is required.' });
    }

    const type = typeof request.query.type === 'string' ? request.query.type.toLowerCase() : 'all';
    const validTypes = ['all', 'music', 'podcast', 'movie', 'video_podcast'];
    if (!validTypes.includes(type)) {
      return response.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}.` });
    }

    const sort = typeof request.query.sort === 'string' ? request.query.sort.toLowerCase() : 'relevance';
    const validSorts = ['relevance', 'recent', 'popular'];
    if (!validSorts.includes(sort)) {
      return response.status(400).json({ error: `Invalid sort. Must be one of: ${validSorts.join(', ')}.` });
    }

    const limit = Math.max(1, Math.min(100, Number(request.query.limit) || 20));
    const offset = Math.max(0, Number(request.query.offset) || 0);

    const cacheKey = query.toLowerCase();
    let cachedPayload = null;
    let cacheMiss = true;

    try {
      const cached = await database.prepare(`
        SELECT response_json AS "responseJson" FROM search_cache
        WHERE query = $1 AND type = $2 AND sort = $3 AND expires_at > NOW()
      `).get(cacheKey, type, sort);

      if (cached?.responseJson) {
        cachedPayload = JSON.parse(cached.responseJson);
        cacheMiss = false;
      }
    } catch (error) {
      console.error('Search cache read error:', error);
    }

    let payload;
    if (cachedPayload) {
      payload = cachedPayload;
    } else {
      const tasks = [];
      if (type === 'all' || type === 'music') {
        tasks.push(fetchAudius(query).then((results) => ({ provider: 'audius', results })).catch((err) => ({ provider: 'audius', error: err.message })));
      }
      if (type === 'all' || type === 'podcast') {
        tasks.push(fetchITunesPodcasts(query).then((results) => ({ provider: 'itunes', results })).catch((err) => ({ provider: 'itunes', error: err.message })));
      }
      if (type === 'all' || type === 'movie') {
        tasks.push(fetchTmdbMovies(query).then((results) => ({ provider: 'tmdb', results })).catch((err) => ({ provider: 'tmdb', error: err.message })));
      }
      if (type === 'all' || type === 'video_podcast') {
        tasks.push(fetchVideoPodcasts(query, type).then((results) => ({ provider: 'video_podcast', results })).catch((err) => ({ provider: 'video_podcast', error: err.message })));
      }

      const settled = await Promise.allSettled(tasks);
      const sourcesMeta = {
        tmdb: { count: 0, error: null },
        itunes: { count: 0, error: null },
        audius: { count: 0, error: null },
        youtube: { count: 0, error: null },
      };

      let allResults = [];

      for (const res of settled) {
        if (res.status === 'fulfilled') {
          const val = res.value;
          if (val.error) {
            if (val.provider === 'tmdb') sourcesMeta.tmdb.error = val.error;
            if (val.provider === 'itunes') sourcesMeta.itunes.error = val.error;
            if (val.provider === 'audius') sourcesMeta.audius.error = val.error;
            if (val.provider === 'video_podcast') sourcesMeta.itunes.error = val.error;
          } else {
            const results = val.results ?? [];
            for (const item of results) {
              const src = item.source;
              if (sourcesMeta[src]) {
                sourcesMeta[src].count++;
              }
            }
            allResults.push(...results);
          }
        }
      }

      // Sorting
      if (sort === 'recent') {
        allResults.sort((a, b) => (b.release_year ?? 0) - (a.release_year ?? 0));
      } else if (sort === 'popular') {
        allResults.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      }

      payload = {
        query,
        type,
        sort,
        results: allResults,
        sources: sourcesMeta,
      };

      try {
        await database.prepare(`
          INSERT INTO search_cache (query, type, sort, response_json, expires_at)
          VALUES ($1, $2, $3, $4, NOW() + ${CACHE_TTL})
          ON CONFLICT (query, type, sort) DO UPDATE SET
            response_json = excluded.response_json,
            expires_at = excluded.expires_at
        `).run(cacheKey, type, sort, JSON.stringify(payload));
      } catch (error) {
        recordCacheWriteFailure(error);
      }
    }

    // Slice pagination on read
    const fullResults = payload.results ?? [];
    const slicedResults = fullResults.slice(offset, offset + limit);

    // Analytics logging: only on cache miss + sliding window rate limited
    if (cacheMiss && shouldLogAnalytics()) {
      const userId = request.user?.id || null;
      database.prepare(`
        INSERT INTO search_events (user_id, query, type, result_count)
        VALUES ($1, $2, $3, $4)
      `).run(userId, query, type, fullResults.length).catch((err) => {
        console.error('Failed to log search analytics:', err);
      });
    }

    return response.json({
      query: payload.query,
      type: payload.type,
      sort: payload.sort,
      cached: !cacheMiss,
      results: slicedResults,
      total: fullResults.length,
      limit,
      offset,
      sources: payload.sources,
    });
  });

  router.get('/suggest', async (request, response) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
    const limit = Math.max(1, Math.min(100, Number(request.query.limit) || 5));
    if (query.length < 2 || query.length > 200) {
      return response.status(400).json({ error: 'A suggestion query of 2 to 200 characters is required.' });
    }

    const cacheKey = `suggest:${query.toLowerCase()}`;
    try {
      const cached = await database.prepare(`
        SELECT response_json AS "responseJson" FROM search_cache
        WHERE query = $1 AND type = 'suggest' AND sort = 'relevance' AND expires_at > NOW()
      `).get(cacheKey);
      if (cached?.responseJson) {
        const parsed = JSON.parse(cached.responseJson);
        return response.json({
          suggestions: (parsed.suggestions ?? []).slice(0, limit),
        });
      }
    } catch (error) {
      console.error('Suggest cache read error:', error);
    }

    try {
      const [audiusRes, itunesRes, tmdbRes] = await Promise.allSettled([
        fetchAudius(query),
        fetchITunesPodcasts(query),
        fetchTmdbMovies(query),
      ]);

      const suggestions = [];
      if (audiusRes.status === 'fulfilled') suggestions.push(...audiusRes.value);
      if (itunesRes.status === 'fulfilled') suggestions.push(...itunesRes.value);
      if (tmdbRes.status === 'fulfilled') suggestions.push(...tmdbRes.value);

      const topSuggestions = suggestions.slice(0, limit).map((item) => ({
        id: item.id,
        title: item.title,
        media_type: item.media_type,
        thumbnail_url: item.thumbnail_url,
        source: item.source,
      }));

      const payload = { suggestions: topSuggestions };

      await database.prepare(`
        INSERT INTO search_cache (query, type, sort, response_json, expires_at)
        VALUES ($1, 'suggest', 'relevance', $2, NOW() + ${SUGGEST_CACHE_TTL})
        ON CONFLICT (query, type, sort) DO UPDATE SET
          response_json = excluded.response_json,
          expires_at = excluded.expires_at
      `).run(cacheKey, JSON.stringify(payload)).catch(() => {});

      return response.json(payload);
    } catch (error) {
      console.error('Suggest error:', error);
      return response.json({ suggestions: [] });
    }
  });

  return router;
}
