import { Router } from 'express';

const MAX_PUBLIC_LIMIT = 100;

function validPlaylistId(value) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function validateName(value) {
  return typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= 120;
}

function validateDescription(value) {
  return value === null || (
    typeof value === 'string' && value.length <= 500
  );
}

function playlistFields() {
  return `id, user_id AS "userId", name, description, is_public AS "isPublic",
    cover_url AS "coverUrl", created_at AS "createdAt", updated_at AS "updatedAt"`;
}

async function findPlaylist(database, id) {
  return database.prepare(`SELECT ${playlistFields()} FROM playlists WHERE id = $1`).get(id);
}

async function requireOwner(database, request, response) {
  const playlist = await findPlaylist(database, Number(request.params.id));
  if (!playlist) {
    response.status(404).json({ error: 'Playlist not found' });
    return null;
  }
  if (playlist.userId !== request.user.id) {
    response.status(403).json({ error: 'Only the playlist owner can make this change' });
    return null;
  }
  return playlist;
}

export async function listPublicPlaylists(database, { sort = 'popular', limit = 8, offset = 0 } = {}) {
  const order = sort === 'popular'
    ? '"itemCount" DESC, p.created_at DESC'
    : 'p.created_at DESC';
  return database.prepare(`
    SELECT p.id, p.name, p.description, p.is_public AS "isPublic",
      p.cover_url AS "coverUrl", p.created_at AS "createdAt",
      COUNT(pi.id)::int AS "itemCount",
      u.display_name AS "ownerDisplayName"
    FROM playlists p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
    WHERE p.is_public = true AND u.deleted_at IS NULL
    GROUP BY p.id, u.display_name
    ORDER BY ${order}
    LIMIT $1 OFFSET $2
  `).all(limit, offset);
}

export function createPlaylistsRouter({ database, authenticate }) {
  const router = Router();

  router.post('/', authenticate, async (request, response) => {
    const { name, description = null, is_public: isPublic = false } = request.body ?? {};
    if (!validateName(name)) {
      return response.status(400).json({ error: 'Playlist name must be between 1 and 120 characters.' });
    }
    if (!validateDescription(description)) {
      return response.status(400).json({ error: 'Playlist description must be 500 characters or fewer.' });
    }
    if (typeof isPublic !== 'boolean') {
      return response.status(400).json({ error: 'is_public must be a boolean.' });
    }

    const playlist = await database.prepare(`
      INSERT INTO playlists (user_id, name, description, is_public)
      VALUES ($1, $2, $3, $4)
      RETURNING ${playlistFields()}
    `).get(request.user.id, name.trim(), description, isPublic);
    return response.status(201).json({ playlist });
  });

  router.get('/mine', authenticate, async (request, response) => {
    const playlists = await database.prepare(`
      SELECT p.id, p.user_id AS "userId", p.name, p.description,
        p.is_public AS "isPublic", p.cover_url AS "coverUrl",
        p.created_at AS "createdAt", p.updated_at AS "updatedAt",
        COUNT(pi.id)::int AS "itemCount"
      FROM playlists p
      LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id
      ORDER BY p.updated_at DESC, p.id DESC
    `).all(request.user.id);
    return response.json({ playlists });
  });

  router.get('/public', async (request, response) => {
    const sort = request.query.sort ?? 'recent';
    if (!['recent', 'popular'].includes(sort)) {
      return response.status(400).json({ error: 'sort must be "recent" or "popular".' });
    }

    const limit = request.query.limit === undefined ? 20 : Number(request.query.limit);
    const offset = request.query.offset === undefined ? 0 : Number(request.query.offset);
    if (
      !Number.isInteger(limit) || limit < 1 || limit > MAX_PUBLIC_LIMIT ||
      !Number.isInteger(offset) || offset < 0
    ) {
      return response.status(400).json({ error: 'limit must be 1 to 100 and offset must be a non-negative integer.' });
    }

    const playlists = await listPublicPlaylists(database, { sort, limit, offset });
    return response.json({ playlists, sort, limit, offset });
  });

  router.get('/:id', async (request, response) => {
    if (!validPlaylistId(request.params.id)) {
      return response.status(400).json({ error: 'A valid playlist ID is required.' });
    }
    const playlist = await database.prepare(`
      SELECT p.id, p.user_id AS "userId", p.name, p.description,
        p.is_public AS "isPublic", p.cover_url AS "coverUrl",
        p.created_at AS "createdAt", p.updated_at AS "updatedAt",
        u.display_name AS "ownerDisplayName", COUNT(pi.id)::int AS "itemCount"
      FROM playlists p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
      WHERE p.id = $1 AND u.deleted_at IS NULL
      GROUP BY p.id, u.display_name
    `).get(Number(request.params.id));
    if (!playlist) return response.status(404).json({ error: 'Playlist not found' });
    if (!playlist.isPublic && playlist.userId !== request.user?.id) {
      return response.status(403).json({ error: 'This playlist is private.' });
    }

    const items = await database.prepare(`
      SELECT pi.id, pi.media_library_id AS "mediaLibraryId", pi.position,
        pi.added_at AS "addedAt", m.provider, m.external_id AS "externalId",
        m.external_url AS "externalUrl", m.type, m.media_type AS "mediaType",
        m.title, m.artist, m.thumbnail_url AS "thumbnailUrl",
        m.stream_url AS "streamUrl", m.trailer_url AS "trailerUrl",
        m.duration_seconds AS "durationSeconds"
      FROM playlist_items pi
      JOIN media_library m ON m.id = pi.media_library_id
      WHERE pi.playlist_id = $1
      ORDER BY pi.position, pi.id
    `).all(Number(request.params.id));
    return response.json({ playlist, items });
  });

  router.patch('/:id', authenticate, async (request, response) => {
    if (!validPlaylistId(request.params.id)) {
      return response.status(400).json({ error: 'A valid playlist ID is required.' });
    }
    const playlist = await requireOwner(database, request, response);
    if (!playlist) return;

    const body = request.body ?? {};
    const allowedFields = ['name', 'description', 'is_public', 'cover_url'];
    if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
      return response.status(400).json({ error: 'Only name, description, is_public, and cover_url can be changed.' });
    }
    if (!Object.keys(body).length) {
      return response.status(400).json({ error: 'Provide at least one playlist field to update.' });
    }
    if (Object.hasOwn(body, 'name') && !validateName(body.name)) {
      return response.status(400).json({ error: 'Playlist name must be between 1 and 120 characters.' });
    }
    if (Object.hasOwn(body, 'description') && !validateDescription(body.description)) {
      return response.status(400).json({ error: 'Playlist description must be 500 characters or fewer.' });
    }
    if (Object.hasOwn(body, 'is_public') && typeof body.is_public !== 'boolean') {
      return response.status(400).json({ error: 'is_public must be a boolean.' });
    }
    if (
      Object.hasOwn(body, 'cover_url') &&
      body.cover_url !== null &&
      (typeof body.cover_url !== 'string' || body.cover_url.length > 2048)
    ) {
      return response.status(400).json({ error: 'cover_url must be a URL string no longer than 2048 characters or null.' });
    }

    const updated = await database.prepare(`
      UPDATE playlists SET
        name = $2,
        description = $3,
        is_public = $4,
        cover_url = $5,
        updated_at = NOW()
      WHERE id = $1
      RETURNING ${playlistFields()}
    `).get(
      playlist.id,
      Object.hasOwn(body, 'name') ? body.name.trim() : playlist.name,
      Object.hasOwn(body, 'description') ? body.description : playlist.description,
      Object.hasOwn(body, 'is_public') ? body.is_public : playlist.isPublic,
      Object.hasOwn(body, 'cover_url') ? body.cover_url : playlist.coverUrl,
    );
    return response.json({ playlist: updated });
  });

  router.delete('/:id', authenticate, async (request, response) => {
    if (!validPlaylistId(request.params.id)) {
      return response.status(400).json({ error: 'A valid playlist ID is required.' });
    }
    const playlist = await requireOwner(database, request, response);
    if (!playlist) return;
    await database.prepare('DELETE FROM playlists WHERE id = $1').run(playlist.id);
    return response.status(204).end();
  });

  router.post('/:id/items', authenticate, async (request, response) => {
    if (!validPlaylistId(request.params.id)) {
      return response.status(400).json({ error: 'A valid playlist ID is required.' });
    }
    const mediaLibraryId = request.body?.media_library_id;
    if (typeof mediaLibraryId !== 'string' || !mediaLibraryId.trim()) {
      return response.status(400).json({ error: 'media_library_id is required.' });
    }
    const owner = await requireOwner(database, request, response);
    if (!owner) return;

    const media = await database.prepare(
      'SELECT id FROM media_library WHERE id = $1 AND user_id = $2',
    ).get(mediaLibraryId.trim(), request.user.id);
    if (!media) return response.status(404).json({ error: 'Library item not found.' });

    try {
      const item = await database.transaction(async (tx) => {
        await tx.prepare('SELECT id FROM playlists WHERE id = $1 FOR UPDATE').get(owner.id);
        const { position } = await tx.prepare(`
          SELECT COALESCE(MAX(position), 0) + 1 AS position
          FROM playlist_items WHERE playlist_id = $1
        `).get(owner.id);
        return tx.prepare(`
          INSERT INTO playlist_items (playlist_id, media_library_id, position)
          VALUES ($1, $2, $3)
          RETURNING id, playlist_id AS "playlistId",
            media_library_id AS "mediaLibraryId", position,
            added_at AS "addedAt"
        `).get(owner.id, media.id, position);
      });
      return response.status(201).json({ item });
    } catch (error) {
      if (error.code === '23505') {
        return response.status(409).json({ error: 'That item is already in this playlist.' });
      }
      throw error;
    }
  });

  router.delete('/:id/items/:itemId', authenticate, async (request, response) => {
    if (!validPlaylistId(request.params.id) || !validPlaylistId(request.params.itemId)) {
      return response.status(400).json({ error: 'Valid playlist and item IDs are required.' });
    }
    const owner = await requireOwner(database, request, response);
    if (!owner) return;
    const result = await database.prepare(
      'DELETE FROM playlist_items WHERE id = $1 AND playlist_id = $2',
    ).run(Number(request.params.itemId), owner.id);
    if (!result.changes) return response.status(404).json({ error: 'Playlist item not found.' });
    return response.status(204).end();
  });

  router.post('/:id/reorder', authenticate, async (request, response) => {
    if (!validPlaylistId(request.params.id)) {
      return response.status(400).json({ error: 'A valid playlist ID is required.' });
    }
    const itemIds = request.body?.item_ids;
    if (
      !Array.isArray(itemIds) ||
      itemIds.some((id) => !Number.isSafeInteger(id) || id < 1) ||
      new Set(itemIds).size !== itemIds.length
    ) {
      return response.status(400).json({ error: 'item_ids must be an array of unique positive integer item IDs.' });
    }
    const owner = await requireOwner(database, request, response);
    if (!owner) return;

    const items = await database.transaction(async (tx) => {
      await tx.prepare('SELECT id FROM playlists WHERE id = $1 FOR UPDATE').get(owner.id);
      const current = await tx.prepare(
        'SELECT id FROM playlist_items WHERE playlist_id = $1 ORDER BY position, id',
      ).all(owner.id);
      const expected = new Set(current.map((item) => item.id));
      if (itemIds.length !== expected.size || itemIds.some((id) => !expected.has(id))) {
        return null;
      }
      for (const [index, itemId] of itemIds.entries()) {
        await tx.prepare(
          'UPDATE playlist_items SET position = $3 WHERE id = $1 AND playlist_id = $2',
        ).run(itemId, owner.id, index + 1);
      }
      return tx.prepare(`
        SELECT id, media_library_id AS "mediaLibraryId", position,
          added_at AS "addedAt"
        FROM playlist_items WHERE playlist_id = $1
        ORDER BY position, id
      `).all(owner.id);
    });
    if (!items) {
      return response.status(400).json({ error: 'item_ids must contain every playlist item exactly once.' });
    }
    return response.json({ items });
  });

  return router;
}
