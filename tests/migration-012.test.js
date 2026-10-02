import assert from 'node:assert/strict';
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import test from 'node:test';
import { getSslConfig } from '../backend/dbConfig.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const migration = await readFile(new URL('../migrations/012_social.sql', import.meta.url), 'utf8');
const { Pool } = pg;

test('migration 012 handles a clean users table without deleted_at and is repeatable', {
  skip: databaseUrl ? false : 'Set TEST_DATABASE_URL to a PostgreSQL test database',
}, async () => {
  const parsedDatabaseUrl = new URL(databaseUrl);
  const database = new Pool({
    connectionString: databaseUrl,
    ssl: getSslConfig(parsedDatabaseUrl),
  });
  const client = await database.connect();
  const schema = `migration_012_${randomUUID().replaceAll('-', '')}`;
  const quotedSchema = `"${schema}"`;
  let schemaCreated = false;

  try {
    await client.query(`CREATE SCHEMA ${quotedSchema}`);
    schemaCreated = true;
    await client.query(`SET search_path TO ${quotedSchema}`);
    await client.query('CREATE TABLE users (id TEXT PRIMARY KEY, is_public BOOLEAN NOT NULL DEFAULT false)');
    await client.query('CREATE TABLE media_library (id TEXT PRIMARY KEY)');
    await client.query("INSERT INTO users (id, is_public) VALUES ('preference', true)");

    const beforeMigration = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'users'
        AND column_name = 'deleted_at'
    `);
    assert.equal(beforeMigration.rowCount, 0, 'clean users table starts without deleted_at');

    await client.query(migration);
    const afterMigration = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'users'
        AND column_name IN ('display_name', 'deleted_at')
    `);
    assert.deepEqual(
      afterMigration.rows.map(({ column_name }) => column_name).sort(),
      ['deleted_at', 'display_name'],
      'migration adds columns referenced by its constraints',
    );
    const preferenceAfterMigration = await client.query(
      "SELECT is_public FROM users WHERE id = 'preference'",
    );
    assert.equal(preferenceAfterMigration.rows[0].is_public, true, 'migration preserves existing visibility preferences');

    await client.query(migration);
    const preferenceAfterRerun = await client.query(
      "SELECT is_public FROM users WHERE id = 'preference'",
    );
    assert.equal(preferenceAfterRerun.rows[0].is_public, true, 'rerunning migration preserves visibility preferences');
  } finally {
    if (schemaCreated) {
      await client.query('RESET search_path');
      await client.query(`DROP SCHEMA ${quotedSchema} CASCADE`);
    }
    client.release();
    await database.end();
  }
});
