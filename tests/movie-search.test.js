import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getTrendingMovies,
  MovieSearchError,
  normalizeMovie,
  normalizeMovieDetails,
} from '../backend/services/movieSearch.js';

test('movie normalization returns the search-card metadata shape', () => {
  assert.deepEqual(normalizeMovie({
    id: 42,
    title: 'After the Rain',
    release_date: '2025-03-12',
    poster_path: '/poster.jpg',
    vote_average: 8.2,
    overview: 'A story about starting again.',
  }), {
    title: 'After the Rain',
    year: '2025',
    poster_url: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    tmdb_id: 42,
    rating: 8.2,
    overview: 'A story about starting again.',
  });
});

test('movie details select a YouTube trailer and include credits', () => {
  const details = normalizeMovieDetails({
    id: 43,
    name: 'Quiet City',
    first_air_date: '2024-08-09',
    vote_average: 7.6,
    episode_run_time: [45],
    genres: [{ name: 'Drama' }],
    credits: { cast: [{ id: 1, name: 'A. Actor', character: 'The Listener' }] },
  }, [
    { site: 'Vimeo', type: 'Trailer', key: 'ignore' },
    { site: 'YouTube', type: 'Teaser', key: 'teaser' },
    { site: 'YouTube', type: 'Trailer', key: 'official-trailer' },
  ]);
  assert.equal(details.title, 'Quiet City');
  assert.equal(details.year, '2024');
  assert.equal(details.runtime, 45);
  assert.deepEqual(details.genres, ['Drama']);
  assert.deepEqual(details.cast, [{ id: 1, name: 'A. Actor', character: 'The Listener' }]);
  assert.equal(details.trailer_url, 'https://www.youtube.com/watch?v=official-trailer');
});

test('trending movie window only accepts supported windows', () => {
  assert.throws(() => getTrendingMovies('month'), MovieSearchError);
});
