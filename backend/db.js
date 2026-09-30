import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const databasePath = process.env.DATABASE_PATH
  ? resolve(process.env.DATABASE_PATH)
  : fileURLToPath(new URL('./data/bedroom-pop.sqlite', import.meta.url));

mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS music_mixes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    note TEXT NOT NULL,
    cover TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS music_tracks (
    id TEXT PRIMARY KEY,
    mix_id TEXT NOT NULL REFERENCES music_mixes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    cover TEXT NOT NULL,
    UNIQUE (mix_id, position)
  );

  CREATE TABLE IF NOT EXISTS now_playing_states (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    mix_id TEXT NOT NULL REFERENCES music_mixes(id),
    track_id TEXT NOT NULL REFERENCES music_tracks(id),
    is_playing INTEGER NOT NULL DEFAULT 0 CHECK (is_playing IN (0, 1)),
    progress_seconds INTEGER NOT NULL DEFAULT 0 CHECK (progress_seconds >= 0),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mix_swipes (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mix_id TEXT NOT NULL REFERENCES music_mixes(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, mix_id)
  );
`);

const seedMixes = [
  {
    id: 'three-am',
    title: '3am study tape',
    note: 'nine songs, no words, one desk lamp',
    cover: 'lamp',
    tags: ['instrumental', 'no drums'],
    tracks: [
      ['t1', 'Hallway Hum', 'Ivy Lorne', 214, 'lamp'],
      ['t2', 'Paper Thin', 'Norr & Bell', 187, 'cassette-desk'],
      ['t3', 'Ceiling Fan', 'Marlow', 241, 'moonlit-sill'],
      ['t4', 'Second Coffee', 'Ivy Lorne', 168, 'rain-on-window'],
    ],
  },
  {
    id: 'rain-window',
    title: 'rain on the window',
    note: 'field recording under everything',
    cover: 'rain-on-window',
    tags: ['rainy', 'soft'],
    tracks: [
      ['t5', 'Gutter Song', 'Halden', 232, 'rain-on-window'],
      ['t6', 'Wet Pavement', 'Juno Fair', 198, 'moonlit-sill'],
      ['t7', 'Umbrella Weather', 'Norr & Bell', 264, 'lamp'],
    ],
  },
  {
    id: 'slow-morning',
    title: 'songs for a slow morning',
    note: 'for the hour you refuse to get up',
    cover: 'moonlit-sill',
    tags: ['acoustic', 'warm'],
    tracks: [
      ['t8', 'Toast and Light', 'Marlow', 205, 'moonlit-sill'],
      ['t9', 'Open Curtain', 'Juno Fair', 176, 'polaroid-wall'],
      ['t10', 'Sunday Felt Like This', 'Halden', 289, 'guitar-on-bed'],
    ],
  },
  {
    id: 'unmade-bed',
    title: 'unmade bed sessions',
    note: 'recorded on a laptop, two feet from the mic',
    cover: 'guitar-on-bed',
    tags: ['lo-fi', 'guitar'],
    tracks: [
      ['t11', 'Bedframe', 'Ivy Lorne', 221, 'guitar-on-bed'],
      ['t12', 'One Sock', 'Marlow', 154, 'cassette-desk'],
      ['t13', 'Room Tone', 'Halden', 302, 'lamp'],
    ],
  },
  {
    id: 'tape-hiss',
    title: 'tape hiss & traffic',
    note: 'cassette dub of a bus ride home',
    cover: 'cassette-desk',
    tags: ['cassette', 'grainy'],
    tracks: [
      ['t14', 'Route 12', 'Norr & Bell', 246, 'cassette-desk'],
      ['t15', 'Last Stop', 'Juno Fair', 191, 'rain-on-window'],
      ['t16', 'Slow Headlights', 'Halden', 258, 'moonlit-sill'],
    ],
  },
  {
    id: 'cant-sleep',
    title: 'for when you cannot sleep',
    note: 'put it on, close the laptop, lie down',
    cover: 'polaroid-wall',
    tags: ['ambient', 'fairy lights'],
    tracks: [
      ['t17', 'Fairy Lights Left On', 'Ivy Lorne', 274, 'polaroid-wall'],
      ['t18', 'Somewhere Past Two', 'Marlow', 233, 'lamp'],
      ['t19', 'Sleep in Fours', 'Halden', 318, 'moonlit-sill'],
    ],
  },
];

const seed = db.transaction(() => {
  db.prepare('INSERT OR IGNORE INTO users (id, display_name) VALUES (?, ?)').run(
    'guest',
    'Night listener',
  );

  const insertMix = db.prepare(`
    INSERT OR IGNORE INTO music_mixes (id, title, note, cover, tags_json)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertTrack = db.prepare(`
    INSERT OR IGNORE INTO music_tracks
      (id, mix_id, position, title, artist, duration_seconds, cover)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const mix of seedMixes) {
    insertMix.run(mix.id, mix.title, mix.note, mix.cover, JSON.stringify(mix.tags));
    mix.tracks.forEach(([id, title, artist, seconds, cover], index) => {
      insertTrack.run(id, mix.id, index, title, artist, seconds, cover);
    });
  }

  db.prepare(`
    INSERT OR IGNORE INTO now_playing_states (user_id, mix_id, track_id)
    VALUES (?, ?, ?)
  `).run('guest', 'three-am', 't1');
});

seed();
