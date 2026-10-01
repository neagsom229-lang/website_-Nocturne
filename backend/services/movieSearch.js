const TMDB_API = 'https://api.themoviedb.org/3';

export class MovieSearchError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'MovieSearchError';
    this.status = status;
  }
}

async function requestTmdb(path, params = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new MovieSearchError('Movie search is not configured yet. Add TMDB_API_KEY to the server environment.', 503);

  const url = new URL(`${TMDB_API}${path}`);
  url.search = new URLSearchParams({ api_key: apiKey, ...params }).toString();
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new MovieSearchError('The movie provider could not be reached.');
  }
  if (!response.ok) {
    throw new MovieSearchError(
      `The movie provider returned status ${response.status}.`,
      response.status === 404 ? 404 : 502,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new MovieSearchError('The movie provider returned an invalid response.');
  }
}

export function searchMovies(query) {
  return requestTmdb('/search/movie', { query });
}

export function getMovieDetails(id) {
  return requestTmdb(`/movie/${encodeURIComponent(id)}`, { append_to_response: 'credits' });
}

export function getMoviesByGenre(genreId) {
  if (!Number.isInteger(genreId) || genreId < 1) {
    throw new MovieSearchError('genreId must be a positive integer.', 400);
  }
  return requestTmdb('/discover/movie', {
    with_genres: String(genreId),
    sort_by: 'popularity.desc',
  });
}

export function getTvDetails(id) {
  return requestTmdb(`/tv/${encodeURIComponent(id)}`, { append_to_response: 'credits' });
}

export function getTrendingMovies(timeWindow = 'week') {
  if (timeWindow !== 'day' && timeWindow !== 'week') {
    throw new MovieSearchError('timeWindow must be "day" or "week".', 400);
  }
  return requestTmdb(`/trending/movie/${timeWindow}`);
}

export function getUpcomingMovies() {
  return requestTmdb('/movie/upcoming');
}

export function getNowPlayingMovies() {
  return requestTmdb('/movie/now_playing');
}

export function getMovieVideos(id) {
  return requestTmdb(`/movie/${encodeURIComponent(id)}/videos`);
}

export function getTvVideos(id) {
  return requestTmdb(`/tv/${encodeURIComponent(id)}/videos`);
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
  const trailer = videos.find((video) => (
    video.site === 'YouTube' && video.type === 'Trailer' && video.key
  )) ?? videos.find((video) => video.site === 'YouTube' && video.key);
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
