import 'dotenv/config';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { db, initializeDatabase, initializeUserData } from './db.js';
import { MediaSearchError, searchExternalMedia } from './mediaSearch.js';
import musicRouter from './routes/music.js';
import moviesRouter from './routes/movies.js';
import podcastsRouter from './routes/podcasts.js';
import { createPlaylistsRouter } from './routes/playlists.js';

const app = express();
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a random secret of at least 32 characters.');
}

const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors((request, callback) => {
  const origin = request.get('origin');
  const requestOrigin = `${request.protocol}://${request.get('host')}`;
  if (!origin || origin === requestOrigin || allowedOrigins.includes(origin)) {
    return callback(null, { origin: true, credentials: true });
  }
  return callback(new Error('Origin is not allowed by CORS'));
}));
app.use(express.json());
app.use(cookieParser());

const sessionCookie = 'nocturne_session';
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

async function issueSession(response, user) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)')
    .run(sessionId, user.id, expiresAt);
  const token = jwt.sign(
    { email: user.email, displayName: user.displayName },
    jwtSecret,
    { subject: user.id, jwtid: sessionId, expiresIn: '7d', issuer: 'bedroom-pop' },
  );
  response.cookie(sessionCookie, token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function authenticate(request, response, next) {
  const publicPlaylistRead = request.method === 'GET' && (
    request.path === '/playlists/public' || /^\/playlists\/\d+$/.test(request.path)
  );
  const token = request.cookies[sessionCookie];
  if (!token) {
    if (publicPlaylistRead) return next();
    return response.status(401).json({ error: 'Please log in to continue' });
  }
  let claims;
  try {
    claims = jwt.verify(token, jwtSecret, { issuer: 'bedroom-pop' });
  } catch {
    response.clearCookie(sessionCookie, cookieOptions);
    return response.status(401).json({ error: 'Your session expired. Please log in again.' });
  }
  if (typeof claims !== 'object' || typeof claims.sub !== 'string' || typeof claims.jti !== 'string') {
    return response.status(401).json({ error: 'Your session is invalid. Please log in again.' });
  }
  const session = await db.prepare(`
    SELECT 1 FROM auth_sessions WHERE id = $1 AND user_id = $2 AND expires_at > NOW()
  `).get(claims.jti, claims.sub);
  if (!session) return response.status(401).json({ error: 'Your session ended. Please log in again.' });
  const user = await db.prepare(`
    SELECT id, email, display_name AS "displayName" FROM users WHERE id = $1
  `).get(claims.sub);
  if (!user) return response.status(401).json({ error: 'Your account is no longer available' });
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

app.get('/api/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Take a breath and try again in a little while.' },
});

const searchLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many searches. Please try again in a little while.' },
});

app.post('/api/auth/register', authLimiter, async (request, response) => {
  const { displayName, email, password } = request.body ?? {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (
    typeof displayName !== 'string' ||
    !displayName.trim() ||
    displayName.trim().length > 80 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
    normalizedEmail.length > 254 ||
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128
  ) {
    return response.status(400).json({
      error: 'Provide a name, valid email, and password between 8 and 128 characters',
    });
  }

  try {
    const user = {
      id: randomUUID(),
      displayName: displayName.trim(),
      email: normalizedEmail,
    };
    const passwordHash = await bcrypt.hash(password, 12);
    await db.transaction(async (tx) => {
        await tx.prepare(`
          INSERT INTO users (id, display_name, email, password_hash)
          VALUES ($1, $2, $3, $4)
        `).run(user.id, user.displayName, user.email, passwordHash);
        await initializeUserData(user, tx);
      });
      await issueSession(response, user);
    return response.status(201).json({ user });
  } catch (error) {
    if (error?.code === '23505') {
      return response.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('Account registration failed:', error);
    return response.status(500).json({ error: 'Could not create your account right now' });
  }
});

app.post('/api/auth/login', authLimiter, async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  const password = typeof request.body?.password === 'string' ? request.body.password : '';
  if (!email || !password || email.length > 254 || password.length > 128) {
    return response.status(400).json({ error: 'Enter your email and password' });
  }

  try {
    const account = await db.prepare(`
      SELECT id, email, display_name AS "displayName", password_hash AS "passwordHash"
      FROM users WHERE lower(email) = $1
    `).get(email);
    const validPassword = account?.passwordHash
      ? await bcrypt.compare(password, account.passwordHash)
      : false;
    if (!account || !validPassword) {
      return response.status(401).json({ error: 'That email and password do not match' });
    }
    const user = { id: account.id, email: account.email, displayName: account.displayName };
    await issueSession(response, user);
    return response.json({ user });
  } catch (error) {
    console.error('Account login failed:', error);
    return response.status(500).json({ error: 'Could not sign you in right now' });
  }
});

app.get('/api/auth/me', authenticate, async (request, response) => {
  response.json({ user: request.user });
});

app.post('/api/auth/logout', async (request, response) => {
  const token = request.cookies[sessionCookie];
  if (token) {
    try {
      const claims = jwt.verify(token, jwtSecret, { issuer: 'bedroom-pop' });
      if (typeof claims === 'object' && typeof claims.jti === 'string') {
        await db.prepare('DELETE FROM auth_sessions WHERE id = $1').run(claims.jti);
      }
    } catch {
      response.clearCookie(sessionCookie, cookieOptions);
      return response.status(204).end();
    }
  }
  response.clearCookie(sessionCookie, cookieOptions);
  response.status(204).end();
});

app.use('/api', authenticate);
app.use('/api/music', musicRouter);
app.use('/api/movies', moviesRouter);
app.use('/api/podcasts', podcastsRouter);
app.use('/api/playlists', createPlaylistsRouter({ database: db, authenticate }));

app.get('/api/search', searchLimiter, async (request, response, next) => {
  const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
  const type = request.query.type;
  if (!query || query.length > 200) {
    return response.status(400).json({ error: 'A search query of 1 to 200 characters is required' });
  }
  if (!['video', 'podcast', 'audio', 'video_podcast'].includes(type)) {
    return response.status(400).json({ error: 'type must be "video", "podcast", "audio", or "video_podcast"' });
  }

  const cacheQuery = query.toLowerCase();
  const cached = await db.prepare(`
    SELECT response_json AS "responseJson" FROM search_cache
    WHERE query = $1 AND type = $2 AND expires_at > NOW()
  `).get(cacheQuery, type);
  if (cached) {
    try {
      return response.json({ query, type, results: JSON.parse(cached.responseJson), cached: true });
    } catch (error) {
      console.error('Invalid media search cache entry:', error);
      await db.prepare('DELETE FROM search_cache WHERE query = $1 AND type = $2').run(cacheQuery, type);
    }
  }

  try {
    const results = await searchExternalMedia(query, type);
    await db.prepare(`
      INSERT INTO search_cache (query, type, response_json, expires_at)
      VALUES ($1, $2, $3, (NOW() + INTERVAL '15 minutes'))
      ON CONFLICT(query, type) DO UPDATE SET
        response_json = excluded.response_json,
        expires_at = excluded.expires_at
    `).run(cacheQuery, type, JSON.stringify(results));
    await db.prepare("DELETE FROM search_cache WHERE expires_at <= NOW()").run();
    await db.prepare(`
      DELETE FROM search_cache
      WHERE (query, type) IN (
        SELECT query, type FROM search_cache
        ORDER BY expires_at DESC
        OFFSET 1000
      )
    `).run();
    return response.json({ query, type, results, cached: false });
  } catch (error) {
    if (error instanceof MediaSearchError) {
      if (error.status >= 500) console.error(`Media search provider error: ${error.code}`);
      const message = error.code === 'youtube_not_configured'
        ? 'YouTube search is not ready yet. Try podcasts or audio while we finish setting up video search.'
        : 'The media search provider could not complete the request.';
      return response.status(error.status).json({ error: message });
    }
    return next(error);
  }
});

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

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'Request body must be valid JSON' });
  }
  console.error(error);
  return response.status(500).json({ error: 'Unexpected server error' });
});

await initializeDatabase();

app.listen(port, () => {
  console.log(`BEDROOM POP server listening on http://localhost:${port}`);
});
