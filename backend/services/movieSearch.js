import { providerFetch } from '../lib/providerFetch.js';

const TMDB_API = 'https://api.themoviedb.org/3';

export class MovieSearchError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'MovieSearchError';
    this.status = status;
  }
}

async function requestTmdb(path, params = {}, cacheKey) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.warn('[tmdb] TMDB_API_KEY is not configured.');
    return { results: [], degraded: true, reason: 'tmdb_not_configured' };
  }

  const url = new URL(`${TMDB_API}${path}`);
  url.search = new URLSearchParams({ api_key: apiKey, ...params }).toString();
  const requestUrl = url.toString();

  let response;
  let errorBody = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      response = await fetch(requestUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const json = await response.json();
        return { ...json, degraded: false, reason: null };
      }
      errorBody = await response.text().catch(() => '');
      if (response.status < 500 && response.status !== 429) break;
    } catch (err) {
      errorBody = err.message || String(err);
      if (attempt === 2) {
        console.error('[tmdb] request failed', {
          url: requestUrl.replace(apiKey, 'REDACTED'),
          status: response?.status,
          body: errorBody?.slice(0, 300),
        });
      }
    }
  }

  if (cacheKey) {
    try {
      const { db } = await import('../db.js');
      const cached = await db.prepare(`
        SELECT response_json AS "responseJson" FROM search_cache
        WHERE query = $1 AND type = 'movie'
      `).get(cacheKey);
      if (cached?.responseJson) {
        const cachedPayload = JSON.parse(cached.responseJson);
        console.warn(`[tmdb] fallback to cache for ${cacheKey}`);
        return { results: cachedPayload, degraded: true, reason: 'tmdb_unavailable_cached' };
      }
    } catch (e) {}
  }

  return { results: [], degraded: true, reason: 'tmdb_unavailable' };
}

export async function searchMovies(query) {
  const res = await requestTmdb('/search/movie', { query }, `search:${query.toLowerCase()}`);
  if (res.degraded && !res.results) res.results = [];
  return res;
}

export async function getMovieDetails(id) {
  const res = await requestTmdb(`/movie/${encodeURIComponent(id)}`, { append_to_response: 'credits' }, `detail:${id}`);
  return res;
}

export function getMoviesByGenre(genreId) {
  if (!Number.isInteger(genreId) || genreId < 1) {
    throw new MovieSearchError('genreId must be a positive integer.', 400);
  }
  return requestTmdb('/discover/movie', {
    with_genres: String(genreId),
    sort_by: 'popularity.desc',
  }, `genre:${genreId}`);
}

export async function getTvDetails(id) {
  return requestTmdb(`/tv/${encodeURIComponent(id)}`, { append_to_response: 'credits' }, `tv-detail:${id}`);
}

export function getTrendingMovies(timeWindow = 'week') {
  if (timeWindow !== 'day' && timeWindow !== 'week') {
    throw new MovieSearchError('timeWindow must be "day" or "week".', 400);
  }
  return requestTmdb(`/trending/movie/${timeWindow}`, {}, `trending:${timeWindow}`);
}

export async function getUpcomingMovies() {
  return requestTmdb('/movie/upcoming', {}, 'upcoming');
}

export async function getNowPlayingMovies() {
  return requestTmdb('/movie/now_playing', {}, 'now_playing');
}

export async function getMovieVideos(id) {
  return requestTmdb(`/movie/${encodeURIComponent(id)}/videos`, {}, `videos:${id}`);
}

export async function getTvVideos(id) {
  return requestTmdb(`/tv/${encodeURIComponent(id)}/videos`, {}, `tv-videos:${id}`);
}

export function normalizeMovie(movie) {
  return {
    title: movie.title ?? movie.name ?? 'Untitled',
    year: (movie.release_date ?? movie.first_air_date ?? '').slice(0, 4) || null,
    poster_url: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    tmdb_id: movie.id,
    rating: Number.isFinite(movie.vote_average) ? movie.vote_average : null,
    overview: movie.overview ?? '',
  };
}

export function normalizeMovieDetails(movie, videos) {
  const trailer = (Array.isArray(videos) ? videos : []).find((video) => (
    video.site === 'YouTube' && video.type === 'Trailer' && video.key
  )) ?? (Array.isArray(videos) ? videos : []).find((video) => video.site === 'YouTube' && video.key);
  return {
    ...normalizeMovie(movie),
    backdrop_url: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
    runtime: Number.isFinite(movie.runtime)
      ? movie.runtime
      : Array.isArray(movie.episode_run_time) && Number.isFinite(movie.episode_run_time[0])
        ? movie.episode_run_time[0]
        : null,
    genres: Array.isArray(movie.genres) ? movie.genres.map(({ name }) => name) : [],
    genre_details: Array.isArray(movie.genres)
      ? movie.genres.flatMap(({ id, name }) => Number.isInteger(id) && typeof name === 'string' ? [{ id, name }] : [])
      : [],
    genre_ids: Array.isArray(movie.genres)
      ? movie.genres.flatMap(({ id }) => Number.isInteger(id) ? [id] : [])
      : [],
    cast: Array.isArray(movie.credits?.cast)
      ? movie.credits.cast.slice(0, 12).map(({ id, name, character }) => ({ id, name, character }))
      : [],
    trailer_url: trailer ? `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}` : null,
  };
}
