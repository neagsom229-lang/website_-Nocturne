import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';

const password = 'a-night-in-the-listening-room';

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

test('production server serves the app and isolates authenticated feature data', async (context) => {
  const directory = mkdtempSync(join(tmpdir(), 'bedroom-pop-production-'));
  const databasePath = join(directory, 'test.sqlite');
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      DATABASE_PATH: databasePath,
      JWT_SECRET: 'production-integration-test-secret-long-enough-for-jwt',
      CORS_ORIGIN: baseUrl,
      YOUTUBE_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  server.stdout.setEncoding('utf8').on('data', (chunk) => { logs += chunk; });
  server.stderr.setEncoding('utf8').on('data', (chunk) => { logs += chunk; });

  context.after(async () => {
    if (server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => server.once('exit', resolve));
    }
    rmSync(directory, { recursive: true, force: true });
  });

  async function waitForServer() {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (server.exitCode !== null) throw new Error(`Production server exited early:\n${logs}`);
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Production server did not become ready:\n${logs}`);
  }

  async function call(path, options = {}) {
    const headers = {
      ...(options.headers ?? {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      Origin: baseUrl,
    };
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    let body = null;
    if (response.status !== 204) body = await response.json();
    assert.ok(response.status < 500, `${path} returned ${response.status}: ${JSON.stringify(body)}`);
    return { response, body };
  }

  function cookieFrom(response) {
    const cookie = response.headers.get('set-cookie');
    assert.ok(cookie, 'auth response sets a session cookie');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=Lax/i);
    return cookie.split(';', 1)[0];
  }

  const jsonRequest = (method, body) => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  await waitForServer();

  assert.equal((await fetch(`${baseUrl}/api/search?q=music&type=video`)).status, 401);
  for (const path of [
    '/',
    '/landing',
    '/auth/login',
    '/auth/register',
    '/static/shows',
    '/search?q=late%20night&type=podcast',
    '/library',
    '/mood',
    '/settings/appearance',
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} serves the React application`);
    assert.match(await response.text(), /id="root"/);
  }
  assert.equal((await fetch(`${baseUrl}/api/music/mixes`)).status, 401, 'feature APIs require a session');

  const firstRegistration = await call('/api/auth/register', {
    ...jsonRequest('POST', { displayName: 'June', email: 'june@example.com', password }),
  });
  assert.equal(firstRegistration.response.status, 201);
  const firstUserId = firstRegistration.body.user.id;
  const firstCookie = cookieFrom(firstRegistration.response);
  assert.equal((await call('/api/auth/me', { cookie: firstCookie })).body.user.id, firstUserId);

  const database = new Database(databasePath, { readonly: true });
  const passwordHash = database.prepare('SELECT password_hash FROM users WHERE id = ?').get(firstUserId).password_hash;
  database.close();
  assert.match(passwordHash, /^\$2[aby]\$/, 'password is stored as a bcrypt hash');

  assert.equal(
    (await call('/api/auth/register', {
      ...jsonRequest('POST', { displayName: 'June again', email: 'JUNE@example.com', password }),
    })).response.status,
    409,
    'registration rejects a case-insensitive duplicate email',
  );

  const login = await call('/api/auth/login', {
    ...jsonRequest('POST', { email: 'JUNE@example.com', password }),
  });
  assert.equal(login.response.status, 200);
  const secondCookie = cookieFrom(login.response);
  assert.equal(login.body.user.id, firstUserId);

  assert.equal((await call('/api/search?q=music&type=unknown', { cookie: secondCookie })).response.status, 400);
  const unconfiguredVideoResponse = await fetch(`${baseUrl}/api/search?q=music&type=video`, {
    headers: { Cookie: secondCookie, Origin: baseUrl },
  });
  assert.equal(unconfiguredVideoResponse.status, 503);
  assert.match((await unconfiguredVideoResponse.json()).error, /YOUTUBE_API_KEY/);

  const savedMedia = await call('/api/library/save', {
    cookie: secondCookie,
    ...jsonRequest('POST', {
      type: 'video',
      provider: 'youtube',
      externalId: 'video-123',
      title: 'A song to keep',
      artist: 'June',
      thumbnailUrl: 'https://img.example/video.jpg',
      streamUrl: 'https://www.youtube.com/embed/video-123',
      externalUrl: 'https://www.youtube.com/watch?v=video-123',
    }),
  });
  assert.equal(savedMedia.response.status, 201);
  const libraryItemId = savedMedia.body.item.id;
  assert.equal((await call('/api/library', { cookie: secondCookie })).body.items.length, 1);
  const duplicateMedia = await call('/api/library/save', {
    cookie: secondCookie,
    ...jsonRequest('POST', {
      type: 'video',
      provider: 'youtube',
      externalId: 'video-123',
      title: 'A song to keep',
      streamUrl: 'https://www.youtube.com/embed/video-123',
    }),
  });
  assert.equal(duplicateMedia.response.status, 200);
  assert.equal(duplicateMedia.body.alreadySaved, true);
  assert.equal((await call('/api/library/save', {
    cookie: secondCookie,
    ...jsonRequest('POST', {
      type: 'audio',
      provider: 'itunes',
      externalId: 'bad-url',
      title: 'Insecure source',
      streamUrl: 'http://audio.example/track.mp3',
    }),
  })).response.status, 400);

  assert.equal((await call('/api/music/mixes', { cookie: secondCookie })).body.mixes.length, 6);
  assert.equal((await call('/api/podcasts/shows', { cookie: secondCookie })).body.shows.length, 3);
  assert.equal((await call('/api/podcasts/listen-later', { cookie: secondCookie })).body.episodes.length, 0);
  const savedEpisode = await call('/api/podcasts/listen-later', {
    cookie: secondCookie,
    ...jsonRequest('POST', { episodeId: 'e2' }),
  });
  assert.equal(savedEpisode.response.status, 201);
  assert.equal((await call('/api/journal/entries', { cookie: secondCookie })).body.entries.length, 0);
  const entry = await call('/api/journal/entries', {
    cookie: secondCookie,
    ...jsonRequest('POST', {
      entryDate: '2026-10-01',
      mood: 'quiet',
      song: 'A small song',
      artist: 'June',
      note: 'Saved in my own room.',
      rating: 4,
    }),
  });
  assert.equal(entry.response.status, 201);
  assert.equal((await call('/api/journal/stats', { cookie: secondCookie })).body.entries, 1);
  assert.equal((await call('/api/dating/profiles', { cookie: secondCookie })).body.profiles.length, 4);

  const secondRegistration = await call('/api/auth/register', {
    ...jsonRequest('POST', { displayName: 'Noor', email: 'noor@example.com', password }),
  });
  assert.equal(secondRegistration.response.status, 201);
  const otherCookie = cookieFrom(secondRegistration.response);
  assert.notEqual(secondRegistration.body.user.id, firstUserId);
  assert.equal((await call('/api/library', { cookie: otherCookie })).body.items.length, 0);
  assert.equal((await call(`/api/library/${libraryItemId}`, {
    method: 'DELETE',
    cookie: otherCookie,
  })).response.status, 404);
  assert.equal((await call('/api/library', { cookie: secondCookie })).body.items.length, 1);
  assert.equal((await call(`/api/library/${libraryItemId}`, {
    method: 'DELETE',
    cookie: secondCookie,
  })).response.status, 204);
  assert.equal((await call('/api/library', { cookie: secondCookie })).body.items.length, 0);
  assert.equal((await call('/api/podcasts/listen-later', { cookie: otherCookie })).body.episodes.length, 0);
  assert.equal((await call('/api/journal/entries', { cookie: otherCookie })).body.entries.length, 0);
  assert.equal((await call('/api/dating/profiles', { cookie: otherCookie })).body.profiles.length, 4);

  assert.equal((await call('/api/auth/logout', { method: 'POST', cookie: secondCookie })).response.status, 204);
  assert.equal((await call('/api/auth/me', { cookie: secondCookie })).response.status, 401);
  assert.equal((await call('/api/auth/me', { cookie: firstCookie })).response.status, 200, 'logout revokes only its own session');
});
