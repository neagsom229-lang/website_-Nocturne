import { Router } from 'express';

const MAX_PAGE_SIZE = 50;

function validPage(value, fallback, maximum = MAX_PAGE_SIZE) {
  const page = value === undefined ? fallback : Number(value);
  return Number.isInteger(page) && page >= 0 && page <= maximum ? page : null;
}

export function createSocialRouter({ database, authenticate }) {
  const router = Router();
  const commentWindows = new Map();

  router.post('/users/:id/follow', authenticate, async (request, response) => {
    if (request.params.id === request.user.id) {
      return response.status(400).json({ error: 'You cannot follow yourself.' });
    }
    const target = await database.prepare(
      'SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL AND is_public = true',
    ).get(request.params.id);
    if (!target) return response.status(404).json({ error: 'User not found.' });
    try {
      const follow = await database.prepare(`
        INSERT INTO follows (follower_id, following_id)
        VALUES ($1, $2)
        RETURNING follower_id AS "followerId", following_id AS "followingId", created_at AS "createdAt"
      `).get(request.user.id, target.id);
      return response.status(201).json({ follow });
    } catch (error) {
      if (error.code === '23505') return response.status(409).json({ error: 'You already follow this user.' });
      throw error;
    }
  });

  router.delete('/users/:id/follow', authenticate, async (request, response) => {
    await database.prepare('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2')
      .run(request.user.id, request.params.id);
    return response.status(204).end();
  });

  router.post('/media/:id/like', authenticate, async (request, response) => {
    const media = await database.prepare('SELECT id FROM media_library WHERE id = $1').get(request.params.id);
    if (!media) return response.status(404).json({ error: 'Media not found.' });
    const result = await database.prepare(`
      INSERT INTO likes (user_id, media_library_id)
      VALUES ($1, $2) ON CONFLICT (user_id, media_library_id) DO NOTHING
    `).run(request.user.id, media.id);
    return response.status(result.changes ? 201 : 200).json({
      liked: true,
      alreadyLiked: !result.changes,
    });
  });

  router.delete('/media/:id/like', authenticate, async (request, response) => {
    await database.prepare('DELETE FROM likes WHERE user_id = $1 AND media_library_id = $2')
      .run(request.user.id, request.params.id);
    return response.status(204).end();
  });

  router.get('/media/:id/likes', async (request, response) => {
    const media = await database.prepare('SELECT id FROM media_library WHERE id = $1').get(request.params.id);
    if (!media) return response.status(404).json({ error: 'Media not found.' });
    const [count, users] = await Promise.all([
      database.prepare(`
        SELECT COUNT(*)::int AS count FROM likes l
        JOIN users u ON u.id = l.user_id
        WHERE l.media_library_id = $1 AND u.deleted_at IS NULL
      `).get(media.id),
      database.prepare(`
        SELECT l.user_id AS id FROM likes l
        JOIN users u ON u.id = l.user_id
        WHERE l.media_library_id = $1 AND u.deleted_at IS NULL
        ORDER BY l.created_at DESC LIMIT 100
      `)
        .all(media.id),
    ]);
    return response.json({ count: count.count, userIds: users.map((user) => user.id) });
  });

  router.get('/media/:id/comments', async (request, response) => {
    const limit = validPage(request.query.limit, 20, MAX_PAGE_SIZE);
    const offset = validPage(request.query.offset, 0, 100_000);
    if (limit === null || limit < 1 || offset === null) {
      return response.status(400).json({ error: 'limit must be 1 to 50 and offset a non-negative integer.' });
    }
    const media = await database.prepare('SELECT id FROM media_library WHERE id = $1').get(request.params.id);
    if (!media) return response.status(404).json({ error: 'Media not found.' });
    const [comments, count] = await Promise.all([
      database.prepare(`
      SELECT c.id, c.media_library_id AS "mediaLibraryId", c.user_id AS "userId",
        c.body, c.created_at AS "createdAt", c.updated_at AS "updatedAt",
        u.display_name AS "displayName", u.avatar_url AS "avatarUrl"
      FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.media_library_id = $1 AND u.deleted_at IS NULL
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT $2 OFFSET $3
      `).all(media.id, limit, offset),
      database.prepare(`
        SELECT COUNT(*)::int AS count FROM comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.media_library_id = $1 AND u.deleted_at IS NULL
      `).get(media.id),
    ]);
    return response.json({ comments, count: count.count, limit, offset, hasMore: comments.length === limit });
  });

  router.post('/media/:id/comments', authenticate, async (request, response) => {
    const body = request.body?.body;
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 1000) {
      return response.status(400).json({ error: 'Comment body must contain 1 to 1000 characters.' });
    }
    const media = await database.prepare(
      'SELECT id FROM media_library WHERE id = $1',
    ).get(request.params.id);
    if (!media) return response.status(404).json({ error: 'Media not found.' });
    const now = Date.now();
    for (const [userId, window] of commentWindows) {
      if (now - window.startedAt >= 60_000) commentWindows.delete(userId);
    }
    let window = commentWindows.get(request.user.id);
    if (!window || now - window.startedAt >= 60_000) {
      window = { startedAt: now, count: 0 };
      commentWindows.set(request.user.id, window);
    }
    if (window.count >= 10) {
      const retryAfter = Math.max(1, Math.ceil((window.startedAt + 60_000 - now) / 1000));
      response.set('Retry-After', String(retryAfter));
      return response.status(429).json({ error: 'You can post up to 10 comments per minute.' });
    }
    window.count += 1;
    let comment;
    try {
      comment = await database.prepare(`
        INSERT INTO comments (user_id, media_library_id, body)
        VALUES ($1, $2, $3)
        RETURNING id, media_library_id AS "mediaLibraryId", user_id AS "userId",
          body, created_at AS "createdAt", updated_at AS "updatedAt"
      `).get(request.user.id, media.id, body.trim());
    } catch (error) {
      window.count -= 1;
      throw error;
    }
    return response.status(201).json({ comment: { ...comment, displayName: request.user.displayName } });
  });

  router.patch('/comments/:id', authenticate, async (request, response) => {
    const id = Number(request.params.id);
    const body = request.body?.body;
    if (!Number.isSafeInteger(id) || id < 1) return response.status(400).json({ error: 'A valid comment ID is required.' });
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 1000) {
      return response.status(400).json({ error: 'Comment body must contain 1 to 1000 characters.' });
    }
    const comment = await database.prepare(`
      UPDATE comments SET body = $3, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, media_library_id AS "mediaLibraryId", user_id AS "userId",
        body, created_at AS "createdAt", updated_at AS "updatedAt"
    `).get(id, request.user.id, body.trim());
    if (!comment) return response.status(403).json({ error: 'You can only edit your own comments.' });
    return response.json({ comment: { ...comment, displayName: request.user.displayName } });
  });

  router.delete('/comments/:id', authenticate, async (request, response) => {
    const id = Number(request.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return response.status(400).json({ error: 'A valid comment ID is required.' });
    const deleted = await database.prepare(
      'DELETE FROM comments WHERE id = $1 AND user_id = $2',
    ).run(id, request.user.id);
    if (!deleted.changes) return response.status(403).json({ error: 'You can only delete your own comments.' });
    return response.status(204).end();
  });

  router.get('/feed/following', authenticate, async (request, response) => {
    const limit = validPage(request.query.limit, 20, MAX_PAGE_SIZE);
    const offset = validPage(request.query.offset, 0, 100_000);
    if (limit === null || limit < 1 || offset === null) {
      return response.status(400).json({ error: 'limit must be 1 to 50 and offset a non-negative integer.' });
    }
    const activities = await database.prepare(`
      SELECT activity.* FROM (
        SELECT 'playlist' AS type, p.id::text AS id, p.user_id AS "userId",
          u.display_name AS "displayName", u.avatar_url AS "avatarUrl",
          p.created_at AS "createdAt", p.name AS title, p.description AS body,
          p.id AS "playlistId", NULL::text AS "mediaLibraryId"
        FROM playlists p JOIN follows f ON f.following_id = p.user_id
        JOIN users u ON u.id = p.user_id
        WHERE f.follower_id = $1 AND p.is_public = true AND u.is_public = true AND u.deleted_at IS NULL
        UNION ALL
        SELECT 'like' AS type, l.user_id || ':' || l.media_library_id AS id, l.user_id AS "userId",
          u.display_name AS "displayName", u.avatar_url AS "avatarUrl",
          l.created_at AS "createdAt", m.title AS title, m.artist AS body,
          NULL::integer AS "playlistId", m.id AS "mediaLibraryId"
        FROM likes l JOIN follows f ON f.following_id = l.user_id
        JOIN users u ON u.id = l.user_id JOIN media_library m ON m.id = l.media_library_id
        WHERE f.follower_id = $1 AND u.is_public = true AND u.deleted_at IS NULL
        UNION ALL
        SELECT 'comment' AS type, c.id::text AS id, c.user_id AS "userId",
          u.display_name AS "displayName", u.avatar_url AS "avatarUrl",
          c.created_at AS "createdAt", m.title AS title, c.body AS body,
          NULL::integer AS "playlistId", m.id AS "mediaLibraryId"
        FROM comments c JOIN follows f ON f.following_id = c.user_id
        JOIN users u ON u.id = c.user_id JOIN media_library m ON m.id = c.media_library_id
        WHERE f.follower_id = $1 AND u.is_public = true AND u.deleted_at IS NULL
      ) activity
      WHERE activity."userId" <> $1
      ORDER BY activity."createdAt" DESC, activity.type, activity.id
      LIMIT $2 OFFSET $3
    `).all(request.user.id, limit, offset);
    return response.json({ activities, limit, offset, hasMore: activities.length === limit });
  });

  return router;
}
