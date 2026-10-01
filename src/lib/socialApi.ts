import type { DiscoveryMedia } from '../types';

export type UserProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isPublic: boolean;
  followerCount: number;
  followingCount: number;
  playlistCount: number;
  isFollowing: boolean;
  deleted?: boolean;
  email?: string | null;
};

export type SocialUser = Pick<UserProfile, 'id' | 'displayName' | 'avatarUrl' | 'isFollowing'>;

export type LikedMedia = {
  libraryId: string;
  externalId: string;
  type: 'video' | 'podcast' | 'audio';
  provider: DiscoveryMedia['source'];
  title: string;
  artist: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
  streamUrl: string;
  externalUrl: string | null;
};

export type SocialComment = {
  id: number;
  mediaLibraryId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  avatarUrl: string | null;
};

export type FollowingActivity = {
  type: 'playlist' | 'like' | 'comment';
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  title: string;
  body: string | null;
  playlistId: number | null;
  mediaLibraryId: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null
      && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

function pageParams({ limit = 20, offset = 0 }: { limit?: number; offset?: number } = {}) {
  return new URLSearchParams({ limit: String(limit), offset: String(offset) });
}

export async function getMyProfile() {
  return (await request<{ profile: UserProfile }>('/api/users/me')).profile;
}

export async function updateMyProfile(patch: {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isPublic?: boolean;
}) {
  const payload = {
    ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
    ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
    ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl } : {}),
    ...(patch.isPublic !== undefined ? { is_public: patch.isPublic } : {}),
  };
  return (await request<{ profile: UserProfile }>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })).profile;
}

export async function deleteMyAccount() {
  await request<void>('/api/users/me', { method: 'DELETE' });
}

export async function getUserProfile(id: string) {
  return (await request<{ profile: UserProfile }>(`/api/users/${encodeURIComponent(id)}`)).profile;
}

export async function getUserPlaylists(id: string) {
  return (await request<{ playlists: Array<{
    id: number;
    name: string;
    description: string | null;
    coverUrl: string | null;
    itemCount: number;
  }> }>(`/api/users/${encodeURIComponent(id)}/playlists`)).playlists;
}

export async function getUserLikes(id: string, page: { limit?: number; offset?: number } = {}) {
  const params = pageParams(page);
  return (await request<{ items: LikedMedia[] }>(`/api/users/${encodeURIComponent(id)}/liked?${params}`)).items;
}

export async function getUserConnections(id: string, kind: 'followers' | 'following', page: { limit?: number; offset?: number } = {}) {
  const params = pageParams(page);
  return (await request<{ users: SocialUser[] }>(
    `/api/users/${encodeURIComponent(id)}/${kind}?${params}`,
  )).users;
}

export async function followUser(id: string) {
  return request(`/api/users/${encodeURIComponent(id)}/follow`, { method: 'POST' });
}

export async function unfollowUser(id: string) {
  await request<void>(`/api/users/${encodeURIComponent(id)}/follow`, { method: 'DELETE' });
}

export async function getLikes(mediaLibraryId: string) {
  return request<{ count: number; userIds: string[] }>(
    `/api/media/${encodeURIComponent(mediaLibraryId)}/likes`,
  );
}

export async function likeMedia(mediaLibraryId: string) {
  return request<{ liked: boolean; alreadyLiked: boolean }>(
    `/api/media/${encodeURIComponent(mediaLibraryId)}/like`,
    { method: 'POST' },
  );
}

export async function unlikeMedia(mediaLibraryId: string) {
  await request<void>(`/api/media/${encodeURIComponent(mediaLibraryId)}/like`, { method: 'DELETE' });
}

export async function getComments(mediaLibraryId: string, page: { limit?: number; offset?: number } = {}) {
  const params = pageParams(page);
  return request<{ comments: SocialComment[]; count: number; hasMore: boolean }>(
    `/api/media/${encodeURIComponent(mediaLibraryId)}/comments?${params}`,
  );
}

export async function createComment(mediaLibraryId: string, body: string) {
  return (await request<{ comment: SocialComment }>(
    `/api/media/${encodeURIComponent(mediaLibraryId)}/comments`,
    { method: 'POST', body: JSON.stringify({ body }) },
  )).comment;
}

export async function updateComment(id: number, body: string) {
  return (await request<{ comment: SocialComment }>(`/api/comments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ body }),
  })).comment;
}

export async function deleteComment(id: number) {
  await request<void>(`/api/comments/${id}`, { method: 'DELETE' });
}

export async function getFollowingFeed(page: { limit?: number; offset?: number } = {}) {
  const params = pageParams(page);
  return request<{ activities: FollowingActivity[]; hasMore: boolean }>(`/api/feed/following?${params}`);
}
