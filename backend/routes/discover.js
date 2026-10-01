import { Router } from 'express';
import { searchExternalMedia } from '../mediaSearch.js';
import {
  getNowPlayingMovies,
  getTrendingMovies,
  normalizeMovie,
} from '../services/movieSearch.js';
import { listPublicPlaylists } from './playlists.js';
import { getCachedGenreRecommendations } from '../services/movieGenreCache.js';

const CACHE_TTLS = {
  trending: "INTERVAL '15 minutes'",
  releases: "INTERVAL '30 minutes'",
};

async function requestJson(url, provider, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    throw new Error(`${provider} could not be reached: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new Error(`${provider} returned status ${response.status}`);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${provider} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function createProviders(fetchImpl) {
  return {
    async movies() {
      const response = await getTrendingMovies('week');
      if (!Array.isArray(response.results)) throw new Error('TMDB returned an invalid trending response');
      return response.results.slice(0, 12).map((movie) => {
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
    },
    async podcasts(term = 'trending') {
      const url = new URL('https://itunes.apple.com/search');
      url.search = new URLSearchParams({
        term,
        entity: 'podcast',
        media: 'podcast',
        limit: '12',
      });
      const response = await requestJson(url, 'iTunes', fetchImpl);
      if (!Array.isArray(response.results)) throw new Error('iTunes returned an invalid podcast response');
      return response.results.flatMap((podcast) => {
        const id = podcast.collectionId ?? podcast.trackId;
        const title = podcast.collectionName ?? podcast.trackName;
        if (id === undefined || typeof title !== 'string') return [];
        return [{
          id: String(id),
          title,
          channel: podcast.artistName ?? 'Unknown channel',
          thumbnail_url: podcast.artworkUrl600 ?? podcast.artworkUrl100 ?? null,
          external_url: podcast.collectionViewUrl ?? podcast.trackViewUrl ?? null,
          media_type: 'podcast',
          source: 'itunes',
        }];
      });
    },
    async music() {
      const url = new URL('https://discoveryprovider.audius.co/v1/tracks/trending');
      url.search = new URLSearchParams({ app_name: 'Nocturne', limit: '12' });
      const response = await requestJson(url, 'Audius', fetchImpl);
      if (!Array.isArray(response.data)) throw new Error('Audius returned an invalid trending response');
      return response.data.flatMap((track) => {
        if (typeof track.id !== 'string' || typeof track.title !== 'string') return [];
        return [{
          id: track.id,
          title: track.title,
          artist: track.user?.name ?? 'Unknown artist',
          thumbnail_url: track.artwork?.['480x480'] ?? track.artwork?.['150x150'] ?? null,
          stream_url: `https://discoveryprovider.audius.co/v1/tracks/${encodeURIComponent(track.id)}/stream?app_name=Nocturne`,
          media_type: 'music',
          source: 'audius',
        }];
      });
    },
    async musicRecommendations(query) {
      const url = new URL('https://discoveryprovider.audius.co/v1/tracks/search');
      url.search = new URLSearchParams({ app_name: 'Nocturne', query, limit: '12' });
      const response = await requestJson(url, 'Audius', fetchImpl);
      if (!Array.isArray(response.data)) throw new Error('Audius returned an invalid search response');
      return response.data.flatMap((track) => {
        if (typeof track.id !== 'string' || typeof track.title !== 'string') return [];
        return [{
          id: track.id,
          title: track.title,
          artist: track.user?.name ?? 'Unknown artist',
          thumbnail_url: track.artwork?.['480x480'] ?? track.artwork?.['150x150'] ?? null,
          stream_url: `https://discoveryprovider.audius.co/v1/tracks/${encodeURIComponent(track.id)}/stream?app_name=Nocturne`,
          media_type: 'music',
          source: 'audius',
        }];
      });
    },
    async nowPlaying() {
      const response = await getNowPlayingMovies();
      if (!Array.isArray(response.results)) throw new Error('TMDB returned an invalid now-playing response');
      return response.results.slice(0, 12).map((movie) => {
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
    },
    async newEpisodes() {
      const url = new URL('https://itunes.apple.com/search');
      url.search = new URLSearchParams({
        term: 'podcast',
        entity: 'podcastEpisode',
        media: 'podcast',
        limit: '50',
        sort: 'recent',
      });
      const response = await requestJson(url, 'iTunes', fetchImpl);
      if (!Array.isArray(response.results)) throw new Error('iTunes returned an invalid episode response');
      const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
      return response.results
        .filter((episode) => Number.isFinite(Date.parse(episode.releaseDate)) && Date.parse(episode.releaseDate) >= cutoff)
        .slice(0, 12)
        .flatMap((episode) => {
          if (episode.trackId === undefined || typeof episode.trackName !== 'string') return [];
          return [{
            id: String(episode.trackId),
            title: episode.trackName,
            channel: episode.artistName ?? 'Unknown channel',
            thumbnail_url: episode.artworkUrl600 ?? episode.artworkUrl100 ?? null,
            stream_url: episode.episodeUrl ?? episode.previewUrl ?? null,
            release_date: episode.releaseDate,
            media_type: 'podcast',
            source: 'itunes',
          }];
        });
    },
    async recommendations(query) {
      const items = await searchExternalMedia(query, 'podcast', { fetchImpl });
      return items.map((item) => ({
        id: item.externalId,
        title: item.title,
        channel: item.artist ?? 'Unknown channel',
        thumbnail_url: item.thumbnailUrl,
        stream_url: item.streamUrl,
        external_url: item.externalUrl,
        media_type: 'podcast',
        source: 'itunes',
      }));
    },
  };
}

function emptyTrending() {
  return { movies: [], podcasts: [], music: [] };
}

async function resolveProviderResults(entries, providerSet) {
  const settled = await Promise.allSettled(entries.map(([key]) => providerSet[key]()));
  const result = emptyTrending();
  let failed = false;
  settled.forEach((entry, index) => {
    const key = entries[index][1];
    if (entry.status === 'fulfilled') result[key] = entry.value;
    else {
      failed = true;
      console.error(`Discovery ${key} provider failed:`, entry.reason);
    }
  });
  return { result, failed };
}

async function trendingFeed(database, providerSet) {
  const cached = await database.prepare(`
    SELECT response_json AS "responseJson" FROM search_cache
    WHERE query = 'discover:trending' AND type = 'music' AND expires_at > NOW()
  `).get();
  if (cached) {
    try {
      return JSON.parse(cached.responseJson);
    } catch (error) {
      console.error('Invalid trending discovery cache entry:', error);
      await database.prepare(
        "DELETE FROM search_cache WHERE query = 'discover:trending' AND type = 'music'",
      ).run();
    }
  }
  const { result, failed } = await resolveProviderResults([
    ['movies', 'movies'],
    ['podcasts', 'podcasts'],
    ['music', 'music'],
  ], providerSet);
  if (!failed) {
    await database.prepare(`
      INSERT INTO search_cache (query, type, response_json, expires_at)
      VALUES ('discover:trending', 'music', $1, NOW() + ${CACHE_TTLS.trending})
      ON CONFLICT (query, type) DO UPDATE SET
        response_json = excluded.response_json,
        expires_at = excluded.expires_at
    `).run(JSON.stringify(result));
  }
  return result;
}

export function createDiscoverRouter({
  database,
  authenticate,
  providers = createProviders(fetch),
}) {
  const router = Router();

  router.get('/trending', async (_request, response) => {
    const trending = await trendingFeed(database, providers);
    return response.json(trending);
  });

  router.get('/new-releases', async (_request, response) => {
    const cached = await database.prepare(`
      SELECT response_json AS "responseJson" FROM search_cache
      WHERE query = 'discover:new-releases' AND type = 'podcast' AND expires_at > NOW()
    `).get();
    if (cached) {
      try {
        return response.json(JSON.parse(cached.responseJson));
      } catch (error) {
        console.error('Invalid new-releases discovery cache entry:', error);
        await database.prepare(
          "DELETE FROM search_cache WHERE query = 'discover:new-releases' AND type = 'podcast'",
        ).run();
      }
    }
    const settled = await Promise.allSettled([providers.nowPlaying(), providers.newEpisodes()]);
    const result = {
      movies: settled[0].status === 'fulfilled' ? settled[0].value : [],
      podcasts: settled[1].status === 'fulfilled' ? settled[1].value : [],
    };
    if (settled[0].status === 'rejected') console.error('New movie releases provider failed:', settled[0].reason);
    if (settled[1].status === 'rejected') console.error('New podcast releases provider failed:', settled[1].reason);
    if (settled.every((entry) => entry.status === 'fulfilled')) {
      await database.prepare(`
        INSERT INTO search_cache (query, type, response_json, expires_at)
        VALUES ('discover:new-releases', 'podcast', $1, NOW() + ${CACHE_TTLS.releases})
        ON CONFLICT (query, type) DO UPDATE SET
          response_json = excluded.response_json,
          expires_at = excluded.expires_at
      `).run(JSON.stringify(result));
    }
    return response.json(result);
  });

  router.get('/for-you', authenticate, async (request, response) => {
    const [counts, artists, saved, genres] = await Promise.all([
      database.prepare(`
        SELECT COALESCE(media_type, type) AS "mediaType", COUNT(*)::int AS count
        FROM media_library WHERE user_id = $1
        GROUP BY COALESCE(media_type, type)
        ORDER BY count DESC, "mediaType"
      `).all(request.user.id),
      database.prepare(`
        SELECT artist, COUNT(*)::int AS count
        FROM media_library
        WHERE user_id = $1 AND artist IS NOT NULL AND artist <> ''
        GROUP BY artist ORDER BY count DESC, artist LIMIT 5
      `).all(request.user.id),
      database.prepare('SELECT COUNT(*)::int AS count FROM media_library WHERE user_id = $1')
        .get(request.user.id),
      database.prepare(`
        SELECT mg.genre_id AS id, mg.genre_name AS name, COUNT(*)::int AS count
        FROM media_genres mg
        JOIN media_library m ON m.id = mg.media_library_id
        WHERE m.user_id = $1 AND m.provider = 'tmdb'
        GROUP BY mg.genre_id, mg.genre_name
        ORDER BY count DESC, mg.genre_name
        LIMIT 5
      `).all(request.user.id),
    ]);
    const trends = await trendingFeed(database, providers);
    if (saved.count < 5) {
      return response.json({
        ...trends,
        counts,
        topArtists: artists,
        topGenres: [],
        fallback: 'trending',
      });
    }
    const topArtist = artists[0]?.artist;
    let podcasts = trends.podcasts;
    if (topArtist) {
      try {
        const recommendations = await providers.recommendations(topArtist);
        if (recommendations.length) podcasts = recommendations;
      } catch (error) {
        console.error('Personalized podcast recommendations failed:', error);
      }
    }
    let movies = trends.movies;
    if (genres.length) {
      try {
        const recommendations = await getCachedGenreRecommendations(database, genres[0].id);
        if (recommendations?.length) movies = recommendations;
      } catch (error) {
        console.error('Cached movie genre recommendations failed:', error);
      }
    }
    let music = trends.music;
    if (topArtist) {
      try {
        const recommendations = await providers.musicRecommendations(topArtist);
        if (recommendations.length) music = recommendations;
      } catch (error) {
        console.error('Personalized music recommendations failed:', error);
      }
    }
    return response.json({
      movies,
      podcasts,
      music,
      counts,
      topArtists: artists,
      topGenres: genres,
      fallback: null,
    });
  });

  router.get('/public-playlists', async (request, response) => {
    const limit = request.query.limit === undefined ? 8 : Number(request.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      return response.status(400).json({ error: 'limit must be an integer from 1 to 20.' });
    }
    const playlists = await listPublicPlaylists(database, { sort: 'popular', limit, offset: 0 });
    return response.json({ playlists });
  });

  return router;
}
