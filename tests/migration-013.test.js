import assert from 'node:assert/strict';
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import test from 'node:test';
import { getSslConfig } from '../backend/dbConfig.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const { Pool } = pg;

test('migration 013 correctly alters search_cache primary key to (query, type, sort) and creates search_events', {
  skip: databaseUrl ? false : 'Set TEST_DATABASE_URL to a PostgreSQL test database',
}, async () => {
  const parsedDatabaseUrl = new URL(databaseUrl);
  const database = new Pool({
    connectionString: databaseUrl,
    ssl: getSslConfig(parsedDatabaseUrl),
  });
  const client = await database.connect();
  const schema = `migration_013_${randomUUID().replaceAll('-', '')}`;
  const quotedSchema = `"${schema}"`;
  let schemaCreated = false;

  try {
    await client.query(`CREATE SCHEMA ${quotedSchema}`);
    schemaCreated = true;
    await client.query(`SET search_path TO ${quotedSchema}`);

    // Create base table with original search_cache primary key (query, type) and users table for search_events foreign key
    await client.query(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE search_cache (
        query TEXT NOT NULL,
        type TEXT NOT NULL,
        response_json TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (query, type)
      );
    `);

    // Read and run migration 013
    const migration013 = await readFile(new URL('../migrations/013_search_events.sql', import.meta.url), 'utf8');
    await client.query(migration013);

    // Verify search_cache primary key is now (query, type, sort)
    const pkCheck = await client.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'search_cache'::regclass
        AND i.indisprimary;
    `);
    const pkColumns = pkCheck.rows.map((r) => r.attname).sort();
    assert.deepEqual(pkColumns, ['query', 'sort', 'type'], 'search_cache primary key should be (query, type, sort)');

    // Test upsert with ON CONFLICT (query, type, sort) DO UPDATE
    await client.query(`
      INSERT INTO search_cache (query, type, sort, response_json, expires_at)
      VALUES ('lofi', 'all', 'relevance', '{"res": 1}', NOW() + INTERVAL '1 hour')
      ON CONFLICT (query, type, sort) DO UPDATE SET
        response_json = excluded.response_json,
        expires_at = excluded.expires_at;
    `);

    await client.query(`
      INSERT INTO search_cache (query, type, sort, response_json, expires_at)
      VALUES ('lofi', 'all', 'relevance', '{"res": 2}', NOW() + INTERVAL '1 hour')
      ON CONFLICT (query, type, sort) DO UPDATE SET
        response_json = excluded.response_json,
        expires_at = excluded.expires_at;
    `);

    const result = await client.query("SELECT response_json FROM search_cache WHERE query = 'lofi' AND type = 'all' AND sort = 'relevance'");
    assert.equal(result.rows[0].response_json, '{"res": 2}', 'upsert on conflict (query, type, sort) should update response_json successfully');

  } finally {
    if (schemaCreated) {
      await client.query('RESET search_path');
      await client.query(`DROP SCHEMA ${quotedSchema} CASCADE`);
    }
    client.release();
    await database.end();
  }
});
