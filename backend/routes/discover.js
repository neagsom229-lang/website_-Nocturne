import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { searchExternalMedia } from '../mediaSearch.js';
import {
  getNowPlayingMovies,
  getTrendingMovies,
  normalizeMovie,
} from '../services/movieSearch.js';
import { listPublicPlaylists } from './playlists.js';
import { getCachedGenreRecommendations } from '../services/movieGenreCache.js';

// ---------------------------------------------------------------------------
// Curated seed data (fallback when providers fail)
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedPath = path.join(__dirname, '..', 'data', 'curated-seeds.json');

let curatedSeeds = { music: [], podcasts: [] };
try {
  const parsed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  curatedSeeds = {
    music: Array.isArray(parsed.music) ? parsed.music : [],
    podcasts: Array.isArray(parsed.podcasts) ? parsed.podcasts : [],
  };
} catch (error) {
  console.error('[discover] Failed to load curated seeds:', error.message);
}
console.info('[discover] seed file:', { path: seedPath, exists: fs.existsSync(seedPath) });

// Dev-only sanity check. Runs AFTER startup, one URL at a time, never blocks the server.
// A 401/403/405 usually means "blocks server-side requests", not "broken", so only
// 404/410 are reported as broken.
async function checkSeedUrls() {
  const items = [...curatedSeeds.music, ...curatedSeeds.podcasts];
  for (const item of items) {
    if (!item?.stream_url) continue;
    try {
      const res = await fetch(item.stream_url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0', 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      });
      await res.body?.cancel();
      if (res.status === 404 || res.status === 410) {
        console.warn(`[discover] Seed "${item.title}" is broken (${res.status}). Replace its stream_url.`);
      } else if ([401, 403, 405].includes(res.status)) {
        console.info(`[discover] Seed "${item.title}" blocks server-side checks (${res.status}). Test it in a browser.`);
      }
    } catch (error) {
      console.warn(`[discover] Seed "${item.title}" check failed: ${error.message}`);
    }
  }
}
if (process.env.NODE_ENV !== 'production') {
  setTimeout(() => checkSeedUrls().catch(() => {}), 5000);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const CACHE_TTLS = {
  trending: "INTERVAL '15 minutes'",
  releases: "INTERVAL '30 minutes'",
  failure: "INTERVAL '1 minute'", // short cache after a provider failure, protects APIs during outages
};

const AUDIUS_BASE = 'https://discoveryprovider.audius.co/v1';
const AUDIUS_APP = 'Nocturne';

// Collapses concurrent identical work (many requests on a cold cache) into one.
const inFlight = new Map();
function dedupe(key, work) {
  if (!inFlight.has(key)) {
    inFlight.set(key, Promise.resolve().then(work).finally(() => inFlight.delete(key)));
  }
  return inFlight.get(key);
}

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];
const byNewest = (a, b) => (Date.parse(b.release_date) || 0) - (Date.parse(a.release_date) || 0);

// Express 5 forwards rejected promises, but this keeps behavior safe on any version.
const asyncRoute = (handler) => (request, response, next) =>
  Promise.resolve(handler(request, response, next)).catch(next);

async function requestJson(url, provider, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    throw new Error(`${provider} could not be reached: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new Error(`${provider} returned status ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${provider} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isRssOrXml(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return lower.endsWith('.xml') || lower.endsWith('.rss') || lower.includes('/feed');
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------
/**
 * Normalizes iTunes results.
 * episodes=false -> podcast SHOWS (collectionId / collectionName)
 * episodes=true  -> podcast EPISODES (trackId / trackName, collectionName is the show)
 */
function normalizePodcastResults(results, { episodes = false } = {}) {
  if (!Array.isArray(results)) return [];
  const seenIds = new Set();
  const normalized = [];

  for (const podcast of results) {
    const id = episodes ? podcast.trackId : (podcast.collectionId ?? podcast.trackId);
    const title = episodes
      ? (podcast.trackName ?? podcast.collectionName)
      : (podcast.collectionName ?? podcast.trackName);
    if (id === undefined || typeof title !== 'string') continue;

    const stringId = String(id);
    if (seenIds.has(stringId)) continue;

    const previewUrl = episodes
      ? (podcast.episodeUrl ?? podcast.previewUrl ?? null)
      : (podcast.previewUrl ?? podcast.episodeUrl ?? null);
    const feedUrl = podcast.feedUrl ?? null;
    const externalUrl = episodes
      ? (podcast.trackViewUrl ?? podcast.collectionViewUrl ?? null)
      : (podcast.collectionViewUrl ?? podcast.trackViewUrl ?? null);

    const hasPreview = Boolean(previewUrl) && !isRssOrXml(previewUrl);
    const allUrls = [previewUrl, feedUrl].filter(Boolean);
    const onlyFeeds = allUrls.length > 0 && allUrls.every(isRssOrXml);

    if (onlyFeeds && !externalUrl) continue;
    if (!hasPreview && !externalUrl) continue;

    seenIds.add(stringId);

    const streamUrl = hasPreview ? previewUrl : (isRssOrXml(feedUrl) ? null : feedUrl);

    normalized.push({
      id: stringId,
      title,
      channel: (episodes ? podcast.collectionName : podcast.artistName) ?? 'Unknown channel',
      thumbnail_url: podcast.artworkUrl600 ?? podcast.artworkUrl100 ?? null,
      external_url: externalUrl,
      stream_url: streamUrl,
      release_date: podcast.releaseDate,
      media_type: 'podcast',
      source: 'itunes',
      isPlayable: Boolean(streamUrl && !isRssOrXml(streamUrl)),
    });
  }

  return normalized;
}

function mapMovie(movie) {
  const normalized = normalizeMovie(movie);
  return {
    id: String(normalized.tmdb_id),
    title: normalized.title,
    thumbnail_url: normalized.poster_url,
    release_year: normalized.year,
    rating: normalized.rating,
    description: normalized.overview,
    media_type: 'movie',
    source: 'tmdb',
  };
}

function mapAudiusTrack(track) {
  if (typeof track?.id !== 'string' || typeof track?.title !== 'string') return [];
  return [{
    id: track.id,
    title: track.title,
    artist: track.user?.name ?? 'Unknown artist',
    thumbnail_url: track.artwork?.['480x480'] ?? track.artwork?.['150x150'] ?? null,
    stream_url: `${AUDIUS_BASE}/tracks/${encodeURIComponent(track.id)}/stream?app_name=${AUDIUS_APP}`,
    media_type: 'music',
    source: 'audius',
  }];
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------
function createProviders(fetchImpl) {
  async function audiusTracks(endpoint, params = {}) {
    const url = new URL(`${AUDIUS_BASE}/tracks/${endpoint}`);
    url.search = new URLSearchParams({ app_name: AUDIUS_APP, ...params });
    const response = await requestJson(url, 'Audius', fetchImpl);
    const data = Array.isArray(response) ? response : response?.data;
    return Array.isArray(data) ? data.flatMap(mapAudiusTrack) : [];
  }

  return {
    async movies() {
      const response = await getTrendingMovies('week');
      if (!Array.isArray(response.results)) throw new Error('TMDB returned an invalid trending response');
      return response.results.slice(0, 12).map(mapMovie);
    },

    async nowPlaying() {
      const response = await getNowPlayingMovies();
      if (!Array.isArray(response.results)) throw new Error('TMDB returned an invalid now-playing response');
      return response.results.slice(0, 12).map(mapMovie);
    },

    async podcasts() {
      const term = pickRandom(['tech', 'news', 'comedy', 'business', 'true crime']);
      let rawResults = [];
      try {
        const url = new URL('https://itunes.apple.com/search');
        url.search = new URLSearchParams({ term, entity: 'podcast', media: 'podcast', limit: '12' });
        const response = await requestJson(url, 'iTunes', fetchImpl);
        if (Array.isArray(response.results)) rawResults = response.results;
      } catch (error) {
        console.warn(`[discover] iTunes podcast search failed for "${term}":`, error.message);
      }

      const shows = normalizePodcastResults(rawResults).sort(byNewest);
      const results = shows.length > 0 ? shows.slice(0, 12) : curatedSeeds.podcasts;
      console.info('[discover] podcasts:', {
        provider: 'itunes',
        query: term,
        count: results.length,
        usedFallback: shows.length === 0,
      });
      return results;
    },

    async music() {
      let tracks = [];
      let source = 'trending';

      try {
        tracks = await audiusTracks('trending');
      } catch (error) {
        console.warn('[discover] Audius trending failed:', error.message);
      }

      if (tracks.length === 0) {
        source = 'search';
        const term = pickRandom(['lofi', 'chillhop', 'ambient', 'jazz', 'electronic']);
        try {
          tracks = await audiusTracks('search', { query: term, limit: '20' });
        } catch (error) {
          console.warn(`[discover] Audius search failed for "${term}":`, error.message);
        }
      }

      const results = tracks.length > 0 ? tracks.slice(0, 12) : curatedSeeds.music;
      console.info('[discover] music source:', {
        source: tracks.length > 0 ? source : 'seed',
        count: results.length,
      });
      return results;
    },

    async musicRecommendations(query) {
      const tracks = await audiusTracks('search', { query, limit: '12' });
      return tracks;
    },

    async newEpisodes() {
      const terms = ['tech', 'news', 'comedy', 'true crime', 'business'];
      const settled = await Promise.allSettled(terms.map(async (term) => {
        const url = new URL('https://itunes.apple.com/search');
        url.search = new URLSearchParams({
          term,
          entity: 'podcastEpisode',
          media: 'podcast',
          limit: '20',
        });
        const response = await requestJson(url, 'iTunes', fetchImpl);
        return normalizePodcastResults(response.results, { episodes: true });
      }));

      const seen = new Set();
      const unique = settled
        .flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : []))
        .filter((episode) => !seen.has(episode.id) && seen.add(episode.id))
        .sort(byNewest);

      return unique.length > 0 ? unique.slice(0, 12) : curatedSeeds.podcasts;
    },

    async recommendations(query) {
      const items = await searchExternalMedia(query, 'podcast', { fetchImpl });
      return items.map((item) => ({
        id: item.externalId,
        title: item.title,
        channel: item.artist ?? 'Unknown channel',
        thumbnail_url: item.thumbnailUrl,
        stream_url: item.streamUrl,
        external_url: item.externalUrl,
        media_type: 'podcast',
        source: 'itunes',
      }));
    },
  };
}

// ---------------------------------------------------------------------------
// Trending feed (cached + de-duplicated)
// ---------------------------------------------------------------------------
async function resolveTrending(providerSet) {
  const keys = ['movies', 'podcasts', 'music'];
  const settled = await Promise.allSettled(keys.map((key) => providerSet[key]()));

  const result = { movies: [], podcasts: [], music: [] };
  let failed = false;

  settled.forEach((entry, index) => {
    const key = keys[index];
    if (entry.status === 'fulfilled' && Array.isArray(entry.value)) {
      result[key] = entry.value;
    } else {
      failed = true;
      console.error(`[discover] ${key} provider failed:`, entry.status === 'rejected' ? entry.reason : 'invalid result');
    }
  });

  // Music and podcasts should never be empty
  if (result.music.length === 0) result.music = curatedSeeds.music;
  if (result.podcasts.length === 0) result.podcasts = curatedSeeds.podcasts;

  return { result, failed };
}

async function trendingFeed(database, providerSet) {
  try {
    const cached = await database.prepare(`
      SELECT response_json AS "responseJson" FROM search_cache
      WHERE query = 'discover:trending' AND type = 'music' AND expires_at > NOW()
    `).get();
    if (cached) {
      const parsed = JSON.parse(cached.responseJson);
      if (!Array.isArray(parsed.movies)) parsed.movies = [];
      if (!Array.isArray(parsed.music) || parsed.music.length === 0) parsed.music = curatedSeeds.music;
      if (!Array.isArray(parsed.podcasts) || parsed.podcasts.length === 0) parsed.podcasts = curatedSeeds.podcasts;
      console.info('[discover] trending response:', {
        movies: parsed.movies.length,
        music: parsed.music.length,
        podcasts: parsed.podcasts.length,
        cacheHit: true,
      });
      return parsed;
    }
  } catch (error) {
    console.error('[discover] trending cache read failed:', error.message);
    await database.prepare(
      "DELETE FROM search_cache WHERE query = 'discover:trending' AND type = 'music'",
    ).run().catch(() => {});
  }

  return dedupe('trending', async () => {
    const { result, failed } = await resolveTrending(providerSet);
    console.info('[discover] trending response:', {
      movies: result.movies.length,
      music: result.music.length,
      podcasts: result.podcasts.length,
      cacheHit: false,
    });

    try {
      await database.prepare(`
        INSERT INTO search_cache (query, type, sort, response_json, expires_at)
        VALUES ('discover:trending', 'music', 'relevance', $1, NOW() + ${failed ? CACHE_TTLS.failure : CACHE_TTLS.trending})
        ON CONFLICT (query, type, sort) DO UPDATE SET
          response_json = excluded.response_json,
          expires_at = excluded.expires_at
      `).run(JSON.stringify(result));
    } catch (error) {
      console.error('[discover] failed to cache trending:', error.message);
    }
    return result;
  });
}

// ---------------------------------------------------------------------------
// New releases (cached + de-duplicated)
// ---------------------------------------------------------------------------
async function newReleasesFeed(database, providerSet) {
  try {
    const cached = await database.prepare(`
      SELECT response_json AS "responseJson" FROM search_cache
      WHERE query = 'discover:new-releases' AND type = 'podcast' AND expires_at > NOW()
    `).get();
    if (cached) return JSON.parse(cached.responseJson);
  } catch (error) {
    console.error('[discover] new-releases cache read failed:', error.message);
    await database.prepare(
      "DELETE FROM search_cache WHERE query = 'discover:new-releases' AND type = 'podcast'",
    ).run().catch(() => {});
  }

  return dedupe('new-releases', async () => {
    const settled = await Promise.allSettled([providerSet.nowPlaying(), providerSet.newEpisodes()]);
    const result = {
      movies: settled[0].status === 'fulfilled' && Array.isArray(settled[0].value) ? settled[0].value : [],
      podcasts: settled[1].status === 'fulfilled' && Array.isArray(settled[1].value) ? settled[1].value : [],
    };
    if (settled[0].status === 'rejected') console.error('[discover] new movie releases failed:', settled[0].reason);
    if (settled[1].status === 'rejected') console.error('[discover] new podcast releases failed:', settled[1].reason);
    if (result.podcasts.length === 0) result.podcasts = curatedSeeds.podcasts;

    const failed = settled.some((entry) => entry.status === 'rejected');
    try {
      await database.prepare(`
        INSERT INTO search_cache (query, type, sort, response_json, expires_at)
        VALUES ('discover:new-releases', 'podcast', 'relevance', $1, NOW() + ${failed ? CACHE_TTLS.failure : CACHE_TTLS.releases})
        ON CONFLICT (query, type, sort) DO UPDATE SET
          response_json = excluded.response_json,
          expires_at = excluded.expires_at
      `).run(JSON.stringify(result));
    } catch (error) {
      console.error('[discover] failed to cache new-releases:', error.message);
    }
    return result;
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export function createDiscoverRouter({
  database,
  authenticate,
  providers = createProviders(fetch),
}) {
  const router = Router();

  router.get('/trending', asyncRoute(async (_request, response) => {
    return response.json(await trendingFeed(database, providers));
  }));

  router.get('/new-releases', asyncRoute(async (_request, response) => {
    return response.json(await newReleasesFeed(database, providers));
  }));

  router.get('/for-you', authenticate, asyncRoute(async (request, response) => {
    const userId = request.user.id;
    const [counts, artists, saved, genres] = await Promise.all([
      database.prepare(`
        SELECT COALESCE(media_type, type) AS "mediaType", COUNT(*)::int AS count
        FROM media_library WHERE user_id = $1
        GROUP BY COALESCE(media_type, type)
        ORDER BY count DESC, "mediaType"
      `).all(userId),
      database.prepare(`
        SELECT artist, COUNT(*)::int AS count
        FROM media_library
        WHERE user_id = $1 AND artist IS NOT NULL AND artist <> ''
        GROUP BY artist ORDER BY count DESC, artist LIMIT 5
      `).all(userId),
      database.prepare('SELECT COUNT(*)::int AS count FROM media_library WHERE user_id = $1').get(userId),
      database.prepare(`
        SELECT mg.genre_id AS id, mg.genre_name AS name, COUNT(*)::int AS count
        FROM media_genres mg
        JOIN media_library m ON m.id = mg.media_library_id
        WHERE m.user_id = $1 AND m.provider = 'tmdb'
        GROUP BY mg.genre_id, mg.genre_name
        ORDER BY count DESC, mg.genre_name
        LIMIT 5
      `).all(userId),
    ]);

    const trends = await trendingFeed(database, providers);

    if (saved.count < 5) {
      return response.json({
        ...trends,
        counts,
        topArtists: artists,
        topGenres: [],
        fallback: 'trending',
      });
    }

    const topArtist = artists[0]?.artist;
    const topGenre = genres[0];

    // Run the three personalized lookups in parallel; each falls back to trending on its own.
    const [podcastsResult, moviesResult, musicResult] = await Promise.allSettled([
      topArtist ? providers.recommendations(topArtist) : Promise.resolve([]),
      topGenre ? getCachedGenreRecommendations(database, topGenre.id) : Promise.resolve([]),
      topArtist ? providers.musicRecommendations(topArtist) : Promise.resolve([]),
    ]);

    const pick = (entry, fallback, label) => {
      if (entry.status === 'rejected') {
        console.error(`[discover] personalized ${label} failed:`, entry.reason);
        return fallback;
      }
      return Array.isArray(entry.value) && entry.value.length > 0 ? entry.value : fallback;
    };

    return response.json({
      movies: pick(moviesResult, trends.movies, 'movies'),
      podcasts: pick(podcastsResult, trends.podcasts, 'podcasts'),
      music: pick(musicResult, trends.music, 'music'),
      counts,
      topArtists: artists,
      topGenres: genres,
      fallback: null,
    });
  }));

  router.get('/public-playlists', asyncRoute(async (request, response) => {
    const limit = request.query.limit === undefined ? 8 : Number(request.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      return response.status(400).json({ error: 'limit must be an integer from 1 to 20.' });
    }
    const playlists = await listPublicPlaylists(database, { sort: 'popular', limit, offset: 0 });
    return response.json({ playlists });
  }));

  return router;
}