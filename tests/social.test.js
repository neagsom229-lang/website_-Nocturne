import assert from 'node:assert/strict';
import express from 'express';
import test from 'node:test';
import { createDiscoverRouter } from '../backend/routes/discover.js';
import { createSocialRouter } from '../backend/routes/social.js';
import { createUsersRouter } from '../backend/routes/users.js';

class SocialDatabase {
  constructor() {
    this.follows = new Set();
    this.likes = new Set();
    this.comments = [];
    this.playlists = [
      { id: 1, name: 'Still Here', owner: 'public-user' },
      { id: 2, name: 'Gone Quiet', owner: 'deleted-user' },
    ];
    this.profiles = new Map([
      ['private-user', {
        id: 'private-user', displayName: 'Quiet Listener', avatarUrl: null, bio: null,
        isPublic: false, followerCount: 0, followingCount: 0, playlistCount: 0, isFollowing: false,
      }],
      ['public-user', {
        id: 'public-user', displayName: 'June', avatarUrl: null, bio: null,
        isPublic: true, deletedAt: null, followerCount: 0, followingCount: 0, playlistCount: 0, isFollowing: false,
      }],
      ['deleted-user', {
        id: 'deleted-user', displayName: 'Gone Listener', avatarUrl: null, bio: null,
        isPublic: true, deletedAt: new Date().toISOString(), followerCount: 1,
        followingCount: 1, playlistCount: 1, isFollowing: false,
      }],
    ]);
    this.profiles.get('private-user').deletedAt = null;
    this.likes.add('deleted-user:media-one');
    this.comments.push({
      userId: 'deleted-user', mediaLibraryId: 'media-one',
      body: 'This should disappear', id: 1, createdAt: new Date().toISOString(),
    });
    this.lastFeedSql = '';
    this.lastPlaylistSql = '';
  }

  prepare(sql) {
    const query = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    return {
      get: async (...params) => {
        if (query.startsWith('select u.id, u.display_name')) return this.profiles.get(params[0]);
        if (query.startsWith('select id from users where id = $1 and deleted_at')) {
          return this.profiles.has(params[0]) ? { id: params[0] } : undefined;
        }
        if (query.startsWith('select id from media_library')) return { id: params[0] };
        if (query.startsWith('insert into follows')) {
          const key = `${params[0]}:${params[1]}`;
          if (this.follows.has(key)) {
            const error = new Error('duplicate follow');
            error.code = '23505';
            throw error;
          }
          this.follows.add(key);
          return { followerId: params[0], followingId: params[1] };
        }
        if (query.startsWith('select count(*)::int as count from likes')) {
          return {
            count: [...this.likes].filter((key) => key.endsWith(`:${params[0]}`)
              && !this.profiles.get(key.split(':')[0])?.deletedAt).length,
          };
        }
        if (query.startsWith('select count(*)::int as count from comments')) {
          return { count: this.comments.filter((comment) =>
            comment.mediaLibraryId === params[0] && !this.profiles.get(comment.userId)?.deletedAt).length };
        }
        if (query.startsWith('insert into comments')) {
          const [userId, mediaLibraryId, body] = params;
          const comment = {
            id: this.comments.length + 1, userId, mediaLibraryId, body,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          };
          this.comments.push(comment);
          return comment;
        }
        return undefined;
      },
      all: async (...params) => {
        if (query.startsWith('select l.user_id as id from likes')) {
          return [...this.likes]
            .filter((key) => key.endsWith(`:${params[0]}`))
            .filter((key) => !this.profiles.get(key.split(':')[0])?.deletedAt)
            .map((key) => ({ id: key.split(':')[0] }));
        }
        if (query.includes('from comments c join users u')) {
          return this.comments
            .filter((comment) => comment.mediaLibraryId === params[0] && !this.profiles.get(comment.userId)?.deletedAt)
            .map((comment) => ({
              id: comment.id,
              mediaLibraryId: comment.mediaLibraryId,
              userId: comment.userId,
              body: comment.body,
              createdAt: comment.createdAt,
              updatedAt: comment.updatedAt,
              displayName: this.profiles.get(comment.userId)?.displayName,
              avatarUrl: null,
            }));
        }
        if (query.includes('select activity.* from')) {
          this.lastFeedSql = query;
          return this.profiles.get('deleted-user')?.deletedAt ? [] : [{ userId: 'deleted-user' }];
        }
        if (query.includes('from follows f join users u')) {
          return this.profiles.get('deleted-user')?.deletedAt ? [] : [{ id: 'deleted-user' }];
        }
        if (query.includes('from playlists p') && query.includes('join users u')) {
          this.lastPlaylistSql = query;
          return this.playlists
            .filter((playlist) => !this.profiles.get(playlist.owner)?.deletedAt)
            .map((playlist) => ({ id: playlist.id, name: playlist.name }));
        }
        return [];
      },
      run: async (...params) => {
        if (query.startsWith('insert into likes')) {
          const key = `${params[0]}:${params[1]}`;
          const prior = this.likes.size;
          this.likes.add(key);
          return { changes: this.likes.size - prior };
        }
        if (query.startsWith('delete from likes')) {
          const key = `${params[0]}:${params[1]}`;
          const existed = this.likes.delete(key);
          return { changes: existed ? 1 : 0 };
        }
        return { changes: 0 };
      },
    };
  }
}

async function withSocialServer(callback) {
  const database = new SocialDatabase();
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    const userId = request.get('x-user-id');
    if (userId) request.user = { id: userId, displayName: 'Listener' };
    next();
  });
  const authenticate = (request, response, next) => {
    const userId = request.get('x-user-id');
    if (!userId) return response.status(401).json({ error: 'Please log in to continue' });
    request.user = { id: userId, displayName: 'Listener' };
    return next();
  };
  app.use('/api/discover', createDiscoverRouter({ database, authenticate }));
  app.use('/api/users', createUsersRouter({ database, authenticate }));
  app.use('/api', createSocialRouter({ database, authenticate }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const call = async (path, { user, method = 'GET', body } = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(user ? { 'x-user-id': user } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { response, body: response.status === 204 ? null : await response.json() };
  };
  try {
    await callback({ call, database });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('following an account twice returns 409 on the second request', async () => {
  await withSocialServer(async ({ call }) => {
    assert.equal((await call('/api/users/public-user/follow', { user: 'listener', method: 'POST' })).response.status, 201);
    assert.equal((await call('/api/users/public-user/follow', { user: 'listener', method: 'POST' })).response.status, 409);
  });
});

test('anonymous visitors cannot view a private profile', async () => {
  await withSocialServer(async ({ call }) => {
    assert.equal((await call('/api/users/private-user')).response.status, 403);
  });
});

test('soft-deleted profile returns 404 publicly and a deleted flag to its owner', async () => {
  await withSocialServer(async ({ call }) => {
    assert.equal((await call('/api/users/deleted-user')).response.status, 404);
    const owner = await call('/api/users/deleted-user', { user: 'deleted-user' });
    assert.equal(owner.response.status, 200, JSON.stringify(owner.body));
    assert.equal(owner.body.profile.deleted, true);
  });
});

test('soft-deleted users expose no playlists, follows, or liked media', async () => {
  await withSocialServer(async ({ call }) => {
    const [playlists, followers, following, liked] = await Promise.all([
      call('/api/users/deleted-user/playlists'),
      call('/api/users/deleted-user/followers'),
      call('/api/users/deleted-user/following'),
      call('/api/users/deleted-user/liked'),
    ]);
    assert.deepEqual(playlists.body.playlists, []);
    assert.deepEqual(followers.body.users, []);
    assert.deepEqual(following.body.users, []);
    assert.deepEqual(liked.body.items, []);
  });
});

test('soft-deleted users are omitted from another profile’s public follow lists', async () => {
  await withSocialServer(async ({ call }) => {
    const followers = await call('/api/users/public-user/followers');
    const following = await call('/api/users/public-user/following');
    assert.deepEqual(followers.body.users, []);
    assert.deepEqual(following.body.users, []);
  });
});

test('liking media is idempotent', async () => {
  await withSocialServer(async ({ call }) => {
    const first = await call('/api/media/media-one/like', { user: 'listener', method: 'POST' });
    const second = await call('/api/media/media-one/like', { user: 'listener', method: 'POST' });
    assert.equal(first.response.status, 201);
    assert.equal(second.response.status, 200);
    assert.equal(second.body.alreadyLiked, true);
  });
});

test('comment creation rejects empty and overlong bodies', async () => {
  await withSocialServer(async ({ call }) => {
    assert.equal((await call('/api/media/media-one/comments', { user: 'listener', method: 'POST', body: { body: '' } })).response.status, 400);
    assert.equal((await call('/api/media/media-one/comments', { user: 'listener', method: 'POST', body: { body: 'x'.repeat(1001) } })).response.status, 400);
  });
});

test('soft-deleted users’ comments and likes disappear from media public views', async () => {
  await withSocialServer(async ({ call }) => {
    const likes = await call('/api/media/media-one/likes');
    const comments = await call('/api/media/media-one/comments');
    assert.equal(likes.body.count, 0);
    assert.deepEqual(likes.body.userIds, []);
    assert.equal(comments.body.count, 0);
    assert.deepEqual(comments.body.comments, []);
  });
});

test('comment creation is limited to 10 per user per 60 seconds', async () => {
  await withSocialServer(async ({ call }) => {
    for (let index = 0; index < 10; index += 1) {
      const result = await call('/api/media/media-one/comments', {
        user: 'rate-limited-listener',
        method: 'POST',
        body: { body: `Comment ${index + 1}` },
      });
      assert.equal(result.response.status, 201);
    }
    const limited = await call('/api/media/media-one/comments', {
      user: 'rate-limited-listener',
      method: 'POST',
      body: { body: 'Comment 11' },
    });
    assert.equal(limited.response.status, 429);
    assert.ok(Number(limited.response.headers.get('retry-after')) > 0);
  });
});

test('comment deletion returns 403 when the current user is not its owner', async () => {
  await withSocialServer(async ({ call }) => {
    assert.equal((await call('/api/comments/8', { user: 'listener', method: 'DELETE' })).response.status, 403);
  });
});

test('following feed query excludes the signed-in user activity', async () => {
  await withSocialServer(async ({ call, database }) => {
    const response = await call('/api/feed/following', { user: 'listener' });
    assert.equal(response.response.status, 200);
    assert.match(database.lastFeedSql, /activity\."userid" <> \$1/);
  });

  test('following feed excludes soft-deleted users’ activity', async () => {
    await withSocialServer(async ({ call, database }) => {
      const result = await call('/api/feed/following', { user: 'listener' });
      assert.deepEqual(result.body.activities, []);
      assert.match(database.lastFeedSql, /u\.deleted_at is null/);
    });
  });

  test('public playlist discovery excludes soft-deleted playlist owners', async () => {
    await withSocialServer(async ({ call, database }) => {
      const result = await call('/api/discover/public-playlists');
      assert.deepEqual(result.body.playlists, [{ id: 1, name: 'Still Here' }]);
      assert.match(database.lastPlaylistSql, /u\.deleted_at is null/);
    });
  });

});
