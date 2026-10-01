import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { db } from '../db.js';
import {
  getMovieDetails,
  getMovieVideos,
  getTvDetails,
  getTvVideos,
  getTrendingMovies,
  getUpcomingMovies,
  MovieSearchError,
  normalizeMovie,
  normalizeMovieDetails,
  searchMovies,
} from '../services/movieSearch.js';

const router = Router();
const CACHE_TTL = "INTERVAL '24 hours'";

async function cachedTmdb(query, load) {
  const cached = await db.prepare(`
    SELECT response_json AS "responseJson" FROM search_cache
    WHERE query = $1 AND type = 'movie' AND expires_at > NOW()
  `).get(query);
  if (cached) {
    try {
      return JSON.parse(cached.responseJson);
    } catch (error) {
      console.error('Invalid TMDB cache entry:', error);
      await db.prepare("DELETE FROM search_cache WHERE query = $1 AND type = 'movie'").run(query);
    }
  }

  const payload = await load();
  await db.prepare(`
    INSERT INTO search_cache (query, type, response_json, expires_at)
    VALUES ($1, 'movie', $2, NOW() + ${CACHE_TTL})
    ON CONFLICT (query, type) DO UPDATE SET
      response_json = excluded.response_json,
      expires_at = excluded.expires_at
  `).run(query, JSON.stringify(payload));
  return payload;
}

function handleProviderError(error, response) {
  if (!(error instanceof MovieSearchError)) {
    console.error('TMDB request failed:', error);
    return response.status(502).json({ error: 'The movie provider could not complete the request.' });
  }
  if (error.status >= 500) console.error(`TMDB provider error: ${error.message}`);
  return response.status(error.status).json({ error: error.message });
}

router.get('/search', async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
  if (!query || query.length > 200) {
    return response.status(400).json({ error: 'A movie search query of 1 to 200 characters is required.' });
  }
  try {
    const results = await cachedTmdb(`search:${query.toLowerCase()}`, async () => {
      const result = await searchMovies(query);
      return Array.isArray(result.results) ? result.results.map(normalizeMovie) : [];
    });
    return response.json({ results });
  } catch (error) {
    return handleProviderError(error, response);
  }
});

router.get('/trending', async (request, response) => {
  const timeWindow = request.query.window === 'day' ? 'day' : 'week';
  try {
    const results = await cachedTmdb(`trending:${timeWindow}`, async () => {
      const result = await getTrendingMovies(timeWindow);
      return Array.isArray(result.results) ? result.results.map(normalizeMovie) : [];
    });
    return response.json({ results });
  } catch (error) {
    return handleProviderError(error, response);
  }
});

router.get('/upcoming', async (_request, response) => {
  try {
    const results = await cachedTmdb('upcoming', async () => {
      const result = await getUpcomingMovies();
      return Array.isArray(result.results) ? result.results.map(normalizeMovie) : [];
    });
    return response.json({ results });
  } catch (error) {
    return handleProviderError(error, response);
  }
});

router.post('/save', async (request, response) => {
  const { tmdb_id: tmdbId, media_type: mediaType = 'movie' } = request.body ?? {};
  if (
    !/^\d+$/.test(String(tmdbId)) || !Number.isSafeInteger(Number(tmdbId)) || Number(tmdbId) < 1 ||
    !['movie', 'tv'].includes(mediaType)
  ) {
    return response.status(400).json({ error: 'Provide a valid TMDB ID and media_type ("movie" or "tv").' });
  }

  const id = String(Number(tmdbId));
  try {
    const details = await cachedTmdb(mediaType === 'movie' ? `detail:${id}` : `tv-detail:${id}`, async () => {
      const [movie, videos] = mediaType === 'tv'
        ? await Promise.all([getTvDetails(id), getTvVideos(id)])
        : await Promise.all([getMovieDetails(id), getMovieVideos(id)]);
      return normalizeMovieDetails(movie, Array.isArray(videos.results) ? videos.results : []);
    });
    const saved = await db.prepare(`
      INSERT INTO media_library
        (id, user_id, type, provider, external_id, media_type, external_source,
         title, thumbnail_url, stream_url, external_url, release_year, rating,
         description, trailer_url)
      VALUES ($1, $2, 'video', 'tmdb', $3, $4, 'tmdb',
         $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id, provider, external_id) DO NOTHING
    `).run(
      randomUUID(),
      request.user.id,
      id,
      mediaType,
      details.title,
      details.poster_url,
      details.trailer_url ?? `https://www.themoviedb.org/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}`,
      `https://www.themoviedb.org/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}`,
      details.year ? Number(details.year) : null,
      details.rating,
      details.overview,
      details.trailer_url,
    );
    const item = await db.prepare(`
      SELECT id, media_type AS "mediaType", external_id AS "externalId", title,
        thumbnail_url AS "thumbnailUrl", release_year AS "releaseYear",
        rating, description, trailer_url AS "trailerUrl"
      FROM media_library WHERE user_id = $1 AND provider = 'tmdb' AND external_id = $2
    `).get(request.user.id, id);
    return response.status(saved.changes ? 201 : 200).json({ item, alreadySaved: !saved.changes });
  } catch (error) {
    return handleProviderError(error, response);
  }
});

router.get('/:id', async (request, response) => {
  if (!/^\d+$/.test(request.params.id)) {
    return response.status(400).json({ error: 'A numeric TMDB movie ID is required.' });
  }
  try {
    const movie = await cachedTmdb(`detail:${request.params.id}`, async () => {
      const [details, videos] = await Promise.all([
        getMovieDetails(request.params.id),
        getMovieVideos(request.params.id),
      ]);
      return normalizeMovieDetails(details, Array.isArray(videos.results) ? videos.results : []);
    });
    return response.json({ movie });
  } catch (error) {
    return handleProviderError(error, response);
  }
});

export default router;
