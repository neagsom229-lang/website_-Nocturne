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
import { db, initializeUserData } from './db.js';

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

function issueSession(response, user) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
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

function authenticate(request, response, next) {
  const token = request.cookies[sessionCookie];
  if (!token) return response.status(401).json({ error: 'Please log in to continue' });
  try {
    const claims = jwt.verify(token, jwtSecret, { issuer: 'bedroom-pop' });
    if (typeof claims !== 'object' || typeof claims.sub !== 'string' || typeof claims.jti !== 'string') {
      return response.status(401).json({ error: 'Your session is invalid. Please log in again.' });
    }
    const session = db.prepare(`
      SELECT 1 FROM auth_sessions WHERE id = ? AND user_id = ? AND expires_at > datetime('now')
    `).get(claims.jti, claims.sub);
    if (!session) return response.status(401).json({ error: 'Your session ended. Please log in again.' });
    const user = db.prepare(`
      SELECT id, email, display_name AS displayName FROM users WHERE id = ?
    `).get(claims.sub);
    if (!user) return response.status(401).json({ error: 'Your account is no longer available' });
    request.user = user;
    return next();
  } catch {
    response.clearCookie(sessionCookie, cookieOptions);
    return response.status(401).json({ error: 'Your session expired. Please log in again.' });
  }
}

function getMixes() {
  const mixes = db.prepare('SELECT * FROM music_mixes ORDER BY rowid').all();
  const tracks = db.prepare(`
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

function getNowPlaying(userId) {
  const state = db.prepare(`
    SELECT s.is_playing, s.progress_seconds, m.id AS mix_id, m.title AS mix_title,
      m.note AS mix_note, m.cover AS mix_cover, t.id AS track_id, t.title AS track_title,
      t.artist, t.duration_seconds AS seconds, t.cover AS track_cover
    FROM now_playing_states s
    JOIN music_mixes m ON m.id = s.mix_id
    JOIN music_tracks t ON t.id = s.track_id AND t.mix_id = s.mix_id
    WHERE s.user_id = ?
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
    SELECT e.id, e.show_id AS showId, e.title, e.summary,
      e.duration_seconds AS seconds, e.published, e.season,
      e.episode_number AS number, e.audio_url AS audioUrl,
      s.title AS showTitle, s.host AS showHost, s.art AS showArt,
      CASE WHEN saved.episode_id IS NULL THEN 0 ELSE 1 END AS isSaved
    FROM podcast_episodes e
    JOIN podcast_shows s ON s.id = e.show_id
    LEFT JOIN podcast_listen_later saved
      ON saved.episode_id = e.id AND saved.user_id = ?
  `;
}

function getPodcastEpisodes({ userId, showId = null, savedOnly = false }) {
  return db.prepare(`
    ${podcastEpisodeQuery()}
    WHERE (? IS NULL OR e.show_id = ?)
      AND (? = 0 OR saved.episode_id IS NOT NULL)
    ORDER BY e.rowid ASC
  `).all(userId, showId, showId, Number(savedOnly)).map((episode) => ({
    ...episode,
    isSaved: Boolean(episode.isSaved),
  }));
}

function getPodcastEpisode(episodeId, userId) {
  return db.prepare(`
    ${podcastEpisodeQuery()}
    WHERE e.id = ?
  `).get(userId, episodeId);
}

function getJournalEntry(entryId, userId) {
  return db.prepare(`
    SELECT id, entry_date AS entryDate, human_date AS date, mood, song, artist, note, photo, rating
    FROM journal_entries WHERE id = ? AND user_id = ?
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

function getDatingMessages(profileId, userId) {
  return db.prepare(`
    SELECT id, sender AS "from", text, created_at AS at
    FROM dating_messages
    WHERE user_id = ? AND profile_id = ?
    ORDER BY rowid
  `).all(userId, profileId);
}

function listJournalEntries(userId, mood = null) {
  return db.prepare(`
    SELECT id, entry_date AS entryDate, human_date AS date, mood, song, artist, note, photo, rating
    FROM journal_entries
    WHERE user_id = ? AND (? IS NULL OR mood = ?)
    ORDER BY entry_date DESC, created_at DESC
  `).all(userId, mood, mood);
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: db.open ? 'connected' : 'disconnected' });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Take a breath and try again in a little while.' },
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
    const createAccount = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, display_name, email, password_hash)
        VALUES (?, ?, ?, ?)
      `).run(user.id, user.displayName, user.email, passwordHash);
      initializeUserData(user);
    });
    createAccount();
    issueSession(response, user);
    return response.status(201).json({ user });
  } catch (error) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
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
    const account = db.prepare(`
      SELECT id, email, display_name AS displayName, password_hash AS passwordHash
      FROM users WHERE lower(email) = ?
    `).get(email);
    const validPassword = account?.passwordHash
      ? await bcrypt.compare(password, account.passwordHash)
      : false;
    if (!account || !validPassword) {
      return response.status(401).json({ error: 'That email and password do not match' });
    }
    const user = { id: account.id, email: account.email, displayName: account.displayName };
    issueSession(response, user);
    return response.json({ user });
  } catch (error) {
    console.error('Account login failed:', error);
    return response.status(500).json({ error: 'Could not sign you in right now' });
  }
});

app.get('/api/auth/me', authenticate, (request, response) => {
  response.json({ user: request.user });
});

app.post('/api/auth/logout', (request, response) => {
  const token = request.cookies[sessionCookie];
  if (token) {
    try {
      const claims = jwt.verify(token, jwtSecret, { issuer: 'bedroom-pop' });
      if (typeof claims === 'object' && typeof claims.jti === 'string') {
        db.prepare('DELETE FROM auth_sessions WHERE id = ?').run(claims.jti);
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

app.get('/api/music/mixes', (_request, response) => {
  response.json({ mixes: getMixes() });
});

app.get('/api/music/mixes/:mixId', (request, response) => {
  const mix = getMixes().find((item) => item.id === request.params.mixId);
  if (!mix) return response.status(404).json({ error: 'Mix not found' });
  return response.json({ mix });
});

app.get('/api/music/now-playing', (request, response) => {
  const nowPlaying = getNowPlaying(request.user.id);
  if (!nowPlaying) return response.status(404).json({ error: 'Now-playing state not found' });
  return response.json({ nowPlaying });
});

app.put('/api/music/now-playing', (request, response) => {
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

  const track = db.prepare(`
    SELECT duration_seconds FROM music_tracks WHERE id = ? AND mix_id = ?
  `).get(trackId, mixId);
  if (!track) return response.status(404).json({ error: 'Track not found in that mix' });
  if (progressSeconds > track.duration_seconds) {
    return response.status(400).json({ error: 'Progress cannot exceed the track duration' });
  }

  db.prepare(`
    INSERT INTO now_playing_states
      (user_id, mix_id, track_id, is_playing, progress_seconds, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      mix_id = excluded.mix_id,
      track_id = excluded.track_id,
      is_playing = excluded.is_playing,
      progress_seconds = excluded.progress_seconds,
      updated_at = excluded.updated_at
  `).run(request.user.id, mixId, trackId, Number(isPlaying), progressSeconds);

  return response.json({ nowPlaying: getNowPlaying(request.user.id) });
});

app.get('/api/music/swipes', (request, response) => {
  const swipes = db.prepare(`
    SELECT mix_id AS mixId, action, created_at AS createdAt
    FROM mix_swipes WHERE user_id = ? ORDER BY created_at, mix_id
  `).all(request.user.id);
  return response.json({ swipes });
});

app.post('/api/music/swipes', (request, response) => {
  const { mixId, action } = request.body ?? {};
  if (typeof mixId !== 'string' || !['like', 'pass'].includes(action)) {
    return response.status(400).json({ error: 'A valid mixId and action ("like" or "pass") are required' });
  }
  if (!db.prepare('SELECT 1 FROM music_mixes WHERE id = ?').get(mixId)) {
    return response.status(404).json({ error: 'Mix not found' });
  }

  db.prepare(`
    INSERT INTO mix_swipes (user_id, mix_id, action)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, mix_id) DO UPDATE SET
      action = excluded.action, created_at = datetime('now')
  `).run(request.user.id, mixId, action);

  return response.status(201).json({ mixId, action });
});

app.get('/api/podcasts/shows', (_request, response) => {
  const shows = db.prepare(`
    SELECT s.id, s.title, s.host, s.blurb, s.art, s.cadence,
      COUNT(e.id) AS episodeCount
    FROM podcast_shows s
    LEFT JOIN podcast_episodes e ON e.show_id = s.id
    GROUP BY s.id
    ORDER BY s.rowid
  `).all();
  return response.json({ shows });
});

app.get('/api/podcasts/shows/:showId', (request, response) => {
  const show = db.prepare(`
    SELECT s.id, s.title, s.host, s.blurb, s.art, s.cadence,
      COUNT(e.id) AS episodeCount
    FROM podcast_shows s
    LEFT JOIN podcast_episodes e ON e.show_id = s.id
    WHERE s.id = ?
    GROUP BY s.id
  `).get(request.params.showId);
  if (!show) return response.status(404).json({ error: 'Podcast show not found' });
  return response.json({ show, episodes: getPodcastEpisodes({ userId: request.user.id, showId: show.id }) });
});

app.get('/api/podcasts/episodes', (request, response) => {
  const showId = typeof request.query.showId === 'string' ? request.query.showId : null;
  return response.json({ episodes: getPodcastEpisodes({ userId: request.user.id, showId }) });
});

app.get('/api/podcasts/episodes/:episodeId', (request, response) => {
  const episode = getPodcastEpisode(request.params.episodeId, request.user.id);
  if (!episode) return response.status(404).json({ error: 'Podcast episode not found' });
  return response.json({ episode: { ...episode, isSaved: Boolean(episode.isSaved) } });
});

app.get('/api/podcasts/listen-later', (request, response) => {
  return response.json({ episodes: getPodcastEpisodes({ userId: request.user.id, savedOnly: true }) });
});

app.post('/api/podcasts/listen-later', (request, response) => {
  const { episodeId } = request.body ?? {};
  if (typeof episodeId !== 'string') {
    return response.status(400).json({ error: 'A valid episodeId is required' });
  }
  if (!db.prepare('SELECT 1 FROM podcast_episodes WHERE id = ?').get(episodeId)) {
    return response.status(404).json({ error: 'Podcast episode not found' });
  }
  db.prepare(`
    INSERT OR IGNORE INTO podcast_listen_later (user_id, episode_id)
    VALUES (?, ?)
  `).run(request.user.id, episodeId);
  return response.status(201).json({ episodeId, saved: true });
});

app.delete('/api/podcasts/listen-later/:episodeId', (request, response) => {
  const result = db.prepare(`
    DELETE FROM podcast_listen_later WHERE user_id = ? AND episode_id = ?
  `).run(request.user.id, request.params.episodeId);
  if (!result.changes) return response.status(404).json({ error: 'Saved episode not found' });
  return response.json({ episodeId: request.params.episodeId, saved: false });
});

app.get('/api/podcasts/now-playing', (request, response) => {
  const state = db.prepare(`
    SELECT p.episode_id AS episodeId, p.is_playing AS isPlaying,
      p.progress_seconds AS progressSeconds, e.duration_seconds AS seconds,
      e.title, e.summary, e.published, e.season, e.episode_number AS number,
      e.audio_url AS audioUrl, e.show_id AS showId, s.title AS showTitle,
      s.host AS showHost, s.art AS showArt
    FROM podcast_player_states p
    JOIN podcast_episodes e ON e.id = p.episode_id
    JOIN podcast_shows s ON s.id = e.show_id
    WHERE p.user_id = ?
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

app.put('/api/podcasts/now-playing', (request, response) => {
  const { episodeId, isPlaying, progressSeconds = 0 } = request.body ?? {};
  if (
    typeof episodeId !== 'string' ||
    typeof isPlaying !== 'boolean' ||
    !Number.isInteger(progressSeconds) ||
    progressSeconds < 0
  ) {
    return response.status(400).json({ error: 'A valid episodeId, isPlaying and progressSeconds are required' });
  }
  const episode = db.prepare(`
    SELECT duration_seconds FROM podcast_episodes WHERE id = ?
  `).get(episodeId);
  if (!episode) return response.status(404).json({ error: 'Podcast episode not found' });
  if (progressSeconds > episode.duration_seconds) {
    return response.status(400).json({ error: 'Progress cannot exceed the episode duration' });
  }
  db.prepare(`
    INSERT INTO podcast_player_states
      (user_id, episode_id, is_playing, progress_seconds, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      episode_id = excluded.episode_id,
      is_playing = excluded.is_playing,
      progress_seconds = excluded.progress_seconds,
      updated_at = excluded.updated_at
  `).run(request.user.id, episodeId, Number(isPlaying), progressSeconds);
  return response.json({ nowPlaying: getPodcastPlayerState(request.user.id) });
});

app.get('/api/journal/entries', (request, response) => {
  const mood = typeof request.query.mood === 'string' ? request.query.mood : null;
  const validMoods = ['tender', 'restless', 'quiet', 'hopeful', 'wrecked'];
  if (mood && !validMoods.includes(mood)) {
    return response.status(400).json({ error: 'Mood must be tender, restless, quiet, hopeful, or wrecked' });
  }
  return response.json({ entries: listJournalEntries(request.user.id, mood) });
});

app.get('/api/journal/entries/:entryId', (request, response) => {
  const entry = getJournalEntry(request.params.entryId, request.user.id);
  if (!entry) return response.status(404).json({ error: 'Journal entry not found' });
  return response.json({ entry });
});

app.post('/api/journal/entries', (request, response) => {
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
  db.prepare(`
    INSERT INTO journal_entries
      (id, user_id, entry_date, human_date, mood, song, artist, note, photo, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, entry_date) DO UPDATE SET
      human_date = excluded.human_date,
      mood = excluded.mood,
      song = excluded.song,
      artist = excluded.artist,
      note = excluded.note,
      photo = excluded.photo,
      rating = excluded.rating
  `).run(entryId, request.user.id, entryDate, humanDate, mood, song.trim(), artist.trim(), note.trim(), photo, rating);

  const entry = db.prepare(`
    SELECT id, entry_date AS entryDate, human_date AS date, mood, song, artist, note, photo, rating
    FROM journal_entries WHERE user_id = ? AND entry_date = ?
  `).get(request.user.id, entryDate);
  return response.status(201).json({ entry });
});

app.get('/api/journal/stats', (request, response) => {
  const summary = db.prepare(`
    SELECT COUNT(*) AS entries, COUNT(DISTINCT song || '|' || artist) AS songs,
      COALESCE(ROUND(AVG(rating), 1), 0) AS averageRating
    FROM journal_entries WHERE user_id = ?
  `).get(request.user.id);
  const moodCounts = db.prepare(`
    SELECT mood, COUNT(*) AS count FROM journal_entries
    WHERE user_id = ? GROUP BY mood ORDER BY count DESC, mood
  `).all(request.user.id);
  const dates = db.prepare(`
    SELECT entry_date AS entryDate FROM journal_entries
    WHERE user_id = ? ORDER BY entry_date DESC
  `).all(request.user.id).map((row) => row.entryDate);
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

app.get('/api/dating/profile', (request, response) => {
  const profile = db.prepare(`
    SELECT name, age, headline, bio, song, interests_json AS interestsJson
    FROM dating_user_profiles WHERE user_id = ?
  `).get(request.user.id);
  if (!profile) return response.status(404).json({ error: 'Your dating profile was not found' });
  return response.json({ profile: { ...profile, interests: JSON.parse(profile.interestsJson), interestsJson: undefined } });
});

app.put('/api/dating/profile', (request, response) => {
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
  db.prepare(`
    INSERT INTO dating_user_profiles (user_id, name, age, headline, bio, song, interests_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      name = excluded.name, age = excluded.age, headline = excluded.headline,
      bio = excluded.bio, song = excluded.song, interests_json = excluded.interests_json,
      updated_at = excluded.updated_at
  `).run(request.user.id, name.trim(), age, headline.trim(), bio.trim(), song.trim(), JSON.stringify(interests));
  const profile = db.prepare(`
    SELECT name, age, headline, bio, song, interests_json AS interestsJson
    FROM dating_user_profiles WHERE user_id = ?
  `).get(request.user.id);
  return response.json({ profile: { ...profile, interests: JSON.parse(profile.interestsJson), interestsJson: undefined } });
});

app.get('/api/dating/preferences', (request, response) => {
  const preferences = db.prepare(`
    SELECT answers_json AS answersJson, completed_at AS completedAt
    FROM dating_preferences WHERE user_id = ?
  `).get(request.user.id);
  return response.json({
    answers: preferences ? JSON.parse(preferences.answersJson) : {},
    completed: Boolean(preferences?.completedAt),
  });
});

app.put('/api/dating/preferences', (request, response) => {
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
  db.prepare(`
    INSERT INTO dating_preferences (user_id, answers_json, completed_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET answers_json = excluded.answers_json, completed_at = excluded.completed_at
  `).run(request.user.id, JSON.stringify(answers));
  return response.json({ answers, completed: true });
});

app.get('/api/dating/profiles', (request, response) => {
  const profiles = db.prepare(`
    SELECT p.* FROM dating_profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM dating_swipes sw
      WHERE sw.user_id = ? AND sw.profile_id = p.id
    )
    ORDER BY p.rowid
  `).all(request.user.id).map(mapDatingProfile);
  return response.json({ profiles });
});

app.get('/api/dating/profiles/:profileId', (request, response) => {
  const profile = mapDatingProfile(db.prepare('SELECT * FROM dating_profiles WHERE id = ?').get(request.params.profileId));
  if (!profile) return response.status(404).json({ error: 'Profile not found' });
  return response.json({ profile });
});

app.post('/api/dating/swipes', (request, response) => {
  const { profileId, action } = request.body ?? {};
  if (typeof profileId !== 'string' || !['like', 'pass'].includes(action)) {
    return response.status(400).json({ error: 'Provide a profileId and action ("like" or "pass")' });
  }
  if (!db.prepare('SELECT 1 FROM dating_profiles WHERE id = ?').get(profileId)) {
    return response.status(404).json({ error: 'Profile not found' });
  }
  db.prepare(`
    INSERT INTO dating_swipes (user_id, profile_id, action)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, profile_id) DO UPDATE SET action = excluded.action, created_at = datetime('now')
  `).run(request.user.id, profileId, action);
  if (action === 'like') {
    db.prepare('INSERT OR IGNORE INTO dating_matches (user_id, profile_id) VALUES (?, ?)').run(request.user.id, profileId);
  }
  return response.status(201).json({
    profileId,
    action,
    matched: action === 'like' && Boolean(db.prepare(
      'SELECT 1 FROM dating_matches WHERE user_id = ? AND profile_id = ?',
    ).get(request.user.id, profileId)),
  });
});

app.get('/api/dating/matches', (request, response) => {
  const matches = db.prepare(`
    SELECT p.id, p.name, p.age, p.distance_km AS distanceKm,
      p.headline, p.bio, p.interests_json AS interestsJson, p.song, p.photo,
      p.prompt_question AS promptQuestion, p.prompt_answer AS promptAnswer,
      p.last_active AS lastActive, m.matched_at AS matchedAt,
      (SELECT text FROM dating_messages msg WHERE msg.user_id = m.user_id
        AND msg.profile_id = p.id ORDER BY msg.rowid DESC LIMIT 1) AS lastMessage
    FROM dating_matches m JOIN dating_profiles p ON p.id = m.profile_id
    WHERE m.user_id = ?
    ORDER BY m.matched_at DESC, p.name
  `).all(request.user.id).map((profile) => ({
    ...profile,
    interests: JSON.parse(profile.interestsJson),
    prompt: { question: profile.promptQuestion, answer: profile.promptAnswer },
    interestsJson: undefined,
    promptQuestion: undefined,
    promptAnswer: undefined,
    unread: db.prepare(`
      SELECT COUNT(*) AS count FROM dating_messages
      WHERE user_id = ? AND profile_id = ? AND sender = 'them'
    `).get(request.user.id, profile.id).count,
  }));
  return response.json({ matches });
});

app.get('/api/dating/matches/:profileId/messages', (request, response) => {
  const matched = db.prepare('SELECT 1 FROM dating_matches WHERE user_id = ? AND profile_id = ?')
    .get(request.user.id, request.params.profileId);
  if (!matched) return response.status(404).json({ error: 'Match not found' });
  return response.json({ messages: getDatingMessages(request.params.profileId, request.user.id) });
});

app.post('/api/dating/matches/:profileId/messages', (request, response) => {
  const matched = db.prepare('SELECT 1 FROM dating_matches WHERE user_id = ? AND profile_id = ?')
    .get(request.user.id, request.params.profileId);
  if (!matched) return response.status(404).json({ error: 'Match not found' });
  const { text } = request.body ?? {};
  if (typeof text !== 'string' || !text.trim() || text.trim().length > 1000) {
    return response.status(400).json({ error: 'A message between 1 and 1000 characters is required' });
  }
  const id = randomUUID();
  db.prepare(`
    INSERT INTO dating_messages (id, user_id, profile_id, sender, text)
    VALUES (?, ?, ?, 'me', ?)
  `).run(id, request.user.id, request.params.profileId, text.trim());
  return response.status(201).json({
    message: db.prepare(`
      SELECT id, sender AS "from", text, created_at AS at FROM dating_messages WHERE id = ?
    `).get(id),
  });
});

function getPodcastPlayerState(userId) {
  const state = db.prepare(`
    SELECT p.episode_id AS episodeId, p.is_playing AS isPlaying,
      p.progress_seconds AS progressSeconds, e.duration_seconds AS seconds,
      e.title, e.summary, e.published, e.season, e.episode_number AS number,
      e.audio_url AS audioUrl, e.show_id AS showId, s.title AS showTitle,
      s.host AS showHost, s.art AS showArt
    FROM podcast_player_states p
    JOIN podcast_episodes e ON e.id = p.episode_id
    JOIN podcast_shows s ON s.id = e.show_id
    WHERE p.user_id = ?
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

app.listen(port, () => {
  console.log(`BEDROOM POP server listening on http://localhost:${port}`);
});
