import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { db, initializeDatabase, initializeUserData } from './db.js';
import { getCacheStats } from './services/cacheMetrics.js';
import musicRouter from './routes/music.js';
import moviesRouter from './routes/movies.js';
import podcastsRouter from './routes/podcasts.js';
import { createPlaylistsRouter } from './routes/playlists.js';
import { createDiscoverRouter } from './routes/discover.js';
import { createUsersRouter } from './routes/users.js';
import { createSocialRouter } from './routes/social.js';
import { createSearchUnifiedRouter } from './routes/searchUnified.js';
import { supabaseClient } from './lib/supabaseAdmin.js';

import { createAuthRouter } from './routes/authSupabase.js';
import { validateAndLoadConfig } from './config.js';
import { isOriginAllowed } from './lib/origins.js';

const config = validateAndLoadConfig();

const app = express();
const port = config.port;
if (config.trustProxy) app.set('trust proxy', 1);
const jwtSecret = config.jwtSecret;

const unifiedSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many searches. Please slow down a little.' },
});

app.disable('x-powered-by');

if (process.env.NODE_ENV === 'production') {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://www.youtube.com"],
          connectSrc: ["'self'", "https://api.themoviedb.org", "https://itunes.apple.com", "https://discoveryprovider.audius.co", "https://www.youtube.com", "https://*.supabase.co"],
          imgSrc: ["'self'", "data:", "https://image.tmdb.org", "https://is1-ssl.mzstatic.com", "https://is2-ssl.mzstatic.com", "https://is3-ssl.mzstatic.com", "https://is4-ssl.mzstatic.com", "https://is5-ssl.mzstatic.com", "https://*.mzstatic.com", "https://images.unsplash.com", "https://i.ytimg.com", "https://*.audius.co", "https://*.monophonic.digital", "https://*.open-audio-validator.com", "https:"],
          mediaSrc: ["'self'", "blob:", "https:"],
          frameSrc: ["'self'", "https://www.youtube.com", "https://w.soundcloud.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'self'"],
        },
      },
    })
  );
} else {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", "http://localhost:5173", "ws://localhost:5173"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "http://localhost:5173"],
          connectSrc: ["'self'", "http://localhost:5173", "ws://localhost:5173", "https://api.themoviedb.org", "https://itunes.apple.com", "https://discoveryprovider.audius.co", "https://www.youtube.com", "https://*.supabase.co"],
          imgSrc: ["'self'", "data:", "http://localhost:5173", "https://image.tmdb.org", "https://is1-ssl.mzstatic.com", "https://is2-ssl.mzstatic.com", "https://is3-ssl.mzstatic.com", "https://is4-ssl.mzstatic.com", "https://is5-ssl.mzstatic.com", "https://*.mzstatic.com", "https://images.unsplash.com", "https://i.ytimg.com", "https://*.audius.co", "https://*.monophonic.digital", "https://*.open-audio-validator.com", "https:"],
          mediaSrc: ["'self'", "https://*.audius.co", "https://*.mzstatic.com", "https://*.soundhelix.com", "blob:"],
          frameSrc: ["'self'", "https://www.youtube.com", "https://w.soundcloud.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "http://localhost:5173"],
          fontSrc: ["'self'", "data:", "http://localhost:5173"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'self'"],
        },
      },
    })
  );
}
app.use(cors((request, callback) => {
  const origin = request.get('origin');
  const referer = request.get('referer');
  const check = isOriginAllowed(origin, referer);
  if (!origin || check.allowed) {
    return callback(null, { origin: true, credentials: true });
  }
  return callback(new Error('Origin is not allowed by CORS'));
}));
app.use(express.json());
app.use(cookieParser());

let isDatabaseReady = false;
app.get('/api/health', (_request, response) => {
  response.status(200).json({ status: 'ok', db: isDatabaseReady ? 'connected' : 'initializing' });
});

app.use('/api', (request, response, next) => {
  if (request.path === '/health' || request.path === '/health/' || request.path === '/api/health') {
    return next();
  }
  if (!isDatabaseReady) {
    return response.status(503).json({ error: 'Database is starting up, please try again shortly.' });
  }
  next();
});

const sessionCookie = 'nocturne_session';
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

async function authenticate(request, response, next) {
  const publicPaths = [
    '/auth/signup',
    '/auth/signin',
    '/auth/signin/google',
    '/auth/signin/facebook',
    '/auth/callback',
    '/auth/verify-email',
    '/auth/verify-email/resend',
    '/auth/reset-password',
    '/auth/reset-password/confirm',
    '/auth/magic-link',
  ];
  const isPublicAuthPath = publicPaths.includes(request.path) ||
    request.path.startsWith('/auth/signin/') ||
    request.path.startsWith('/auth/verify-email/');

  if (isPublicAuthPath) {
    return next();
  }

  const publicPlaylistRead = request.method === 'GET' && (
    request.path === '/playlists/public' || /^\/playlists\/\d+$/.test(request.path)
  );
  const publicUserRead = request.method === 'GET' &&
    /^\/users\/[^/]+(?:\/(?:playlists|followers|following|liked))?$/.test(request.path) &&
    request.path !== '/users/me';
  const publicMediaRead = request.method === 'GET' &&
    /^\/media\/[^/]+\/(?:likes|comments)$/.test(request.path);

  const publicMovieRead = request.method === 'GET' && (
    request.path === '/movies' ||
    request.path.startsWith('/movies/') ||
    request.path.startsWith('/tv/')
  );

  const publicDiscoverRead = request.method === 'GET' && (
    request.path === '/discover/trending' ||
    request.path === '/discover/new-releases' ||
    request.path === '/discover/public-playlists'
  );

  const publicMediaSearch = request.method === 'GET' && (
    request.path === '/search/unified' ||
    request.path === '/search/suggest' ||
    request.path === '/podcasts/search' ||
    request.path === '/podcasts/video-search' ||
    request.path === '/music/random-audius'
  );

  const isPublicGet = publicPlaylistRead || publicUserRead || publicMediaRead || publicMovieRead || publicDiscoverRead || publicMediaSearch;
  
  const sessionId = request.cookies[sessionCookie];
  if (!sessionId) {
    if (isPublicGet) return next();
    return response.status(401).json({ error: 'Please log in to continue' });
  }

  const session = await db.prepare(`
    SELECT id, user_id AS "userId", refresh_token AS "refreshToken", access_token_expires_at AS "expiresAt"
    FROM sessions WHERE id = $1
  `).get(sessionId);

  if (!session) {
    response.clearCookie(sessionCookie, cookieOptions);
    if (isPublicGet) return next();
    return response.status(401).json({ error: 'Please log in to continue' });
  }

  let userId = session.userId;
  const now = new Date();
  const expiresAt = new Date(session.expiresAt);

  if (expiresAt <= now) {
    try {
      const { data, error } = await supabaseClient.auth.refreshSession({ refresh_token: session.refreshToken });
      if (error || !data?.session) {
        await db.prepare('DELETE FROM sessions WHERE id = $1').run(sessionId);
        response.clearCookie(sessionCookie, cookieOptions);
        if (isPublicGet) return next();
        return response.status(401).json({ error: 'Please log in to continue' });
      }
      const newExpiresAt = new Date(Date.now() + (data.session.expires_in || 3600) * 1000).toISOString();
      await db.prepare(`
        UPDATE sessions SET refresh_token = $1, access_token_expires_at = $2, last_used_at = NOW() WHERE id = $3
      `).run(data.session.refresh_token, newExpiresAt, sessionId);
    } catch {
      await db.prepare('DELETE FROM sessions WHERE id = $1').run(sessionId);
      response.clearCookie(sessionCookie, cookieOptions);
      if (isPublicGet) return next();
      return response.status(401).json({ error: 'Please log in to continue' });
    }
  } else {
    await db.prepare('UPDATE sessions SET last_used_at = NOW() WHERE id = $1').run(sessionId);
  }

  const user = await db.prepare(`
    SELECT id, email, display_name AS "displayName", deleted_at AS "deletedAt"
    FROM users
    WHERE id = $1 OR supabase_uid = $1
    LIMIT 1
  `).get(userId);

  if (!user || (user.deletedAt && !(
    request.method === 'GET' &&
    request.path === `/users/${encodeURIComponent(userId)}`
  ))) {
    return response.status(401).json({ error: 'Your account is no longer available' });
  }

  request.user = user;
  return next();
}

async function getMixes() {
  const mixes = await db.prepare('SELECT * FROM music_mixes ORDER BY sort_order').all();
  const tracks = await db.prepare(`
    SELECT id, mix_id, title, artist, duration_seconds AS seconds, cover
    FROM music_tracks
    ORDER BY mix_id, position
  `).all();
  const tracksByMix = new Map();
  for (const track of tracks) {
    const mixTracks = tracksByMix.get(track.mix_id) ?? [];
    mixTracks.push({
      id: track.id,
      title: track.title,
      artist: track.artist,
      seconds: track.seconds,
      cover: track.cover,
    });
    tracksByMix.set(track.mix_id, mixTracks);
  }

  return mixes.map((mix) => ({
    id: mix.id,
    title: mix.title,
    note: mix.note,
    cover: mix.cover,
    tags: JSON.parse(mix.tags_json),
    tracks: tracksByMix.get(mix.id) ?? [],
  }));
}

async function getNowPlaying(userId) {
  const state = await db.prepare(`
    SELECT s.is_playing, s.progress_seconds, m.id AS mix_id, m.title AS mix_title,
      m.note AS mix_note, m.cover AS mix_cover, t.id AS track_id, t.title AS track_title,
      t.artist, t.duration_seconds AS seconds, t.cover AS track_cover
    FROM now_playing_states s
    JOIN music_mixes m ON m.id = s.mix_id
    JOIN music_tracks t ON t.id = s.track_id AND t.mix_id = s.mix_id
    WHERE s.user_id = $1
  `).get(userId);

  if (!state) return null;
  return {
    mix: {
      id: state.mix_id,
      title: state.mix_title,
      note: state.mix_note,
      cover: state.mix_cover,
    },
    track: {
      id: state.track_id,
      title: state.track_title,
      artist: state.artist,
      seconds: state.seconds,
      cover: state.track_cover,
    },
    isPlaying: Boolean(state.is_playing),
    progressSeconds: state.progress_seconds,
  };
}

function podcastEpisodeQuery() {
  return `
    SELECT e.id, e.show_id AS "showId", e.title, e.summary,
      e.duration_seconds AS seconds, e.published, e.season,
      e.episode_number AS number, e.audio_url AS "audioUrl",
      s.title AS "showTitle", s.host AS "showHost", s.art AS "showArt",
      CASE WHEN saved.episode_id IS NULL THEN 0 ELSE 1 END AS "isSaved"
    FROM podcast_episodes e
    JOIN podcast_shows s ON s.id = e.show_id
    LEFT JOIN podcast_listen_later saved
      ON saved.episode_id = e.id AND saved.user_id = $1
  `;
}

async function getPodcastEpisodes({ userId, showId = null, savedOnly = false }) {
  return (await db.prepare(`
    ${podcastEpisodeQuery()}
    WHERE ($2::text IS NULL OR e.show_id = $2)
      AND (NOT $3::boolean OR saved.episode_id IS NOT NULL)
    ORDER BY e.sort_order ASC
  `).all(userId, showId, savedOnly)).map((episode) => ({
    ...episode,
    isSaved: Boolean(episode.isSaved),
  }));
}

async function getPodcastEpisode(episodeId, userId) {
  return db.prepare(`
    ${podcastEpisodeQuery()}
    WHERE e.id = $2
  `).get(userId, episodeId);
}

async function getJournalEntry(entryId, userId) {
  return db.prepare(`
    SELECT id, entry_date AS "entryDate", human_date AS date, mood, song, artist, note, photo, rating
    FROM journal_entries WHERE id = $1 AND user_id = $2
  `).get(entryId, userId);
}

function mapDatingProfile(profile) {
  if (!profile) return null;
  return {
    ...profile,
    interests: JSON.parse(profile.interests_json),
    distanceKm: profile.distance_km,
    prompt: { question: profile.prompt_question, answer: profile.prompt_answer },
    lastActive: profile.last_active,
    interests_json: undefined,
    distance_km: undefined,
    prompt_question: undefined,
    prompt_answer: undefined,
    last_active: undefined,
  };
}

async function getDatingMessages(profileId, userId) {
  return db.prepare(`
    SELECT id, sender AS "from", text, created_at AS at
    FROM dating_messages
    WHERE user_id = $1 AND profile_id = $2
    ORDER BY sort_order
  `).all(userId, profileId);
}

async function listJournalEntries(userId, mood = null) {
  return db.prepare(`
    SELECT id, entry_date AS "entryDate", human_date AS date, mood, song, artist, note, photo, rating
    FROM journal_entries
    WHERE user_id = $1 AND ($2::text IS NULL OR mood = $2)
    ORDER BY entry_date DESC, created_at DESC
  `).all(userId, mood);
}

app.get('/api/admin/cache-stats', (request, response) => {
  const adminToken = process.env.ADMIN_TOKEN;
  const headerToken = request.headers['x-admin-token'];
  if (!adminToken || headerToken !== adminToken) {
    return response.status(401).json({ error: 'Unauthorized: valid ADMIN_TOKEN required' });
  }
  return response.json(getCacheStats());
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Take a breath and try again in a little while.' },
});

app.use('/api/auth', authLimiter, createAuthRouter({
  database: db,
  jwtSecret,
  cookieOptions,
  sessionCookie,
  initializeUserData,
}));
app.all('/api/auth/register', (req, res) => res.status(410).json({ error: 'Endpoint deprecated. Please use /api/auth/signup' }));
app.all('/api/auth/login', (req, res) => res.status(410).json({ error: 'Endpoint deprecated. Please use /api/auth/signin' }));
app.all('/api/auth/logout', (req, res) => res.status(410).json({ error: 'Endpoint deprecated. Please use /api/auth/signout' }));

app.use('/api/discover', createDiscoverRouter({ database: db, authenticate }));
app.use('/api/search', unifiedSearchLimiter, createSearchUnifiedRouter({ database: db }));
app.use('/api', authenticate);
app.use('/api/users', createUsersRouter({ database: db, authenticate }));
app.use('/api', createSocialRouter({ database: db, authenticate }));
app.use('/api/music', musicRouter);
app.use('/api/movies', moviesRouter);
app.use('/api/podcasts', podcastsRouter);
app.use('/api/playlists', createPlaylistsRouter({ database: db, authenticate }));

app.get('/api/library', async (request, response) => {
  const items = await db.prepare(`
    SELECT id, type, provider, external_id AS "externalId", title, artist,
      thumbnail_url AS "thumbnailUrl", stream_url AS "streamUrl",
      external_url AS "externalUrl", media_type AS "mediaType",
      duration_seconds AS "durationSeconds", created_at AS "createdAt"
    FROM media_library WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
  `).all(request.user.id);
  return response.json({ items });
});

app.post('/api/library/save', async (request, response) => {
  const {
    type, provider, externalId, title, artist = null,
    thumbnailUrl = null, streamUrl, externalUrl = null,
  } = request.body ?? {};
  const validUrl = (value, required = false) => {
    if (value === null || value === undefined) return !required;
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  };
  if (
    !['video', 'podcast', 'audio'].includes(type) ||
    !['youtube', 'itunes'].includes(provider) ||
    (provider === 'youtube' && type !== 'video') ||
    (provider === 'itunes' && type === 'video') ||
    typeof externalId !== 'string' || !externalId.trim() || externalId.length > 200 ||
    typeof title !== 'string' || !title.trim() || title.length > 300 ||
    (artist !== null && (typeof artist !== 'string' || artist.length > 300)) ||
    !validUrl(thumbnailUrl) || !validUrl(streamUrl, true) || !validUrl(externalUrl)
  ) {
    return response.status(400).json({ error: 'Provide valid media metadata and secure HTTPS URLs' });
  }

  const id = randomUUID();
  const saved = await db.prepare(`
    INSERT INTO media_library
      (id, user_id, type, provider, external_id, title, artist, thumbnail_url, stream_url, external_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`).run(
    id, request.user.id, type, provider, externalId.trim(), title.trim(),
    artist?.trim() || null, thumbnailUrl, streamUrl, externalUrl,
  );
  const item = await db.prepare(`
    SELECT id, type, provider, external_id AS "externalId", title, artist,
      thumbnail_url AS "thumbnailUrl", stream_url AS "streamUrl",
      external_url AS "externalUrl", media_type AS "mediaType",
      duration_seconds AS "durationSeconds", created_at AS "createdAt"
    FROM media_library WHERE user_id = $1 AND provider = $2 AND external_id = $3
  `).get(request.user.id, provider, externalId.trim());
  return response.status(saved.changes ? 201 : 200).json({ item, alreadySaved: !saved.changes });
});

app.delete('/api/library/:itemId', async (request, response) => {
  const result = await db.prepare('DELETE FROM media_library WHERE id = $1 AND user_id = $2')
    .run(request.params.itemId, request.user.id);
  if (!result.changes) return response.status(404).json({ error: 'Library item not found' });
  return response.status(204).end();
});

app.get('/api/music/mixes', async (_request, response) => {
  response.json({ mixes: await getMixes() });
});

app.get('/api/music/mixes/:mixId', async (request, response) => {
  const mix = (await getMixes()).find((item) => item.id === request.params.mixId);
  if (!mix) return response.status(404).json({ error: 'Mix not found' });
  return response.json({ mix });
});

app.get('/api/music/now-playing', async (request, response) => {
  const nowPlaying = await getNowPlaying(request.user.id);
  if (!nowPlaying) return response.status(404).json({ error: 'Now-playing state not found' });
  return response.json({ nowPlaying });
});

app.put('/api/music/now-playing', async (request, response) => {
  const { trackId, mixId, isPlaying, progressSeconds = 0 } = request.body ?? {};
  if (
    typeof trackId !== 'string' ||
    typeof mixId !== 'string' ||
    typeof isPlaying !== 'boolean' ||
    !Number.isInteger(progressSeconds) ||
    progressSeconds < 0
  ) {
    return response.status(400).json({
      error: 'A valid trackId, mixId and isPlaying are required; progressSeconds must be a non-negative integer',
    });
  }

  const track = await db.prepare(`
    SELECT duration_seconds FROM music_tracks WHERE id = $1 AND mix_id = $2
  `).get(trackId, mixId);
  if (!track) return response.status(404).json({ error: 'Track not found in that mix' });
  if (progressSeconds > track.duration_seconds) {
    return response.status(400).json({ error: 'Progress cannot exceed the track duration' });
  }

  await db.prepare(`
    INSERT INTO now_playing_states
      (user_id, mix_id, track_id, is_playing, progress_seconds, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT(user_id) DO UPDATE SET
      mix_id = excluded.mix_id,
      track_id = excluded.track_id,
      is_playing = excluded.is_playing,
      progress_seconds = excluded.progress_seconds,
      updated_at = excluded.updated_at
  `).run(request.user.id, mixId, trackId, isPlaying, progressSeconds);

  return response.json({ nowPlaying: await getNowPlaying(request.user.id) });
});

app.get('/api/music/swipes', async (request, response) => {
  const swipes = await db.prepare(`
    SELECT mix_id AS "mixId", action, created_at AS "createdAt"
    FROM mix_swipes WHERE user_id = $1 ORDER BY created_at, mix_id
  `).all(request.user.id);
  return response.json({ swipes });
});

app.post('/api/music/swipes', async (request, response) => {
  const { mixId, action } = request.body ?? {};
  if (typeof mixId !== 'string' || !['like', 'pass'].includes(action)) {
    return response.status(400).json({ error: 'A valid mixId and action ("like" or "pass") are required' });
  }
  if (!await db.prepare('SELECT 1 FROM music_mixes WHERE id = $1').get(mixId)) {
    return response.status(404).json({ error: 'Mix not found' });
  }

  await db.prepare(`
    INSERT INTO mix_swipes (user_id, mix_id, action)
    VALUES ($1, $2, $3)
    ON CONFLICT(user_id, mix_id) DO UPDATE SET
      action = excluded.action, created_at = NOW()
  `).run(request.user.id, mixId, action);

  return response.status(201).json({ mixId, action });
});

app.get('/api/podcasts/shows', async (_request, response) => {
  const shows = await db.prepare(`
    SELECT s.id, s.title, s.host, s.blurb, s.art, s.cadence,
      COUNT(e.id) AS "episodeCount"
    FROM podcast_shows s
    LEFT JOIN podcast_episodes e ON e.show_id = s.id
    GROUP BY s.id
    ORDER BY s.sort_order
  `).all();
  return response.json({ shows });
});

app.get('/api/podcasts/shows/:showId', async (request, response) => {
  const show = await db.prepare(`
    SELECT s.id, s.title, s.host, s.blurb, s.art, s.cadence,
      COUNT(e.id) AS "episodeCount"
    FROM podcast_shows s
    LEFT JOIN podcast_episodes e ON e.show_id = s.id
    WHERE s.id = $1
    GROUP BY s.id
  `).get(request.params.showId);
  if (!show) return response.status(404).json({ error: 'Podcast show not found' });
  return response.json({ show, episodes: await getPodcastEpisodes({ userId: request.user.id, showId: show.id }) });
});

app.get('/api/podcasts/episodes', async (request, response) => {
  const showId = typeof request.query.showId === 'string' ? request.query.showId : null;
  return response.json({ episodes: await getPodcastEpisodes({ userId: request.user.id, showId }) });
});

app.get('/api/podcasts/episodes/:episodeId', async (request, response) => {
  const episode = await getPodcastEpisode(request.params.episodeId, request.user.id);
  if (!episode) return response.status(404).json({ error: 'Podcast episode not found' });
  return response.json({ episode: { ...episode, isSaved: Boolean(episode.isSaved) } });
});

app.get('/api/podcasts/listen-later', async (request, response) => {
  return response.json({ episodes: await getPodcastEpisodes({ userId: request.user.id, savedOnly: true }) });
});

app.post('/api/podcasts/listen-later', async (request, response) => {
  const { episodeId } = request.body ?? {};
  if (typeof episodeId !== 'string') {
    return response.status(400).json({ error: 'A valid episodeId is required' });
  }
  if (!await db.prepare('SELECT 1 FROM podcast_episodes WHERE id = $1').get(episodeId)) {
    return response.status(404).json({ error: 'Podcast episode not found' });
  }
  await db.prepare(`
    INSERT INTO podcast_listen_later (user_id, episode_id)
    VALUES ($1, $2) ON CONFLICT DO NOTHING`).run(request.user.id, episodeId);
  return response.status(201).json({ episodeId, saved: true });
});

app.delete('/api/podcasts/listen-later/:episodeId', async (request, response) => {
  const result = await db.prepare(`
    DELETE FROM podcast_listen_later WHERE user_id = $1 AND episode_id = $2
  `).run(request.user.id, request.params.episodeId);
  if (!result.changes) return response.status(404).json({ error: 'Saved episode not found' });
  return response.json({ episodeId: request.params.episodeId, saved: false });
});

app.get('/api/podcasts/now-playing', async (request, response) => {
  const state = await db.prepare(`
    SELECT p.episode_id AS "episodeId", p.is_playing AS "isPlaying",
      p.progress_seconds AS "progressSeconds", e.duration_seconds AS seconds,
      e.title, e.summary, e.published, e.season, e.episode_number AS number,
      e.audio_url AS "audioUrl", e.show_id AS "showId", s.title AS "showTitle",
      s.host AS "showHost", s.art AS "showArt"
    FROM podcast_player_states p
    JOIN podcast_episodes e ON e.id = p.episode_id
    JOIN podcast_shows s ON s.id = e.show_id
    WHERE p.user_id = $1
  `).get(request.user.id);
  if (!state) return response.status(404).json({ error: 'Podcast player state not found' });
  return response.json({
    nowPlaying: {
      ...state,
      isPlaying: Boolean(state.isPlaying),
      episode: {
        id: state.episodeId,
        showId: state.showId,
        title: state.title,
        summary: state.summary,
        seconds: state.seconds,
        published: state.published,
        season: state.season,
        number: state.number,
        audioUrl: state.audioUrl,
        showTitle: state.showTitle,
        showHost: state.showHost,
        showArt: state.showArt,
      },
    },
  });
});

app.put('/api/podcasts/now-playing', async (request, response) => {
  const { episodeId, isPlaying, progressSeconds = 0 } = request.body ?? {};
  if (
    typeof episodeId !== 'string' ||
    typeof isPlaying !== 'boolean' ||
    !Number.isInteger(progressSeconds) ||
    progressSeconds < 0
  ) {
    return response.status(400).json({ error: 'A valid episodeId, isPlaying and progressSeconds are required' });
  }
  const episode = await db.prepare(`
    SELECT duration_seconds FROM podcast_episodes WHERE id = $1
  `).get(episodeId);
  if (!episode) return response.status(404).json({ error: 'Podcast episode not found' });
  if (progressSeconds > episode.duration_seconds) {
    return response.status(400).json({ error: 'Progress cannot exceed the episode duration' });
  }
  await db.prepare(`
    INSERT INTO podcast_player_states
      (user_id, episode_id, is_playing, progress_seconds, updated_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT(user_id) DO UPDATE SET
      episode_id = excluded.episode_id,
      is_playing = excluded.is_playing,
      progress_seconds = excluded.progress_seconds,
      updated_at = excluded.updated_at
  `).run(request.user.id, episodeId, isPlaying, progressSeconds);
  return response.json({ nowPlaying: await getPodcastPlayerState(request.user.id) });
});

app.get('/api/journal/entries', async (request, response) => {
  const mood = typeof request.query.mood === 'string' ? request.query.mood : null;
  const validMoods = ['tender', 'restless', 'quiet', 'hopeful', 'wrecked'];
  if (mood && !validMoods.includes(mood)) {
    return response.status(400).json({ error: 'Mood must be tender, restless, quiet, hopeful, or wrecked' });
  }
  return response.json({ entries: await listJournalEntries(request.user.id, mood) });
});

app.get('/api/journal/entries/:entryId', async (request, response) => {
  const entry = await getJournalEntry(request.params.entryId, request.user.id);
  if (!entry) return response.status(404).json({ error: 'Journal entry not found' });
  return response.json({ entry });
});

app.post('/api/journal/entries', async (request, response) => {
  const { entryDate, mood, song, artist, note, photo = null, rating } = request.body ?? {};
  const validMoods = ['tender', 'restless', 'quiet', 'hopeful', 'wrecked'];
  if (
    typeof entryDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(entryDate) ||
    Number.isNaN(Date.parse(`${entryDate}T00:00:00Z`)) ||
    !validMoods.includes(mood) ||
    typeof song !== 'string' ||
    !song.trim() ||
    song.length > 140 ||
    typeof artist !== 'string' ||
    !artist.trim() ||
    artist.length > 140 ||
    typeof note !== 'string' ||
    note.length > 800 ||
    (photo !== null && (typeof photo !== 'string' || photo.length > 160)) ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return response.status(400).json({ error: 'Provide a valid date, mood, song, artist, note, photo and rating (1–5)' });
  }

  const humanDate = new Intl.DateTimeFormat('en', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${entryDate}T12:00:00Z`));
  const entryId = `j-${entryDate}`;
  await db.prepare(`
    INSERT INTO journal_entries
      (id, user_id, entry_date, human_date, mood, song, artist, note, photo, rating)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT(user_id, entry_date) DO UPDATE SET
      human_date = excluded.human_date,
      mood = excluded.mood,
      song = excluded.song,
      artist = excluded.artist,
      note = excluded.note,
      photo = excluded.photo,
      rating = excluded.rating
  `).run(entryId, request.user.id, entryDate, humanDate, mood, song.trim(), artist.trim(), note.trim(), photo, rating);

  const entry = await db.prepare(`
    SELECT id, entry_date AS "entryDate", human_date AS date, mood, song, artist, note, photo, rating
    FROM journal_entries WHERE user_id = $1 AND entry_date = $2
  `).get(request.user.id, entryDate);
  return response.status(201).json({ entry });
});

app.get('/api/journal/stats', async (request, response) => {
  const summary = await db.prepare(`
    SELECT COUNT(*) AS entries, COUNT(DISTINCT song || '|' || artist) AS songs,
      COALESCE(ROUND(AVG(rating), 1), 0) AS "averageRating"
    FROM journal_entries WHERE user_id = $1
  `).get(request.user.id);
  const moodCounts = await db.prepare(`
    SELECT mood, COUNT(*) AS count FROM journal_entries
    WHERE user_id = $1 GROUP BY mood ORDER BY count DESC, mood
  `).all(request.user.id);
  const dates = (await db.prepare(`
    SELECT entry_date AS "entryDate" FROM journal_entries
    WHERE user_id = $1 ORDER BY entry_date DESC
  `).all(request.user.id)).map((row) => row.entryDate);
  let streakDays = 0;
  if (dates.length) {
    const today = new Date();
    const expected = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    for (const date of dates) {
      if (Date.parse(`${date}T00:00:00Z`) !== expected - streakDays * 86_400_000) break;
      streakDays += 1;
    }
  }
  return response.json({ ...summary, streakDays, moodCounts });
});

app.get('/api/dating/profile', async (request, response) => {
  const profile = await db.prepare(`
    SELECT name, age, headline, bio, song, interests_json AS "interestsJson"
    FROM dating_user_profiles WHERE user_id = $1
  `).get(request.user.id);
  if (!profile) return response.status(404).json({ error: 'Your dating profile was not found' });
  return response.json({ profile: { ...profile, interests: JSON.parse(profile.interestsJson), interestsJson: undefined } });
});

app.put('/api/dating/profile', async (request, response) => {
  const { name, age, headline, bio, song, interests } = request.body ?? {};
  if (
    typeof name !== 'string' || !name.trim() || name.length > 80 ||
    !Number.isInteger(age) || age < 18 || age > 99 ||
    typeof headline !== 'string' || !headline.trim() || headline.length > 160 ||
    typeof bio !== 'string' || bio.length > 800 ||
    typeof song !== 'string' || song.length > 160 ||
    !Array.isArray(interests) ||
    interests.length > 12 ||
    interests.some((interest) => typeof interest !== 'string' || !interest.trim() || interest.length > 40)
  ) {
    return response.status(400).json({ error: 'Provide a name, age 18+, headline, bio, song and up to 12 interests' });
  }
  await db.prepare(`
    INSERT INTO dating_user_profiles (user_id, name, age, headline, bio, song, interests_json, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT(user_id) DO UPDATE SET
      name = excluded.name, age = excluded.age, headline = excluded.headline,
      bio = excluded.bio, song = excluded.song, interests_json = excluded.interests_json,
      updated_at = excluded.updated_at
  `).run(request.user.id, name.trim(), age, headline.trim(), bio.trim(), song.trim(), JSON.stringify(interests));
  const profile = await db.prepare(`
    SELECT name, age, headline, bio, song, interests_json AS "interestsJson"
    FROM dating_user_profiles WHERE user_id = $1
  `).get(request.user.id);
  return response.json({ profile: { ...profile, interests: JSON.parse(profile.interestsJson), interestsJson: undefined } });
});

app.get('/api/dating/preferences', async (request, response) => {
  const preferences = await db.prepare(`
    SELECT answers_json AS "answersJson", completed_at AS "completedAt"
    FROM dating_preferences WHERE user_id = $1
  `).get(request.user.id);
  return response.json({
    answers: preferences ? JSON.parse(preferences.answersJson) : {},
    completed: Boolean(preferences?.completedAt),
  });
});

app.put('/api/dating/preferences', async (request, response) => {
  const { answers } = request.body ?? {};
  const requiredPrompts = ['late', 'sound', 'room'];
  if (
    typeof answers !== 'object' ||
    answers === null ||
    Array.isArray(answers) ||
    requiredPrompts.some((key) => typeof answers[key] !== 'string' || !answers[key].trim() || answers[key].length > 100)
  ) {
    return response.status(400).json({ error: 'Answer the late, sound and room prompts before continuing' });
  }
  await db.prepare(`
    INSERT INTO dating_preferences (user_id, answers_json, completed_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT(user_id) DO UPDATE SET answers_json = excluded.answers_json, completed_at = excluded.completed_at
  `).run(request.user.id, JSON.stringify(answers));
  return response.json({ answers, completed: true });
});

app.get('/api/dating/profiles', async (request, response) => {
  const profiles = (await db.prepare(`
    SELECT p.* FROM dating_profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM dating_swipes sw
      WHERE sw.user_id = $1 AND sw.profile_id = p.id
    )
    ORDER BY p.sort_order
  `).all(request.user.id)).map(mapDatingProfile);
  return response.json({ profiles });
});

app.get('/api/dating/profiles/:profileId', async (request, response) => {
  const profile = mapDatingProfile(await db.prepare('SELECT * FROM dating_profiles WHERE id = $1').get(request.params.profileId));
  if (!profile) return response.status(404).json({ error: 'Profile not found' });
  return response.json({ profile });
});

app.post('/api/dating/swipes', async (request, response) => {
  const { profileId, action } = request.body ?? {};
  if (typeof profileId !== 'string' || !['like', 'pass'].includes(action)) {
    return response.status(400).json({ error: 'Provide a profileId and action ("like" or "pass")' });
  }
  if (!await db.prepare('SELECT 1 FROM dating_profiles WHERE id = $1').get(profileId)) {
    return response.status(404).json({ error: 'Profile not found' });
  }
  await db.prepare(`
    INSERT INTO dating_swipes (user_id, profile_id, action)
    VALUES ($1, $2, $3)
    ON CONFLICT(user_id, profile_id) DO UPDATE SET action = excluded.action, created_at = NOW()
  `).run(request.user.id, profileId, action);
  if (action === 'like') {
    await db.prepare('INSERT INTO dating_matches (user_id, profile_id) VALUES ($1, $2) ON CONFLICT DO NOTHING').run(request.user.id, profileId);
  }
  return response.status(201).json({
    profileId,
    action,
    matched: action === 'like' && Boolean(await db.prepare(
      'SELECT 1 FROM dating_matches WHERE user_id = $1 AND profile_id = $2',
    ).get(request.user.id, profileId)),
  });
});

app.get('/api/dating/matches', async (request, response) => {
  const matchRows = await db.prepare(`
    SELECT p.id, p.name, p.age, p.distance_km AS "distanceKm",
      p.headline, p.bio, p.interests_json AS "interestsJson", p.song, p.photo,
      p.prompt_question AS "promptQuestion", p.prompt_answer AS "promptAnswer",
      p.last_active AS "lastActive", m.matched_at AS "matchedAt",
      (SELECT text FROM dating_messages msg WHERE msg.user_id = m.user_id
        AND msg.profile_id = p.id ORDER BY msg.sort_order DESC LIMIT 1) AS "lastMessage"
    FROM dating_matches m JOIN dating_profiles p ON p.id = m.profile_id
    WHERE m.user_id = $1
    ORDER BY m.matched_at DESC, p.name
  `).all(request.user.id);
  const matches = await Promise.all(matchRows.map(async (profile) => ({
    ...profile,
    interests: JSON.parse(profile.interestsJson),
    prompt: { question: profile.promptQuestion, answer: profile.promptAnswer },
    interestsJson: undefined,
    promptQuestion: undefined,
    promptAnswer: undefined,
    unread: (await db.prepare(`
      SELECT COUNT(*) AS count FROM dating_messages
      WHERE user_id = $1 AND profile_id = $2 AND sender = 'them'
    `).get(request.user.id, profile.id)).count,
  })));
  return response.json({ matches });
});

app.get('/api/dating/matches/:profileId/messages', async (request, response) => {
  const matched = await db.prepare('SELECT 1 FROM dating_matches WHERE user_id = $1 AND profile_id = $2')
    .get(request.user.id, request.params.profileId);
  if (!matched) return response.status(404).json({ error: 'Match not found' });
  return response.json({ messages: await getDatingMessages(request.params.profileId, request.user.id) });
});

app.post('/api/dating/matches/:profileId/messages', async (request, response) => {
  const matched = await db.prepare('SELECT 1 FROM dating_matches WHERE user_id = $1 AND profile_id = $2')
    .get(request.user.id, request.params.profileId);
  if (!matched) return response.status(404).json({ error: 'Match not found' });
  const { text } = request.body ?? {};
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 1000) {
    return response.status(400).json({ error: 'A message between 1 and 1000 characters is required' });
  }
  const id = randomUUID();
  await db.prepare(`
    INSERT INTO dating_messages (id, user_id, profile_id, sender, text)
    VALUES ($1, $2, $3, 'me', $4)
  `).run(id, request.user.id, request.params.profileId, text.trim());
  return response.status(201).json({
    message: await db.prepare(`
      SELECT id, sender AS "from", text, created_at AS at FROM dating_messages WHERE id = $1
    `).get(id),
  });
});

async function getPodcastPlayerState(userId) {
  const state = await db.prepare(`
    SELECT p.episode_id AS "episodeId", p.is_playing AS "isPlaying",
      p.progress_seconds AS "progressSeconds", e.duration_seconds AS seconds,
      e.title, e.summary, e.published, e.season, e.episode_number AS number,
      e.audio_url AS "audioUrl", e.show_id AS "showId", s.title AS "showTitle",
      s.host AS "showHost", s.art AS "showArt"
    FROM podcast_player_states p
    JOIN podcast_episodes e ON e.id = p.episode_id
    JOIN podcast_shows s ON s.id = e.show_id
    WHERE p.user_id = $1
  `).get(userId);
  return {
    ...state,
    isPlaying: Boolean(state.isPlaying),
    episode: {
      id: state.episodeId,
      showId: state.showId,
      title: state.title,
      summary: state.summary,
      seconds: state.seconds,
      published: state.published,
      season: state.season,
      number: state.number,
      audioUrl: state.audioUrl,
      showTitle: state.showTitle,
      showHost: state.showHost,
      showArt: state.showArt,
    },
  };
}

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API route not found' });
});

if (process.env.NODE_ENV === 'production') {
  const frontendPath = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
  if (!existsSync(resolve(frontendPath, 'index.html'))) {
    throw new Error(`Built frontend not found at ${frontendPath}. Run npm run build before starting production.`);
  }
  app.use(express.static(frontendPath, {
    index: false,
    maxAge: '1h',
    setHeaders(response, path) {
      if (path.endsWith('index.html')) response.setHeader('Cache-Control', 'no-cache');
      else if (path.includes('/assets/')) response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));
  app.get('/{*path}', (_request, response) => {
    response.sendFile(resolve(frontendPath, 'index.html'), {
      headers: { 'Cache-Control': 'no-cache' },
    });
  });
}

app.use((err, req, res, next) => {
  console.error('[express] unhandled error:', {
    url: req.originalUrl,
    method: req.method,
    message: err.message,
    stack: err.stack
  });
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }
 return res.status(500).json({
  error: 'internal_error',
  ...(process.env.NODE_ENV !== 'production' && { message: err.message }),
});
});

const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
const server = app.listen(port, host);
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] Port ${port} is already in use. Please stop the existing process or set PORT.`);
    process.exit(1);
  } else {
    console.error(err);
    process.exit(1);
  }
});
server.on('listening', async () => {
  const activePort = server.address()?.port ?? port;
  console.log(`BEDROOM POP server listening on http://${host}:${activePort}`);
  try {
    await initializeDatabase();
    isDatabaseReady = true;
    console.info('[db] Database initialized successfully and ready for traffic.');
  } catch (err) {
    console.error('[db] Failed to initialize database:', err.message);
    process.exit(1);
  }
});

const shutdown = async (signal) => {
  console.info(`[server] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await db.close();
      console.info('[server] Database pool closed. Bye!');
      process.exit(0);
    } catch (err) {
      console.error('[server] Error closing database pool:', err);
      process.exit(1);
    }
  });
  setTimeout(() => {
    console.error('[server] Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
