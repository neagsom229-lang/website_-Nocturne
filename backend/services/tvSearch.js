const TMDB_API_BASE = 'https://api.themoviedb.org/3';

export async function searchTvShows(query, fetchImpl = fetch, apiKey = process.env.TMDB_API_KEY) {
  if (!apiKey) {
    throw new Error('TMDB_API_KEY is not configured');
  }
  const url = new URL(`${TMDB_API_BASE}/search/tv`);
  url.search = new URLSearchParams({ api_key: apiKey, query, include_adult: 'false' });
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`TMDB TV returned status ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data?.results)) return [];
  return data.results.map((show) => ({
    id: String(show.id),
    title: show.name,
    subtitle: show.first_air_date ? String(new Date(show.first_air_date).getFullYear()) : 'TV Show',
    thumbnail_url: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
    media_type: 'tv',
    source: 'tmdb',
    stream_url: null,
    external_url: `https://www.themoviedb.org/tv/${show.id}`,
    duration_seconds: null,
    release_year: show.first_air_date ? new Date(show.first_air_date).getFullYear() : null,
    rating: show.vote_average ?? null,
    description: show.overview ?? null,
  }));
}

export async function getTvShowDetails(showId, fetchImpl = fetch, apiKey = process.env.TMDB_API_KEY) {
  if (!apiKey) throw new Error('TMDB_API_KEY is not configured');
  const url = new URL(`${TMDB_API_BASE}/tv/${showId}`);
  url.search = new URLSearchParams({ api_key: apiKey });
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`TMDB TV show details returned status ${response.status}`);
  return await response.json();
}
