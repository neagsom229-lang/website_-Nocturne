import express from 'express';
import { db } from './db.js';

const app = express();
const port = Number(process.env.API_PORT ?? 3001);

app.use(express.json());

const defaultUserId = 'guest';

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

function getNowPlaying(userId = defaultUserId) {
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

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: db.open ? 'connected' : 'disconnected' });
});

app.get('/api/music/mixes', (_request, response) => {
  response.json({ mixes: getMixes() });
});

app.get('/api/music/mixes/:mixId', (request, response) => {
  const mix = getMixes().find((item) => item.id === request.params.mixId);
  if (!mix) return response.status(404).json({ error: 'Mix not found' });
  return response.json({ mix });
});

app.get('/api/music/now-playing', (request, response) => {
  const userId = typeof request.query.userId === 'string' ? request.query.userId : defaultUserId;
  const nowPlaying = getNowPlaying(userId);
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
  `).run(defaultUserId, mixId, trackId, Number(isPlaying), progressSeconds);

  return response.json({ nowPlaying: getNowPlaying() });
});

app.get('/api/music/swipes', (request, response) => {
  const userId = typeof request.query.userId === 'string' ? request.query.userId : defaultUserId;
  const swipes = db.prepare(`
    SELECT mix_id AS mixId, action, created_at AS createdAt
    FROM mix_swipes WHERE user_id = ? ORDER BY created_at, mix_id
  `).all(userId);
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
  `).run(defaultUserId, mixId, action);

  return response.status(201).json({ mixId, action });
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'Request body must be valid JSON' });
  }
  console.error(error);
  return response.status(500).json({ error: 'Unexpected server error' });
});

app.listen(port, () => {
  console.log(`BEDROOM POP API listening on http://localhost:${port}`);
});
