import { getMoviesByGenre, normalizeMovie } from './movieSearch.js';

const GENRE_CACHE_TTL = "INTERVAL '24 hours'";

function genreCacheKey(genreId) {
  return `discover:genre:${genreId}`;
}

export async function getCachedGenreRecommendations(database, genreId) {
  const key = genreCacheKey(genreId);
  const cached = await database.prepare(`
    SELECT response_json AS "responseJson" FROM search_cache
    WHERE query = $1 AND type = 'movie' AND expires_at > NOW()
  `).get(key);
  if (!cached) return null;
  try {
    const result = JSON.parse(cached.responseJson);
    if (Array.isArray(result)) return result;
    console.error(`Invalid TMDB genre cache entry for ${genreId}: expected an array.`);
    await database.prepare('DELETE FROM search_cache WHERE query = $1 AND type = $2').run(key, 'movie');
    return null;
  } catch (error) {
    console.error(`Invalid TMDB genre cache entry for ${genreId}:`, error);
    await database.prepare('DELETE FROM search_cache WHERE query = $1 AND type = $2').run(key, 'movie');
    return null;
  }
}

export async function refreshGenreRecommendations(database, genreId) {
  const response = await getMoviesByGenre(genreId);
  if (!Array.isArray(response.results)) {
    throw new Error(`TMDB returned an invalid response for genre ${genreId}.`);
  }
  const result = response.results.slice(0, 12).map((movie) => {
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
  });
  await database.prepare(`
    INSERT INTO search_cache (query, type, sort, response_json, expires_at)
    VALUES ($1, 'movie', 'relevance', $2, NOW() + ${GENRE_CACHE_TTL})
    ON CONFLICT (query, type, sort) DO UPDATE SET
      response_json = excluded.response_json,
      expires_at = excluded.expires_at
  `).run(genreCacheKey(genreId), JSON.stringify(result));
  return result;
}
