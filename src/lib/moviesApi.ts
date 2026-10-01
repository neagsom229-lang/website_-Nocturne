export type MovieSummary = {
  title: string;
  year: string | null;
  poster_url: string | null;
  tmdb_id: number;
  rating: number | null;
  overview: string;
};

export type MovieDetails = MovieSummary & {
  backdrop_url: string | null;
  runtime: number | null;
  genres: string[];
  cast: { id: number; name: string; character: string }[];
  trailer_url: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null
      && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

const MOVIE_DETAIL_CACHE_MS = 5 * 60 * 1000;
const movieDetailsCache = new Map<string, { value: MovieDetails; expiresAt: number }>();
const movieDetailsRequests = new Map<string, Promise<MovieDetails>>();
const prefetchQueue: { id: string; resolve: (value: MovieDetails) => void; reject: (error: unknown) => void }[] = [];
const queuedPrefetches = new Map<string, Promise<MovieDetails>>();
let activePrefetches = 0;

function cachedMovieDetails(id: string) {
  const cached = movieDetailsCache.get(id);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    movieDetailsCache.delete(id);
    return null;
  }
  return cached.value;
}

function loadMovieDetails(id: string): Promise<MovieDetails> {
  const cached = cachedMovieDetails(id);
  if (cached) return Promise.resolve(cached);
  const existing = movieDetailsRequests.get(id);
  if (existing) return existing;
  const requestPromise = request<{ movie: MovieDetails }>(`/api/movies/${encodeURIComponent(id)}`)
    .then(({ movie }) => {
      movieDetailsCache.set(id, { value: movie, expiresAt: Date.now() + MOVIE_DETAIL_CACHE_MS });
      return movie;
    })
    .finally(() => movieDetailsRequests.delete(id));
  movieDetailsRequests.set(id, requestPromise);
  return requestPromise;
}

function drainPrefetchQueue() {
  while (activePrefetches < 3 && prefetchQueue.length) {
    const task = prefetchQueue.shift();
    if (!task) continue;
    activePrefetches += 1;
    void loadMovieDetails(task.id).then(task.resolve, task.reject).finally(() => {
      activePrefetches -= 1;
      queuedPrefetches.delete(task.id);
      drainPrefetchQueue();
    });
  }
}

export function prefetchMovieDetails(id: string): Promise<MovieDetails> {
  const cached = cachedMovieDetails(id);
  if (cached) return Promise.resolve(cached);
  const activeRequest = movieDetailsRequests.get(id);
  if (activeRequest) return activeRequest;
  const queued = queuedPrefetches.get(id);
  if (queued) return queued;
  const promise = new Promise<MovieDetails>((resolve, reject) => {
    prefetchQueue.push({ id, resolve, reject });
  });
  queuedPrefetches.set(id, promise);
  drainPrefetchQueue();
  return promise;
}

export async function searchMovies(query: string): Promise<MovieSummary[]> {
  const params = new URLSearchParams({ q: query });
  const response = await request<{ results: MovieSummary[] }>(`/api/movies/search?${params}`);
  return response.results;
}

export async function fetchTrendingMovies(): Promise<MovieSummary[]> {
  const response = await request<{ results: MovieSummary[] }>('/api/movies/trending');
  return response.results;
}

export async function fetchUpcomingMovies(): Promise<MovieSummary[]> {
  const response = await request<{ results: MovieSummary[] }>('/api/movies/upcoming');
  return response.results;
}

export async function fetchMovieDetails(id: string): Promise<MovieDetails> {
  return loadMovieDetails(id);
}

export async function saveMovie(tmdbId: number): Promise<string> {
  const result = await request<{ item: { id: string } }>('/api/movies/save', {
    method: 'POST',
    body: JSON.stringify({ tmdb_id: tmdbId, media_type: 'movie' }),
  });
  return result.item.id;
}
