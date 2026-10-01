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
  const response = await request<{ movie: MovieDetails }>(`/api/movies/${encodeURIComponent(id)}`);
  return response.movie;
}

export async function saveMovie(tmdbId: number): Promise<string> {
  const result = await request<{ item: { id: string } }>('/api/movies/save', {
    method: 'POST',
    body: JSON.stringify({ tmdb_id: tmdbId, media_type: 'movie' }),
  });
  return result.item.id;
}
