import { db } from '../db.js';
import { getMovieDetails, getTvDetails } from '../services/movieSearch.js';
import { refreshGenreRecommendations } from '../services/movieGenreCache.js';

async function main() {
  const movies = await db.prepare(`
    SELECT m.id, m.external_id AS "externalId", m.media_type AS "mediaType"
    FROM media_library m
    WHERE m.provider = 'tmdb'
      AND m.media_type IN ('movie', 'tv')
      AND NOT EXISTS (
        SELECT 1 FROM media_genres mg WHERE mg.media_library_id = m.id
      )
    ORDER BY m.created_at, m.id
  `).all();
  const genreIds = new Set();
  let failedMovies = 0;
  let failedGenreCaches = 0;

  for (const movie of movies) {
    try {
      const details = movie.mediaType === 'tv'
        ? await getTvDetails(movie.externalId)
        : await getMovieDetails(movie.externalId);
      const genres = Array.isArray(details.genres)
        ? details.genres.filter((genre) => Number.isInteger(genre.id) && typeof genre.name === 'string')
        : [];
      await db.transaction(async (tx) => {
        const insertGenre = tx.prepare(`
          INSERT INTO media_genres (media_library_id, genre_id, genre_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (media_library_id, genre_id) DO UPDATE
            SET genre_name = excluded.genre_name
        `);
        for (const genre of genres) {
          await insertGenre.run(movie.id, genre.id, genre.name);
        }
      });
      genres.forEach((genre) => genreIds.add(genre.id));
      console.info(`Backfilled ${genres.length} genres for ${movie.mediaType} ${movie.externalId}.`);
    } catch (error) {
      failedMovies += 1;
      console.error(`Could not backfill genres for ${movie.mediaType} ${movie.externalId}:`, error);
    }
  }

  for (const genreId of genreIds) {
    try {
      await refreshGenreRecommendations(db, genreId);
      console.info(`Cached movie recommendations for genre ${genreId}.`);
    } catch (error) {
      failedGenreCaches += 1;
      console.error(`Could not cache recommendations for genre ${genreId}:`, error);
    }
  }

  console.info(
    `Movie genre backfill complete: ${movies.length - failedMovies}/${movies.length} media rows updated; `
    + `${genreIds.size - failedGenreCaches}/${genreIds.size} genre recommendation caches refreshed.`,
  );
  if (failedMovies || failedGenreCaches) process.exitCode = 1;
}

try {
  await main();
} finally {
  await db.close();
}
