import { Router } from 'express';
import { searchMovies, normalizeMovie } from '../services/movieSearch.js';
import { searchTvShows } from '../services/tvSearch.js';
import { searchYouTubeVideos } from '../services/youtubeSearch.js';
import { searchAudiobooks } from '../services/librivoxSearch.js';
import { searchDeezerMusic } from '../services/deezerSearch.js';
import { recordCacheWriteFailure } from '../services/cacheMetrics.js';

const APP_NAME = 'Nocturne';
const AUDIUS_API = 'https://discoveryprovider.audius.co/v1';
const SUGGEST_CACHE_TTL = "INTERVAL '10 minutes'";

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

async function measureProvider(providerName, fetchFn) {
  const start = Date.now();
  try {
    const results = await fetchFn();
    const latencyMs = Date.now() - start;
    return { provider: providerName, results, error: null, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { provider: providerName, results: [], error: err.message, latencyMs };
  }
}

export function createSearchUnifiedRouter({ database }) {
  const router = Router();

  router.get('/unified', async (request, response) => {
    const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
    if (!query || query.length > 200) {
      return response.status(400).json({ error: 'A search query of 1 to 200 characters is required.' });
    }

    const type = typeof request.query.type === 'string' ? request.query.type.toLowerCase() : 'all';
    const validTypes = ['all', 'music', 'podcast', 'movie', 'tv', 'audiobook', 'youtube', 'video_podcast'];
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
      const providerTasks = [];

      if (type === 'all' || type === 'music') {
        providerTasks.push(measureProvider('audius', () => fetchAudius(query)));
        providerTasks.push(measureProvider('deezer', () => searchDeezerMusic(query)));
      }
      if (type === 'all' || type === 'podcast') {
        providerTasks.push(measureProvider('itunes', () => fetchITunesPodcasts(query)));
      }
      if (type === 'all' || type === 'movie') {
        providerTasks.push(measureProvider('tmdb', () => fetchTmdbMovies(query)));
      }
      if (type === 'all' || type === 'tv') {
        providerTasks.push(measureProvider('tv', () => searchTvShows(query)));
      }
      if (type === 'all' || type === 'audiobook') {
        providerTasks.push(measureProvider('librivox', () => searchAudiobooks(query)));
      }
      if (type === 'all' || type === 'youtube' || type === 'video_podcast') {
        providerTasks.push(measureProvider('youtube', () => searchYouTubeVideos(query)));
      }
      if (type === 'video_podcast') {
        providerTasks.push(measureProvider('itunes_video', () => fetchITunesPodcasts(query).then(res => res.map(i => ({ ...i, media_type: 'video_podcast' })))));
      }

      const settled = await Promise.allSettled(providerTasks);
      const sourcesMeta = {};
      let allResults = [];

      for (const res of settled) {
        if (res.status === 'fulfilled') {
          const { provider, results, error, latencyMs } = res.value;
          sourcesMeta[provider] = {
            count: results.length,
            error: error ?? null,
            latencyMs,
          };
          allResults.push(...results);
        }
      }

      const seen = new Set();
      const uniqueResults = [];
      for (const item of allResults) {
        const key = `${item.media_type}:${item.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueResults.push(item);
        }
      }

      if (sort === 'recent') {
        uniqueResults.sort((a, b) => (b.release_year ?? 0) - (a.release_year ?? 0));
      } else if (sort === 'popular') {
        uniqueResults.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      }

      payload = {
        query,
        type,
        sort,
        results: uniqueResults,
        sources: sourcesMeta,
      };

      const ttl = type === 'audiobook' ? "INTERVAL '7 days'" : "INTERVAL '1 hour'";

      try {
        await database.prepare(`
          INSERT INTO search_cache (query, type, sort, response_json, expires_at)
          VALUES ($1, $2, $3, $4, NOW() + ${ttl})
          ON CONFLICT (query, type, sort) DO UPDATE SET
            response_json = excluded.response_json,
            expires_at = excluded.expires_at
        `).run(cacheKey, type, sort, JSON.stringify(payload));
      } catch (error) {
        recordCacheWriteFailure(error);
      }
    }

    const fullResults = payload.results ?? [];
    const slicedResults = fullResults.slice(offset, offset + limit);

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
      `).run(cacheKey, JSON.stringify(payload)).catch(recordCacheWriteFailure);

      return response.json(payload);
    } catch (error) {
      console.error('Suggest error:', error);
      return response.json({ suggestions: [] });
    }
  });

  return router;
}
