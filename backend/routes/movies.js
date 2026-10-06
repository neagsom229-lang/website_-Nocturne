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
  getNowPlayingMovies,
  normalizeMovie,
  normalizeMovieDetails,
  searchMovies,
} from '../services/movieSearch.js';
import { getCachedGenreRecommendations, refreshGenreRecommendations } from '../services/movieGenreCache.js';

const router = Router();

router.get('/search', async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
  if (!query || query.length > 200) {
    return response.status(400).json({ error: 'A movie search query of 1 to 200 characters is required.' });
  }
  try {
    const res = await searchMovies(query);
    const results = Array.isArray(res.results) ? res.results.map(normalizeMovie) : [];
    return response.json({ results, degraded: Boolean(res.degraded), reason: res.reason || null });
  } catch (error) {
    console.error('Movie search error:', error);
    return response.json({ results: [], degraded: true, reason: 'tmdb_unavailable' });
  }
});

router.get('/trending', async (request, response) => {
  const timeWindow = request.query.window === 'day' ? 'day' : 'week';
  try {
    const res = await getTrendingMovies(timeWindow);
    const raw = Array.isArray(res.results) ? res.results : (Array.isArray(res) ? res : []);
    const results = raw.map(normalizeMovie);
    return response.json({ results, degraded: Boolean(res.degraded), reason: res.reason || null });
  } catch (error) {
    console.error('Trending movies error:', error);
    return response.json({ results: [], degraded: true, reason: 'tmdb_unavailable' });
  }
});

router.get('/upcoming', async (_request, response) => {
  try {
    const res = await getUpcomingMovies();
    const raw = Array.isArray(res.results) ? res.results : (Array.isArray(res) ? res : []);
    const results = raw.map(normalizeMovie);
    return response.json({ results, degraded: Boolean(res.degraded), reason: res.reason || null });
  } catch (error) {
    console.error('Upcoming movies error:', error);
    return response.json({ results: [], degraded: true, reason: 'tmdb_unavailable' });
  }
});

router.get('/now-playing', async (_request, response) => {
  try {
    const res = await getNowPlayingMovies();
    const raw = Array.isArray(res.results) ? res.results : (Array.isArray(res) ? res : []);
    const results = raw.map(normalizeMovie);
    return response.json({ results, degraded: Boolean(res.degraded), reason: res.reason || null });
  } catch (error) {
    console.error('Now playing movies error:', error);
    return response.json({ results: [], degraded: true, reason: 'tmdb_unavailable' });
  }
});

router.get('/tv/:id', async (request, response) => {
  const id = request.params.id;
  if (!/^\d+$/.test(id)) {
    return response.status(400).json({ error: 'Provide a valid TMDB TV show ID.' });
  }
  try {
    const [detailsRes, videosRes] = await Promise.all([getTvDetails(id), getTvVideos(id)]);
    const degraded = Boolean(detailsRes.degraded || videosRes.degraded);
    const reason = detailsRes.reason || videosRes.reason || null;
    const details = detailsRes.degraded && !detailsRes.id ? null : detailsRes;
    const videos = Array.isArray(videosRes.results) ? videosRes.results : [];

    if (!details || !details.id) {
      return response.json({ show: null, degraded: true, reason: reason || 'tv_unavailable' });
    }

    const normalized = normalizeMovieDetails(details, videos);
    const show = {
      ...normalized,
      seasons: Array.isArray(details.seasons) ? details.seasons : [],
      number_of_seasons: details.number_of_seasons ?? 1,
      number_of_episodes: details.number_of_episodes ?? 0,
    };
    return response.json({ show, degraded, reason });
  } catch (error) {
    console.error('TV detail error:', error);
    return response.json({ show: null, degraded: true, reason: 'tv_unavailable' });
  }
});

router.get('/genre/:genreId', async (request, response) => {
  const genreId = Number(request.params.genreId);
  if (!Number.isInteger(genreId) || genreId < 1) {
    return response.status(400).json({ error: 'A positive TMDB genre ID is required.' });
  }
  try {
    let results = await getCachedGenreRecommendations(db, genreId);
    if (!results) results = await refreshGenreRecommendations(db, genreId);
    return response.json({ results: results || [], degraded: false });
  } catch (error) {
    console.error('Genre recommendation error:', error);
    return response.json({ results: [], degraded: true, reason: 'genre_unavailable' });
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
    const [detailsRes, videosRes] = mediaType === 'tv'
      ? await Promise.all([getTvDetails(id), getTvVideos(id)])
      : await Promise.all([getMovieDetails(id), getMovieVideos(id)]);

    const details = detailsRes;
    const videos = Array.isArray(videosRes.results) ? videosRes.results : [];
    if (!details || !details.id) {
      return response.status(503).json({ error: 'The movie provider is currently unavailable.' });
    }

    const normalized = normalizeMovieDetails(details, videos);
    const { saved, item } = await db.transaction(async (tx) => {
      const inserted = await tx.prepare(`
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
        normalized.title,
        normalized.poster_url,
        normalized.trailer_url ?? `https://www.themoviedb.org/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}`,
        `https://www.themoviedb.org/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}`,
        normalized.year ? Number(normalized.year) : null,
        normalized.rating,
        normalized.overview,
        normalized.trailer_url,
      );
      const savedItem = await tx.prepare(`
        SELECT id, media_type AS "mediaType", external_id AS "externalId", title,
          thumbnail_url AS "thumbnailUrl", release_year AS "releaseYear",
          rating, description, trailer_url AS "trailerUrl"
        FROM media_library WHERE user_id = $1 AND provider = 'tmdb' AND external_id = $2
      `).get(request.user.id, id);
      if (!savedItem) throw new Error('The movie was saved but could not be read back.');
      const insertGenre = tx.prepare(`
        INSERT INTO media_genres (media_library_id, genre_id, genre_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (media_library_id, genre_id) DO UPDATE
          SET genre_name = excluded.genre_name
      `);
      for (const genre of normalized.genre_details ?? []) {
        await insertGenre.run(savedItem.id, genre.id, genre.name);
      }
      return { saved: inserted, item: savedItem };
    });
    return response.status(saved.changes ? 201 : 200).json({ item, alreadySaved: !saved.changes });
  } catch (error) {
    console.error('Save movie error:', error);
    return response.status(502).json({ error: 'Could not save this movie right now.' });
  }
});

router.get('/:id', async (request, response) => {
  if (!/^\d+$/.test(request.params.id)) {
    return response.status(400).json({ error: 'A numeric TMDB movie ID is required.' });
  }
  try {
    const [detailsRes, videosRes] = await Promise.all([
      getMovieDetails(request.params.id),
      getMovieVideos(request.params.id),
    ]);
    const degraded = Boolean(detailsRes.degraded || videosRes.degraded);
    const reason = detailsRes.reason || videosRes.reason || null;
    const details = detailsRes.degraded && !detailsRes.id ? null : detailsRes;
    const videos = Array.isArray(videosRes.results) ? videosRes.results : [];

    if (!details || !details.id) {
      return response.json({ movie: null, degraded: true, reason: reason || 'movie_unavailable' });
    }

    const movie = normalizeMovieDetails(details, videos);
    return response.json({ movie, degraded, reason });
  } catch (error) {
    console.error('Movie detail error:', error);
    return response.json({ movie: null, degraded: true, reason: 'movie_unavailable' });
  }
});

export default router;
