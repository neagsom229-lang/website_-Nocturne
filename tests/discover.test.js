import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createDiscoverRouter } from '../backend/routes/discover.js';

class DiscoveryTestDatabase {
  cache = new Map();

  constructor({ savedCount = 2, counts = [], artists = [], genres = [], cache = new Map() } = {}) {
    this.savedCount = savedCount;
    this.counts = counts;
    this.artists = artists;
    this.genres = genres;
    this.cache = cache;
  }

  prepare(sql) {
    return {
      get: async (...args) => {
        if (sql.includes('FROM search_cache')) {
          const [query, type] = args.length ? args : [
            sql.includes('discover:new-releases') ? 'discover:new-releases' : 'discover:trending',
            sql.includes("type = 'podcast'") ? 'podcast' : 'music',
          ];
          return this.cache.get(`${query}:${type ?? (sql.includes("type = 'movie'") ? 'movie' : 'music')}`);
        }
        if (sql.includes('COUNT(*)::int AS count FROM media_library')) return { count: this.savedCount };
        return null;
      },
      all: async (userId) => {
        if (sql.includes('GROUP BY COALESCE(media_type, type)')) return this.counts;
        if (sql.includes('GROUP BY artist')) return this.artists;
        if (sql.includes('GROUP BY mg.genre_id')) return this.genres;
        if (sql.includes('FROM playlists')) return [];
        return [];
      },
      run: async (...args) => {
        if (sql.includes('INSERT INTO search_cache')) {
          const query = sql.includes('discover:new-releases') ? 'discover:new-releases' : 'discover:trending';
          const type = query.endsWith('new-releases') ? 'podcast' : 'music';
          this.cache.set(`${query}:${type}`, { responseJson: args.at(-1) });
        }
        if (sql.includes('DELETE FROM search_cache')) this.cache.clear();
      },
    };
  }
}

async function startRouter(providers, authenticate = (request, _response, next) => {
  request.user = { id: 'listener-1' };
  next();
}, database = new DiscoveryTestDatabase()) {
  const app = express();
  app.use('/api/discover', createDiscoverRouter({ database, authenticate, providers }));
  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  return {
    fetch: (path) => fetch(`http://127.0.0.1:${address.port}${path}`),
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

test('trending always returns all categories when one provider fails', async () => {
  const app = await startRouter({
    movies: async () => { throw new Error('TMDB unavailable'); },
    podcasts: async () => [{ id: 'episode-1', title: 'Night Radio' }],
    music: async () => [{ id: 'track-1', title: 'Soft Static' }],
  });
  try {
    const response = await app.fetch('/api/discover/trending');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      movies: [],
      podcasts: [{ id: 'episode-1', title: 'Night Radio' }],
      music: [{ id: 'track-1', title: 'Soft Static' }],
    });
  } finally {
    await app.close();
  }
});

test('for-you returns the trending feed when fewer than five items are saved', async () => {
  const app = await startRouter({
    movies: async () => [{ id: 'movie-1' }],
    podcasts: async () => [{ id: 'podcast-1' }],
    music: async () => [{ id: 'music-1' }],
    nowPlaying: async () => [],
    newEpisodes: async () => [],
    recommendations: async () => [],
    movieRecommendations: async () => [],
    movieGenres: async () => [],
    musicRecommendations: async () => [],
  });
  try {
    const response = await app.fetch('/api/discover/for-you');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.fallback, 'trending');
    assert.deepEqual(body.movies, [{ id: 'movie-1' }]);
    assert.deepEqual(body.podcasts, [{ id: 'podcast-1' }]);
    assert.deepEqual(body.music, [{ id: 'music-1' }]);
  } finally {
    await app.close();
  }
});

test('for-you falls back to trending for categories without cached recommendations', async () => {
  const app = await startRouter({
    movies: async () => [{ id: 'movie-trend' }],
    podcasts: async () => [{ id: 'podcast-trend' }],
    music: async () => [{ id: 'music-trend' }],
    recommendations: async () => [],
    musicRecommendations: async () => [],
  }, undefined, new DiscoveryTestDatabase({
    savedCount: 5,
    counts: [],
    artists: [{ artist: 'June', count: 5 }],
    genres: [{ id: 28, name: 'Action', count: 2 }],
  }));
  try {
    const response = await app.fetch('/api/discover/for-you');
    const body = await response.json();
    assert.equal(body.fallback, null);
    assert.deepEqual(body.movies, [{ id: 'movie-trend' }]);
    assert.deepEqual(body.podcasts, [{ id: 'podcast-trend' }]);
    assert.deepEqual(body.music, [{ id: 'music-trend' }]);
  } finally {
    await app.close();
  }
});

test('for-you uses cached genres and makes no outbound TMDB requests', async () => {
  let tmdbCalls = 0;
  const cachedTrending = JSON.stringify({
    movies: [{ id: 'movie-trend' }],
    podcasts: [],
    music: [],
  });
  const cachedGenreMovies = JSON.stringify([{ id: 'movie-action' }]);
  const app = await startRouter({
    movies: async () => { tmdbCalls += 1; return []; },
    podcasts: async () => { tmdbCalls += 1; return []; },
    music: async () => { tmdbCalls += 1; return []; },
  }, undefined, new DiscoveryTestDatabase({
    savedCount: 5,
    counts: [{ mediaType: 'movie', count: 5 }],
    genres: [{ id: 28, name: 'Action', count: 1 }],
    cache: new Map([
      ['discover:trending:music', { responseJson: cachedTrending }],
      ['discover:genre:28:movie', { responseJson: cachedGenreMovies }],
    ]),
  }));
  try {
    const response = await app.fetch('/api/discover/for-you');
    const body = await response.json();
    assert.deepEqual(body.movies, [{ id: 'movie-action' }]);
    assert.deepEqual(body.topGenres, [{ id: 28, name: 'Action', count: 1 }]);
    assert.equal(tmdbCalls, 0);
  } finally {
    await app.close();
  }
});

test('public discovery endpoints can be requested without authentication', async () => {
  const app = await startRouter({
    movies: async () => [],
    podcasts: async () => [],
    music: async () => [],
    nowPlaying: async () => [],
    newEpisodes: async () => [],
  });
  try {
    assert.equal((await app.fetch('/api/discover/trending')).status, 200);
    assert.equal((await app.fetch('/api/discover/new-releases')).status, 200);
    assert.equal((await app.fetch('/api/discover/public-playlists')).status, 200);
  } finally {
    await app.close();
  }
});

test('for-you delegates authentication and rejects anonymous requests', async () => {
  const app = await startRouter({}, (_request, response) => response.status(401).json({ error: 'Sign in required' }));
  try {
    const response = await app.fetch('/api/discover/for-you');
    assert.equal(response.status, 401);
  } finally {
    await app.close();
  }
});

test('trending discovery smoke test asserts non-empty movies, music, and podcasts when available or failed', async () => {
  const appAvailable = await startRouter({
    movies: async () => [{ id: 'm1', title: 'Movie 1', media_type: 'movie' }],
    podcasts: async () => [{ id: 'p1', title: 'Podcast 1', media_type: 'podcast' }],
    music: async () => [{ id: 'mu1', title: 'Music 1', media_type: 'music' }],
  });
  try {
    const res = await appAvailable.fetch('/api/discover/trending');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.movies.length > 0);
    assert.ok(data.music.length > 0);
    assert.ok(data.podcasts.length > 0);
  } finally {
    await appAvailable.close();
  }

  const appFailed = await startRouter({
    movies: async () => { throw new Error('fail'); },
    podcasts: async () => { throw new Error('fail'); },
    music: async () => { throw new Error('fail'); },
  });
  try {
    const res = await appFailed.fetch('/api/discover/trending');
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.movies));
    assert.ok(data.music.length > 0, 'music fallback seeds should appear');
    assert.ok(data.podcasts.length > 0, 'podcast fallback seeds should appear');
  } finally {
    await appFailed.close();
  }
});
