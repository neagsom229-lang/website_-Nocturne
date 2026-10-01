import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { createPlaylistsRouter } from '../backend/routes/playlists.js';

class MemoryPlaylistDatabase {
  constructor() {
    this.playlists = [];
    this.items = [];
    this.media = [
      { id: 'media-one', userId: 'owner', type: 'audio', mediaType: 'music', title: 'Soft Static' },
      { id: 'media-two', userId: 'owner', type: 'audio', mediaType: 'music', title: 'Room Tone' },
      { id: 'media-three', userId: 'owner', type: 'audio', mediaType: 'music', title: 'Window Rain' },
    ];
    this.nextPlaylistId = 1;
    this.nextItemId = 1;
    this.transactionCount = 0;
    this.transactionUpdateCounts = [];
  }

  prepare(sql) {
    const query = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    return {
      get: async (...params) => {
        if (query.startsWith('insert into playlists')) {
          const [userId, name, description, isPublic] = params;
          const now = new Date().toISOString();
          const playlist = {
            id: this.nextPlaylistId++, userId, name, description, isPublic,
            coverUrl: null, createdAt: now, updatedAt: now,
          };
          this.playlists.push(playlist);
          return { ...playlist };
        }
        if (query.includes('from playlists p') && query.includes('where p.id = $1')) {
          const playlist = this.playlists.find((item) => item.id === params[0]);
          if (!playlist) return undefined;
          return {
            ...playlist,
            ownerDisplayName: playlist.userId === 'owner' ? 'Night Listener' : 'Guest',
            itemCount: this.items.filter((item) => item.playlistId === playlist.id).length,
          };
        }
        if (query.includes('from playlists where id = $1')) {
          const playlist = this.playlists.find((item) => item.id === params[0]);
          return playlist ? { ...playlist } : undefined;
        }
        if (query.includes('from media_library')) {
          const media = this.media.find((item) => item.id === params[0] && item.userId === params[1]);
          return media ? { id: media.id } : undefined;
        }
        if (query.includes('coalesce(max(position), 0)')) {
          const positions = this.items
            .filter((item) => item.playlistId === params[0])
            .map((item) => item.position);
          return { position: positions.length ? Math.max(...positions) + 1 : 1 };
        }
        if (query.startsWith('insert into playlist_items')) {
          const [playlistId, mediaLibraryId, position] = params;
          const item = {
            id: this.nextItemId++, playlistId, mediaLibraryId, position,
            addedAt: new Date().toISOString(),
          };
          this.items.push(item);
          return { ...item, playlistId, mediaLibraryId };
        }
        if (query.startsWith('update playlists set')) {
          const [id, name, description, isPublic, coverUrl] = params;
          const playlist = this.playlists.find((item) => item.id === id);
          if (!playlist) return undefined;
          Object.assign(playlist, { name, description, isPublic, coverUrl, updatedAt: new Date().toISOString() });
          return { ...playlist };
        }
        return undefined;
      },
      all: async (...params) => {
        if (query.includes('from playlists p') && query.includes('where p.user_id = $1')) {
          return this.playlists.filter((item) => item.userId === params[0]).map((item) => ({
            ...item,
            itemCount: this.items.filter((entry) => entry.playlistId === item.id).length,
          }));
        }
        if (query.includes('from playlists p') && query.includes('where p.is_public = true')) {
          return this.playlists.filter((item) => item.isPublic).map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            isPublic: item.isPublic,
            coverUrl: item.coverUrl,
            createdAt: item.createdAt,
            itemCount: this.items.filter((entry) => entry.playlistId === item.id).length,
            ownerDisplayName: item.userId === 'owner' ? 'Night Listener' : 'Guest',
          }));
        }
        if (query.includes('join media_library m')) {
          return this.items
            .filter((item) => item.playlistId === params[0])
            .sort((a, b) => a.position - b.position)
            .map((item) => {
              const media = this.media.find((entry) => entry.id === item.mediaLibraryId);
              return { ...item, ...media, mediaLibraryId: item.mediaLibraryId };
            });
        }
        if (query.startsWith('select id from playlist_items')) {
          return this.items
            .filter((item) => item.playlistId === params[0])
            .sort((a, b) => a.position - b.position)
            .map(({ id }) => ({ id }));
        }
        if (query.startsWith('select id, media_library_id as')) {
          return this.items
            .filter((item) => item.playlistId === params[0])
            .sort((a, b) => a.position - b.position)
            .map((item) => ({ ...item, mediaLibraryId: item.mediaLibraryId }));
        }
        return [];
      },
      run: async (...params) => {
        if (query.startsWith('update playlist_items set position')) {
          const [id, playlistId, position] = params;
          const item = this.items.find((entry) => entry.id === id && entry.playlistId === playlistId);
          if (item) {
            item.position = position;
            this.currentTransactionUpdateCount += 1;
          }
          return { changes: item ? 1 : 0 };
        }
        if (query.startsWith('delete from playlist_items')) {
          const [id, playlistId] = params;
          const index = this.items.findIndex((entry) => entry.id === id && entry.playlistId === playlistId);
          if (index === -1) return { changes: 0 };
          this.items.splice(index, 1);
          return { changes: 1 };
        }
        if (query.startsWith('delete from playlists')) {
          const index = this.playlists.findIndex((item) => item.id === params[0]);
          if (index === -1) return { changes: 0 };
          this.playlists.splice(index, 1);
          return { changes: 1 };
        }
        return { changes: 0 };
      },
    };
  }

  async transaction(callback) {
    this.transactionCount += 1;
    this.currentTransactionUpdateCount = 0;
    const value = await callback(this);
    this.transactionUpdateCounts.push(this.currentTransactionUpdateCount);
    return value;
  }
}

async function withPlaylistsServer(callback) {
  const database = new MemoryPlaylistDatabase();
  const app = express();
  app.use(express.json());
  const authenticate = (request, response, next) => {
    const userId = request.get('x-user-id');
    if (!userId) return response.status(401).json({ error: 'Please log in to continue' });
    request.user = { id: userId };
    return next();
  };
  app.use('/api/playlists', createPlaylistsRouter({ database, authenticate }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const call = async (path, { user, method = 'GET', body } = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(user ? { 'x-user-id': user } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { response, body: response.status === 204 ? null : await response.json() };
  };
  try {
    await callback({ call, database });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('creating a playlist returns a validated playlist shape', async () => {
  await withPlaylistsServer(async ({ call }) => {
    const { response, body } = await call('/api/playlists', {
      user: 'owner',
      method: 'POST',
      body: { name: '  Late Night  ', description: 'Soft songs', is_public: true },
    });
    assert.equal(response.status, 201);
    assert.equal(body.playlist.name, 'Late Night');
    assert.equal(body.playlist.description, 'Soft songs');
    assert.equal(body.playlist.isPublic, true);
  });
});

test('GET /mine with auth returns the current user playlist array', async () => {
  await withPlaylistsServer(async ({ call }) => {
    const created = await call('/api/playlists', {
      user: 'owner',
      method: 'POST',
      body: { name: 'After Hours' },
    });
    assert.equal(created.response.status, 201);
    const result = await call('/api/playlists/mine', { user: 'owner' });
    assert.equal(result.response.status, 200);
    assert.ok(Array.isArray(result.body.playlists));
    assert.equal(result.body.playlists[0].name, 'After Hours');
  });
});

test('adding items appends positions and reorder is transactional and gap-free', async () => {
  await withPlaylistsServer(async ({ call, database }) => {
    const created = await call('/api/playlists', {
      user: 'owner',
      method: 'POST',
      body: { name: 'After Hours' },
    });
    const playlistId = created.body.playlist.id;
    const first = await call(`/api/playlists/${playlistId}/items`, {
      user: 'owner',
      method: 'POST',
      body: { media_library_id: 'media-one' },
    });
    const second = await call(`/api/playlists/${playlistId}/items`, {
      user: 'owner',
      method: 'POST',
      body: { media_library_id: 'media-two' },
    });
    const third = await call(`/api/playlists/${playlistId}/items`, {
      user: 'owner',
      method: 'POST',
      body: { media_library_id: 'media-three' },
    });
    assert.equal(first.body.item.position, 1);
    assert.equal(second.body.item.position, 2);
    assert.equal(third.body.item.position, 3);

    const reordered = await call(`/api/playlists/${playlistId}/reorder`, {
      user: 'owner',
      method: 'POST',
      body: { item_ids: [third.body.item.id, first.body.item.id, second.body.item.id] },
    });
    assert.equal(reordered.response.status, 200);
    assert.deepEqual(reordered.body.items.map((item) => item.id), [
      third.body.item.id,
      first.body.item.id,
      second.body.item.id,
    ]);
    assert.deepEqual(reordered.body.items.map((item) => item.position), [1, 2, 3]);
    assert.equal(database.transactionUpdateCounts.at(-1), 3);

    const invalid = await call(`/api/playlists/${playlistId}/reorder`, {
      user: 'owner',
      method: 'POST',
      body: { item_ids: [first.body.item.id, second.body.item.id] },
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.error, 'item_ids must contain every playlist item exactly once.');
    assert.equal(database.transactionUpdateCounts.at(-1), 0);
    assert.deepEqual(
      database.items
        .filter((item) => item.playlistId === playlistId)
        .sort((left, right) => left.position - right.position)
        .map((item) => item.position),
      [1, 2, 3],
    );
  });
});

test('a non-owner cannot patch a playlist', async () => {
  await withPlaylistsServer(async ({ call }) => {
    const created = await call('/api/playlists', {
      user: 'owner',
      method: 'POST',
      body: { name: 'Private set' },
    });
    const result = await call(`/api/playlists/${created.body.playlist.id}`, {
      user: 'other',
      method: 'PATCH',
      body: { name: 'Taken over' },
    });
    assert.equal(result.response.status, 403);
  });
});

test('public playlists are accessible without authentication', async () => {
  await withPlaylistsServer(async ({ call }) => {
    const created = await call('/api/playlists', {
      user: 'owner',
      method: 'POST',
      body: { name: 'Public set', is_public: true },
    });
    const detail = await call(`/api/playlists/${created.body.playlist.id}`);
    const listing = await call('/api/playlists/public');
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.playlist.name, 'Public set');
    assert.equal(listing.response.status, 200);
    assert.equal(listing.body.playlists[0].ownerDisplayName, 'Night Listener');
  });
});

test('a private playlist returns 403 to a different user', async () => {
  await withPlaylistsServer(async ({ call }) => {
    const created = await call('/api/playlists', {
      user: 'owner',
      method: 'POST',
      body: { name: 'Private set' },
    });
    const result = await call(`/api/playlists/${created.body.playlist.id}`, { user: 'other' });
    assert.equal(result.response.status, 403);
  });
});
