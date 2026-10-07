import 'dotenv/config';
import pg from 'pg';
import { getSslConfig } from './dbConfig.js';

const { Pool, types } = pg;
types.setTypeParser(20, Number);
types.setTypeParser(1700, Number);
const rawDatabaseUrl = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL;
if (!rawDatabaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. On Render, add it under Environment → Add Environment Variable using your Supabase Shared Pooler connection string (host *.pooler.supabase.com, port 6543, ?pgbouncer=true).',
  );
}

const databaseUrl = new URL(rawDatabaseUrl);
const dbHost = databaseUrl.hostname;
const dbPort = databaseUrl.port || '5432';
databaseUrl.searchParams.set('pgbouncer', 'true');
const ssl = getSslConfig(databaseUrl);
const pool = new Pool({
  connectionString: databaseUrl.toString(),
  ssl,
});
process.on('exit', () => {
  try {
    pool.end();
  } catch {}
});
console.info(
  `Connecting to PostgreSQL at ${dbHost}:${dbPort} `
  + `as ${databaseUrl.username} `
  + `(ssl.rejectUnauthorized=${ssl?.rejectUnauthorized ?? 'default'})`,
);

function databaseFor(query) {
  return {
    prepare(sql) {
      return {
        async get(...params) {
          const result = await query(sql, params);
          return result.rows[0];
        },
        async all(...params) {
          const result = await query(sql, params);
          return result.rows;
        },
        async run(...params) {
          const result = await query(sql, params);
          return { changes: result.rowCount };
        },
      };
    },
  };
}

export const db = {
  ...databaseFor((sql, params) => pool.query(sql, params)),
  async transaction(callback) {
    const client = await pool.connect();
    const tx = databaseFor((sql, params) => client.query(sql, params));
    try {
      await client.query('BEGIN');
      const value = await callback(tx);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
  query(sql, params) {
    return pool.query(sql, params);
  },
  async close() {
    await pool.end();
  },
};

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

const seed = async () => db.transaction(async (tx) => {
  await tx.prepare('INSERT INTO users (id, display_name) VALUES ($1, $2) ON CONFLICT DO NOTHING').run(
    'guest',
    'Night listener',
  );

  const insertMix = tx.prepare(`
    INSERT INTO music_mixes (id, title, note, cover, tags_json, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`);
  const insertTrack = tx.prepare(`
    INSERT INTO music_tracks
      (id, mix_id, position, title, artist, duration_seconds, cover)
    VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`);

  for (const [mixOrder, mix] of seedMixes.entries()) {
    await insertMix.run(mix.id, mix.title, mix.note, mix.cover, JSON.stringify(mix.tags), mixOrder);
    for (const [index, [id, title, artist, seconds, cover]] of mix.tracks.entries()) {
      await insertTrack.run(id, mix.id, index, title, artist, seconds, cover);
    }
  }

  const insertShow = tx.prepare(`
    INSERT INTO podcast_shows (id, title, host, blurb, art, cadence, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`);
  for (const [sortOrder, show] of seedShows.entries()) {
    await insertShow.run(...show, sortOrder);
  }

  const insertEpisode = tx.prepare(`
    INSERT INTO podcast_episodes
      (id, show_id, title, summary, duration_seconds, published, season, episode_number, audio_url, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`);
  for (const [sortOrder, episode] of seedEpisodes.entries()) {
    await insertEpisode.run(...episode, 'https://discoveryprovider.audius.co/v1/tracks/95wro/stream?app_name=Nocturne', sortOrder);
  }

  const saveEpisode = tx.prepare('INSERT INTO podcast_listen_later (user_id, episode_id) VALUES ($1, $2) ON CONFLICT DO NOTHING');
  await saveEpisode.run('guest', 'e3');
  await saveEpisode.run('guest', 'e5');

  await tx.prepare(`
    INSERT INTO podcast_player_states (user_id, episode_id)
    VALUES ($1, $2) ON CONFLICT DO NOTHING`).run('guest', 'e1');

  await tx.prepare(`
    INSERT INTO now_playing_states (user_id, mix_id, track_id)
    VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`).run('guest', 'three-am', 't1');

  const insertJournalEntry = tx.prepare(`
    INSERT INTO journal_entries
      (id, user_id, entry_date, human_date, mood, song, artist, note, photo, rating)
    VALUES ($1, 'guest', $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`);
  for (const entry of seedJournalEntries) {
    await insertJournalEntry.run(...entry);
  }

  const insertDatingProfile = tx.prepare(`
    INSERT INTO dating_profiles
      (id, name, age, distance_km, headline, bio, interests_json, song, prompt_question, prompt_answer, photo, last_active, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT DO NOTHING`);
  for (const [sortOrder, profile] of seedDatingProfiles.entries()) {
    const [id, name, age, distance, headline, bio, interests, song, question, answer, photo, lastActive] = profile;
    await insertDatingProfile.run(id, name, age, distance, headline, bio, JSON.stringify(interests), song, question, answer, photo, lastActive, sortOrder);
  }
  await tx.prepare(`
    INSERT INTO dating_user_profiles (user_id, name, age, headline, bio, song, interests_json)
    VALUES ('guest', 'You', 27, 'Usually awake when the good songs come on', 'Here for the quiet company and the playlists we can trade.', 'Fairy Lights Left On — Ivy Lorne', '["late walks","one good lamp","sad songs"]') ON CONFLICT DO NOTHING`).run();
  await tx.prepare('INSERT INTO dating_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING').run('guest');
  await tx.prepare('INSERT INTO dating_matches (user_id, profile_id) VALUES ($1, $2) ON CONFLICT DO NOTHING').run('guest', 'p1');
  await tx.prepare('INSERT INTO dating_matches (user_id, profile_id) VALUES ($1, $2) ON CONFLICT DO NOTHING').run('guest', 'p2');
  const insertDatingMessage = tx.prepare(`
    INSERT INTO dating_messages (id, user_id, profile_id, sender, text, sort_order)
    VALUES ($1, 'guest', $2, $3, $4, $5) ON CONFLICT DO NOTHING`);
  for (const [sortOrder, [id, profileId, sender, text]] of seedDatingMessages.entries()) {
    await insertDatingMessage.run(id, profileId, sender, text, sortOrder);
  }
});

export async function initializeDatabase() {
  const startTime = Date.now();
  let attempts = 5;
  let delay = 1000;
  let connected = false;
  let lastError;

  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('SELECT 1');
      connected = true;
      console.info(`Connected to PostgreSQL at ${dbHost}:${dbPort}`);
      break;
    } catch (error) {
      lastError = error;
      console.warn(`[db] Connection attempt ${i}/${attempts} failed (host: ${dbHost}, port: ${dbPort}). Error: ${error.message}`);
      if (i < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  if (!connected) {
    console.error(`[db] FATAL: Failed to connect to PostgreSQL at ${dbHost}:${dbPort} after ${attempts} attempts.`);
    console.error(`[db] Please check your DATABASE_URL environment variable and ensure PostgreSQL is running.`);
    throw new Error(`Database connection failed: ${lastError?.message || 'ECONNREFUSED'}`);
  }

  await seed();
  try {
    const expectedColumns = [
      'id', 'display_name', 'bio', 'avatar_url', 'is_public',
      'deleted_at', 'welcomed_at', 'deletion_scheduled_for', 'email',
      'password_hash', 'supabase_uid', 'email_verified', 'legacy_auth', 'created_at'
    ];
    const { rows } = await db.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'users'
    `);
    const existing = new Set(rows.map(r => r.column_name));
    for (const col of expectedColumns) {
      if (!existing.has(col)) {
        console.warn(`[db] WARNING: Expected column '${col}' is missing from 'users' table.`);
      }
    }
  } catch (error) {
    console.debug('Could not verify users table columns:', error.message);
  }

  try {
    const constraintCheck = await db.prepare(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'search_cache'::regclass AND contype = 'p'
    `).get();
    const pkDef = constraintCheck?.def ?? '';
    if (!pkDef.includes('sort')) {
      console.warn('WARNING: search_cache primary key does not include the "sort" column. Migration 013 may not have been applied.');
      throw new Error('Database schema is out of date: search_cache primary key must include (query, type, sort). Please apply migration 013.');
    }
  } catch (error) {
    if (error.message.includes('Database schema is out of date')) {
      throw error;
    }
    console.debug('Could not verify search_cache primary key constraint:', error.message);
  }

  try {
    const expected = [
      'video', 'podcast', 'audio', 'movie', 'music', 'video_podcast',
      'tv', 'audiobook', 'youtube', 'deezer', 'librivox', 'all', 'suggest'
    ];
    const { rows } = await db.query(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conname = 'search_cache_type_check'
    `);
    const def = rows[0]?.def ?? '';
    const missing = expected.filter(t => !def.includes(`'${t}'`));
    if (missing.length) {
      console.error(`[db] FATAL: search_cache constraint missing types: ${missing.join(', ')}. Run the latest search_cache migration.`);
      process.exit(1);
    }
    console.info('[db] search_cache constraint includes all expected types');
  } catch (error) {
    console.debug('Could not verify search_cache_type_check constraint:', error.message);
  }

  const durationMs = Date.now() - startTime;
  console.info(`[db] Database initialized successfully in ${durationMs}ms`);
}

export function initializeUserData(user, tx) {
  const initialize = async (connection) => {
    await connection.prepare(`
      INSERT INTO dating_user_profiles (user_id, name, age, headline, bio, song, interests_json)
      VALUES ($1, $2, 27, 'Usually awake when the good songs come on',
        'Here for the quiet company and the playlists we can trade.',
        'Fairy Lights Left On — Ivy Lorne', '["late walks","one good lamp","sad songs"]')
    `).run(user.id, user.displayName);

    await connection.prepare(`
      INSERT INTO now_playing_states (user_id, mix_id, track_id)
      VALUES ($1, 'three-am', 't1')
    `).run(user.id);
    await connection.prepare(`
      INSERT INTO podcast_player_states (user_id, episode_id)
      VALUES ($1, 'e1')
    `).run(user.id);
    await connection.prepare('INSERT INTO dating_preferences (user_id) VALUES ($1)').run(user.id);
  };
  return tx ? initialize(tx) : db.transaction(initialize);
}
