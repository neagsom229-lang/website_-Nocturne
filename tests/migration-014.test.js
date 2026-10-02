import assert from 'node:assert/strict';
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import test from 'node:test';
import { getSslConfig } from '../backend/dbConfig.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const { Pool } = pg;

test('migration 014 allows all whitelisted types in search_cache check constraint without violations', {
  skip: databaseUrl ? false : 'Set TEST_DATABASE_URL to a PostgreSQL test database',
}, async () => {
  const parsedDatabaseUrl = new URL(databaseUrl);
  const database = new Pool({
    connectionString: databaseUrl,
    ssl: getSslConfig(parsedDatabaseUrl),
  });
  const client = await database.connect();
  const schema = `migration_014_${randomUUID().replaceAll('-', '')}`;
  const quotedSchema = `"${schema}"`;
  let schemaCreated = false;

  try {
    await client.query(`CREATE SCHEMA ${quotedSchema}`);
    schemaCreated = true;
    await client.query(`SET search_path TO ${quotedSchema}`);

    // Create table with original strict check constraint (without 'all' or 'suggest')
    await client.query(`
      CREATE TABLE search_cache (
        query TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('video', 'podcast', 'audio', 'movie', 'music', 'video_podcast')),
        sort TEXT NOT NULL DEFAULT 'relevance',
        response_json TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (query, type, sort)
      );
    `);

    // Read and run migration 014
    const migration014 = await readFile(new URL('../migrations/014_search_cache_allow_all.sql', import.meta.url), 'utf8');
    await client.query(migration014);

    const whitelistedTypes = ['video', 'podcast', 'audio', 'movie', 'music', 'video_podcast', 'all', 'suggest'];

    for (const type of whitelistedTypes) {
      await client.query(`
        INSERT INTO search_cache (query, type, sort, response_json, expires_at)
        VALUES ('test-query', $1, 'relevance', '{"ok": true}', NOW() + INTERVAL '1 hour')
        ON CONFLICT (query, type, sort) DO NOTHING;
      `, [type]);
    }

    const countResult = await client.query('SELECT COUNT(*)::int AS count FROM search_cache');
    assert.equal(countResult.rows[0].count, whitelistedTypes.length, 'All whitelisted types should be successfully inserted into search_cache');

  } finally {
    if (schemaCreated) {
      await client.query('RESET search_path');
      await client.query(`DROP SCHEMA ${quotedSchema} CASCADE`);
    }
    client.release();
    await database.end();
  }
});
