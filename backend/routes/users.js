import { Router } from 'express';

const MAX_PAGE_SIZE = 50;

function validPage(value, fallback, maximum = MAX_PAGE_SIZE) {
  const page = value === undefined ? fallback : Number(value);
  return Number.isInteger(page) && page >= 0 && page <= maximum ? page : null;
}

async function findProfile(database, userId, viewerId) {
  return database.prepare(`
    SELECT u.id, u.display_name AS "displayName", u.avatar_url AS "avatarUrl",
      u.bio, u.is_public AS "isPublic", u.email, u.deleted_at AS "deletedAt",
      (SELECT COUNT(*)::int FROM follows f
        JOIN users follower ON follower.id = f.follower_id AND follower.deleted_at IS NULL
        WHERE f.following_id = u.id) AS "followerCount",
      (SELECT COUNT(*)::int FROM follows f
        JOIN users following ON following.id = f.following_id AND following.deleted_at IS NULL
        WHERE f.follower_id = u.id) AS "followingCount",
      (SELECT COUNT(*)::int FROM playlists p WHERE p.user_id = u.id AND p.is_public = true) AS "playlistCount",
      EXISTS (
        SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.following_id = u.id
      ) AS "isFollowing"
    FROM users u
    WHERE u.id = $1
  `).get(userId, viewerId ?? '');
}

function canViewProfile(profile, viewerId) {
  return Boolean(profile && (profile.isPublic || profile.id === viewerId));
}

export function createUsersRouter({ database, authenticate }) {
  const router = Router();

  router.get('/me', authenticate, async (request, response) => {
    const user = await database.prepare(`
      SELECT id, email, display_name AS "displayName", avatar_url AS "avatarUrl", bio, is_public AS "isPublic", email_verified AS "emailVerified", deleted_at AS "deletedAt"
      FROM users WHERE id = $1 OR supabase_uid = $1
      LIMIT 1
    `).get(request.user.id);
    if (!user || user.deletedAt) return response.status(404).json({ error: 'Profile not found.' });
    return response.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        emailVerified: Boolean(user.emailVerified),
        deletedAt: user.deletedAt || null,
        avatarUrl: user.avatarUrl || null,
        bio: user.bio || null,
        isPublic: Boolean(user.isPublic),
      }
    });
  });

  router.patch('/me', authenticate, async (request, response) => {
    const body = request.body ?? {};
    const allowed = ['display_name', 'bio', 'avatar_url', 'is_public'];
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) {
      return response.status(400).json({ error: 'Provide one or more supported profile fields.' });
    }
    if (Object.hasOwn(body, 'display_name') &&
      (typeof body.display_name !== 'string' || !body.display_name.trim() || body.display_name.trim().length > 60)) {
      return response.status(400).json({ error: 'display_name must contain 1 to 60 characters.' });
    }
    if (Object.hasOwn(body, 'bio') &&
      (body.bio !== null && (typeof body.bio !== 'string' || body.bio.length > 280))) {
      return response.status(400).json({ error: 'bio must be 280 characters or fewer, or null.' });
    }
    if (Object.hasOwn(body, 'avatar_url') && body.avatar_url !== null) {
      if (typeof body.avatar_url !== 'string' || body.avatar_url.length > 2048) {
        return response.status(400).json({ error: 'avatar_url must be an HTTP(S) URL no longer than 2048 characters.' });
      }
      try {
        if (!['http:', 'https:'].includes(new URL(body.avatar_url).protocol)) throw new Error('invalid protocol');
      } catch {
        return response.status(400).json({ error: 'avatar_url must be a valid HTTP(S) URL.' });
      }
    }
    if (Object.hasOwn(body, 'is_public') && typeof body.is_public !== 'boolean') {
      return response.status(400).json({ error: 'is_public must be a boolean.' });
    }

    const current = await database.prepare(`
      SELECT display_name AS "displayName", bio, avatar_url AS "avatarUrl",
        is_public AS "isPublic"
      FROM users WHERE id = $1 AND deleted_at IS NULL
    `).get(request.user.id);
    if (!current) return response.status(404).json({ error: 'Profile not found.' });
    await database.prepare(`
      UPDATE users SET display_name = $2, bio = $3, avatar_url = $4, is_public = $5
      WHERE id = $1
    `).run(
      request.user.id,
      Object.hasOwn(body, 'display_name') ? body.display_name.trim() : current.displayName,
      Object.hasOwn(body, 'bio') ? body.bio : current.bio,
      Object.hasOwn(body, 'avatar_url') ? body.avatar_url : current.avatarUrl,
      Object.hasOwn(body, 'is_public') ? body.is_public : current.isPublic,
    );
    const profile = await findProfile(database, request.user.id, request.user.id);
    return response.json({ profile });
  });

  router.delete('/me', authenticate, async (request, response) => {
    const result = await database.prepare(`
      UPDATE users SET deleted_at = NOW(), is_public = false
      WHERE id = $1 AND deleted_at IS NULL
    `).run(request.user.id);
    if (!result.changes) return response.status(404).json({ error: 'Account not found.' });
    await database.prepare('DELETE FROM auth_sessions WHERE user_id = $1').run(request.user.id);
    return response.status(204).end();
  });

  router.get('/:id', async (request, response) => {
    const profile = await findProfile(database, request.params.id, request.user?.id);
    if (!profile) return response.status(404).json({ error: 'Profile not found.' });
    if (profile.deletedAt && profile.id !== request.user?.id) {
      return response.status(404).json({ error: 'Profile not found.' });
    }
    if (!profile.deletedAt && !canViewProfile(profile, request.user?.id)) {
      return response.status(403).json({ error: 'Profile not found.' });
    }
    profile.deleted = Boolean(profile.deletedAt);
    delete profile.email;
    delete profile.deletedAt;
    return response.json({ profile });
  });

  router.get('/:id/playlists', async (request, response) => {
    const profile = await findProfile(database, request.params.id, request.user?.id);
    if (!profile) return response.status(404).json({ error: 'Profile not found.' });
    if (profile.deletedAt) return response.json({ playlists: [] });
    if (!canViewProfile(profile, request.user?.id)) {
      return response.status(profile ? 403 : 404).json({ error: 'Profile not found.' });
    }
    const playlists = await database.prepare(`
      SELECT p.id, p.name, p.description, p.cover_url AS "coverUrl",
        p.created_at AS "createdAt", COUNT(pi.id)::int AS "itemCount"
      FROM playlists p
      LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
      WHERE p.user_id = $1 AND p.is_public = true
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all(profile.id);
    return response.json({ playlists });
  });

  for (const relation of ['followers', 'following']) {
    router.get(`/:id/${relation}`, async (request, response) => {
      const profile = await findProfile(database, request.params.id, request.user?.id);
      if (!profile) return response.status(404).json({ error: 'Profile not found.' });
      if (profile.deletedAt) return response.json({ users: [] });
      if (!canViewProfile(profile, request.user?.id)) {
        return response.status(profile ? 403 : 404).json({ error: 'Profile not found.' });
      }
      const limit = validPage(request.query.limit, 20, MAX_PAGE_SIZE);
      const offset = validPage(request.query.offset, 0, 100_000);
      if (limit === null || limit < 1 || offset === null) {
        return response.status(400).json({ error: 'limit must be 1 to 50 and offset a non-negative integer.' });
      }
      const direction = relation === 'followers' ? 'f.follower_id' : 'f.following_id';
      const joinKey = relation === 'followers' ? 'f.follower_id' : 'f.following_id';
      const ownerColumn = relation === 'followers' ? 'f.following_id' : 'f.follower_id';
      const users = await database.prepare(`
        SELECT u.id, u.display_name AS "displayName", u.avatar_url AS "avatarUrl",
          EXISTS (SELECT 1 FROM follows own WHERE own.follower_id = $4 AND own.following_id = u.id) AS "isFollowing"
        FROM follows f JOIN users u ON u.id = ${joinKey}
        WHERE ${ownerColumn} = $1 AND u.deleted_at IS NULL AND u.is_public = true
        ORDER BY f.created_at DESC, ${direction}
        LIMIT $2 OFFSET $3
      `).all(profile.id, limit, offset, request.user?.id ?? '');
      return response.json({ users, limit, offset });
    });
  }

  router.get('/:id/liked', async (request, response) => {
    const profile = await findProfile(database, request.params.id, request.user?.id);
    if (!profile) return response.status(404).json({ error: 'Profile not found.' });
    if (profile.deletedAt) return response.json({ items: [] });
    if (!canViewProfile(profile, request.user?.id)) {
      return response.status(profile ? 403 : 404).json({ error: 'Profile not found.' });
    }
    const limit = validPage(request.query.limit, 20, MAX_PAGE_SIZE);
    const offset = validPage(request.query.offset, 0, 100_000);
    if (limit === null || limit < 1 || offset === null) {
      return response.status(400).json({ error: 'limit must be 1 to 50 and offset a non-negative integer.' });
    }
    const items = await database.prepare(`
      SELECT m.id AS "libraryId", m.type, m.provider, m.external_id AS "externalId", m.media_type AS "mediaType",
        m.title, m.artist, m.thumbnail_url AS "thumbnailUrl", m.stream_url AS "streamUrl",
        m.external_url AS "externalUrl", l.created_at AS "likedAt"
      FROM likes l JOIN media_library m ON m.id = l.media_library_id
      WHERE l.user_id = $1 AND m.user_id = $1
      ORDER BY l.created_at DESC LIMIT $2 OFFSET $3
    `).all(profile.id, limit, offset);
    return response.json({ items, limit, offset });
  });

  return router;
}
