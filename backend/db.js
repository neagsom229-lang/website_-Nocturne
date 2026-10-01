import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import Database from 'better-sqlite3';

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_PATH) {
  throw new Error('DATABASE_PATH must point to persistent storage in production.');
}

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

  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
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

  CREATE TABLE IF NOT EXISTS podcast_shows (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    host TEXT NOT NULL,
    blurb TEXT NOT NULL,
    art TEXT NOT NULL,
    cadence TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS podcast_episodes (
    id TEXT PRIMARY KEY,
    show_id TEXT NOT NULL REFERENCES podcast_shows(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    published TEXT NOT NULL,
    season INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    audio_url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS podcast_listen_later (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    episode_id TEXT NOT NULL REFERENCES podcast_episodes(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, episode_id)
  );

  CREATE TABLE IF NOT EXISTS podcast_player_states (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    episode_id TEXT NOT NULL REFERENCES podcast_episodes(id),
    is_playing INTEGER NOT NULL DEFAULT 0 CHECK (is_playing IN (0, 1)),
    progress_seconds INTEGER NOT NULL DEFAULT 0 CHECK (progress_seconds >= 0),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS media_library (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('video', 'podcast', 'audio')),
    provider TEXT NOT NULL CHECK (provider IN ('youtube', 'itunes')),
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT,
    thumbnail_url TEXT,
    stream_url TEXT NOT NULL,
    external_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, provider, external_id)
  );

  CREATE INDEX IF NOT EXISTS media_library_user_created
    ON media_library(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS search_cache (
    query TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('video', 'podcast', 'audio')),
    response_json TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    PRIMARY KEY (query, type)
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_date TEXT NOT NULL,
    human_date TEXT NOT NULL,
    mood TEXT NOT NULL CHECK (mood IN ('tender', 'restless', 'quiet', 'hopeful', 'wrecked')),
    song TEXT NOT NULL,
    artist TEXT NOT NULL,
    note TEXT NOT NULL,
    photo TEXT,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, entry_date)
  );

  CREATE TABLE IF NOT EXISTS dating_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 18),
    distance_km INTEGER NOT NULL CHECK (distance_km >= 0),
    headline TEXT NOT NULL,
    bio TEXT NOT NULL,
    interests_json TEXT NOT NULL DEFAULT '[]',
    song TEXT NOT NULL,
    prompt_question TEXT NOT NULL,
    prompt_answer TEXT NOT NULL,
    photo TEXT NOT NULL,
    last_active TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dating_user_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 18),
    headline TEXT NOT NULL,
    bio TEXT NOT NULL,
    song TEXT NOT NULL,
    interests_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dating_preferences (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    answers_json TEXT NOT NULL DEFAULT '{}',
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS dating_swipes (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL REFERENCES dating_profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('like', 'pass')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, profile_id)
  );

  CREATE TABLE IF NOT EXISTS dating_matches (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL REFERENCES dating_profiles(id) ON DELETE CASCADE,
    matched_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, profile_id)
  );

  CREATE TABLE IF NOT EXISTS dating_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id TEXT NOT NULL REFERENCES dating_profiles(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('me', 'them')),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
if (!userColumns.includes('password_hash')) {
  db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
}
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_case_insensitive
  ON users(lower(email)) WHERE email IS NOT NULL;
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

const seedShows = [
  ['bedroom-tapes', 'Bedroom Tapes', 'Ivy Lorne', 'Interviews recorded in the corner of somebody’s room, one lamp, no edit.', 'bedroom-tapes', 'Every second Thursday'],
  ['static-sincerity', 'Static & Sincerity', 'Halden', 'Two friends work out why a song keeps coming back. Sometimes they cry about it.', 'static-sincerity', 'Weekly, late'],
  ['fairy-light-hours', 'Fairy Light Hours', 'Juno Fair', 'A sleep show. One story, read slowly, for people who are not tired.', 'fairy-light-hours', 'Nightly'],
];

const seedEpisodes = [
  ['e1', 'bedroom-tapes', 'Everything I own fits in this room', 'Marlow moved four times in two years and kept one guitar. We talk about what a song sounds like when you are the only one in the flat.', 2412, '2 days ago', 3, 14],
  ['e2', 'bedroom-tapes', 'The demo was better than the record', 'Norr & Bell bring the original four-track take and explain, calmly, why the label version lost the noise.', 2940, '2 weeks ago', 3, 13],
  ['e3', 'static-sincerity', 'Song you hate from the first second', 'We play three songs we cannot stand and try to be fair about them. We are not fair about them.', 1866, '4 days ago', 1, 8],
  ['e4', 'static-sincerity', 'Crying in the car, a study', 'A listener asked why certain songs only work while driving. We have theories. One of them is good.', 2088, '11 days ago', 1, 7],
  ['e5', 'fairy-light-hours', 'The house that hummed', 'A slow reading about a rented house near the coast, a broken fridge, and the noise that made it bearable.', 3360, 'Last night', 2, 41],
  ['e6', 'fairy-light-hours', 'Six hours of nothing in particular', 'No story tonight. Rain, a fan, and somebody turning pages two rooms away.', 5040, '3 nights ago', 2, 40],
  ['e7', 'bedroom-tapes', 'Stop apologising for the take', 'Ivy sits with Juno Fair about recording alone, and the very specific shame of hearing your own voice back.', 2604, '1 month ago', 3, 12],
  ['e8', 'fairy-light-hours', 'Flat above the laundrette', 'A short one. Warm machines, a thin wall, and the sound that got a whole building to sleep.', 2220, 'Last week', 2, 39],
];

const seedJournalEntries = [
  ['j1', '2026-09-30', 'Tonight, 1:40am', 'tender', 'Fairy Lights Left On', 'Ivy Lorne', 'Played it twice on the walk home with one earbud in, which is the correct way. The room noise is the whole song for me.', 'polaroid-wall', 5],
  ['j2', '2026-09-29', 'Yesterday, 11:15pm', 'restless', 'Ceiling Fan', 'Marlow', 'Too wired to sleep, so I put this on and stared at the ceiling with the lamp still on. It did not help but it was company.', 'polaroid-wall', 4],
  ['j3', '2026-09-28', 'Tuesday, 2:05am', 'quiet', 'Room Tone', 'Halden', 'Three minutes of a room doing nothing. I have never felt so seen by a track with no melody in it.', null, 5],
  ['j4', '2026-09-27', 'Monday, 9:30pm', 'hopeful', 'Toast and Light', 'Marlow', 'Made actual dinner instead of cereal. Put this on while the pan heated. Small, but I am writing it down.', 'moonlit-sill', 4],
  ['j5', '2026-09-26', 'Sunday, 3:12am', 'wrecked', 'One Sock', 'Marlow', 'Laughed so hard at the title I had to pause it. Then it turned out to be genuinely sad, which is unfair and also very good.', null, 5],
  ['j6', '2026-09-25', 'Last Friday, 12:50am', 'quiet', 'Wet Pavement', 'Juno Fair', 'Walked the long way home in the rain on purpose. No regrets, one wet pair of shoes.', null, 3],
];

const seedDatingProfiles = [
  ['p1', 'Marlow', 26, 2, 'Writes songs nobody asked for, plays them once', 'I have a four-track that hisses and I refuse to fix it. Looking for someone who will sit on the floor while I figure out a chorus.', ['cassette tapes', 'rain sounds', 'late walks', 'cheap coffee'], 'Ceiling Fan — Marlow', 'The way to my heart is', 'Being quiet in the same room as me for an hour and not calling it awkward.', 'marlow', 'online now'],
  ['p2', 'Juno', 29, 5, 'Reads out loud to strangers at night', 'I host a sleep podcast, which means my job is talking very slowly. In real life I talk too fast. Sorry in advance.', ['ghost stories', 'warm milk', 'thrift shops', 'long drives'], 'Open Curtain — Juno Fair', 'Two truths and a lie', 'I own fourteen lamps. I have never owned a kettle. I once slept through a fire alarm.', 'juno', 'online 12m ago'],
  ['p3', 'Halden', 31, 9, 'Bad at small talk, good at long talks', 'I will remember your coffee order and forget your birthday. I am working on exactly one of those.', ['field recordings', 'buses', 'card games', 'sad films'], 'Room Tone — Halden', 'My most controversial opinion', 'The demo is almost always better than the record and that is not nostalgia, it is compression.', 'halden', 'online 1h ago'],
  ['p4', 'Ivy', 27, 3, 'Interviews people in their bedrooms', 'I am the one with the microphone. If we match I will probably ask you about the last song that made you cry.', ['one earbud in', 'polaroids', 'fairy lights', '2am'], 'Hallway Hum — Ivy Lorne', 'You should message me if', 'You have a favourite sound that is not music. Mine is a fridge in another room.', 'ivy', 'online now'],
];

const seedDatingMessages = [
  ['m1', 'p1', 'them', 'your profile says four-track. which one?', '11:48pm'],
  ['m2', 'p1', 'me', 'a tascam that cost less than dinner', '11:52pm'],
  ['m3', 'p1', 'them', 'correct answer. do you keep the hiss?', '11:53pm'],
  ['m4', 'p1', 'them', 'be honest', '11:53pm'],
  ['m5', 'p2', 'them', 'ok but fourteen lamps is not a personality', 'Yesterday'],
  ['m6', 'p2', 'me', 'it is the only personality I have', 'Yesterday'],
  ['m7', 'p2', 'them', 'respect. what is the fourteenth one for', 'Yesterday'],
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

  const insertShow = db.prepare(`
    INSERT OR IGNORE INTO podcast_shows (id, title, host, blurb, art, cadence)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const show of seedShows) insertShow.run(...show);

  const insertEpisode = db.prepare(`
    INSERT OR IGNORE INTO podcast_episodes
      (id, show_id, title, summary, duration_seconds, published, season, episode_number, audio_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const episode of seedEpisodes) {
    insertEpisode.run(...episode, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
  }

  const saveEpisode = db.prepare('INSERT OR IGNORE INTO podcast_listen_later (user_id, episode_id) VALUES (?, ?)');
  saveEpisode.run('guest', 'e3');
  saveEpisode.run('guest', 'e5');

  db.prepare(`
    INSERT OR IGNORE INTO podcast_player_states (user_id, episode_id)
    VALUES (?, ?)
  `).run('guest', 'e1');

  db.prepare(`
    INSERT OR IGNORE INTO now_playing_states (user_id, mix_id, track_id)
    VALUES (?, ?, ?)
  `).run('guest', 'three-am', 't1');

  const insertJournalEntry = db.prepare(`
    INSERT OR IGNORE INTO journal_entries
      (id, user_id, entry_date, human_date, mood, song, artist, note, photo, rating)
    VALUES (?, 'guest', ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const entry of seedJournalEntries) insertJournalEntry.run(...entry);

  const insertDatingProfile = db.prepare(`
    INSERT OR IGNORE INTO dating_profiles
      (id, name, age, distance_km, headline, bio, interests_json, song, prompt_question, prompt_answer, photo, last_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const profile of seedDatingProfiles) {
    const [id, name, age, distance, headline, bio, interests, song, question, answer, photo, lastActive] = profile;
    insertDatingProfile.run(id, name, age, distance, headline, bio, JSON.stringify(interests), song, question, answer, photo, lastActive);
  }
  db.prepare(`
    INSERT OR IGNORE INTO dating_user_profiles (user_id, name, age, headline, bio, song, interests_json)
    VALUES ('guest', 'You', 27, 'Usually awake when the good songs come on', 'Here for the quiet company and the playlists we can trade.', 'Fairy Lights Left On — Ivy Lorne', '["late walks","one good lamp","sad songs"]')
  `).run();
  db.prepare('INSERT OR IGNORE INTO dating_preferences (user_id) VALUES (?)').run('guest');
  db.prepare('INSERT OR IGNORE INTO dating_matches (user_id, profile_id) VALUES (?, ?)').run('guest', 'p1');
  db.prepare('INSERT OR IGNORE INTO dating_matches (user_id, profile_id) VALUES (?, ?)').run('guest', 'p2');
  const insertDatingMessage = db.prepare(`
    INSERT OR IGNORE INTO dating_messages (id, user_id, profile_id, sender, text, created_at)
    VALUES (?, 'guest', ?, ?, ?, ?)
  `);
  for (const message of seedDatingMessages) insertDatingMessage.run(...message);
});

seed();

export function initializeUserData(user) {
  const initialize = db.transaction(() => {
    db.prepare(`
      INSERT INTO dating_user_profiles (user_id, name, age, headline, bio, song, interests_json)
      VALUES (?, ?, 27, 'Usually awake when the good songs come on',
        'Here for the quiet company and the playlists we can trade.',
        'Fairy Lights Left On — Ivy Lorne', '["late walks","one good lamp","sad songs"]')
    `).run(user.id, user.displayName);

    db.prepare(`
      INSERT INTO now_playing_states (user_id, mix_id, track_id)
      VALUES (?, 'three-am', 't1')
    `).run(user.id);
    db.prepare(`
      INSERT INTO podcast_player_states (user_id, episode_id)
      VALUES (?, 'e1')
    `).run(user.id);
    db.prepare('INSERT INTO dating_preferences (user_id) VALUES (?)').run(user.id);
  });
  initialize();
}
