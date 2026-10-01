import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  user: null as { id: string; displayName: string; email: string } | null,
  followUser: vi.fn(),
  unfollowUser: vi.fn(),
  getLikes: vi.fn(),
  getComments: vi.fn(),
  likeMedia: vi.fn(),
  unlikeMedia: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  getUserProfile: vi.fn(),
  getUserPlaylists: vi.fn(),
  getUserLikes: vi.fn(),
  getUserConnections: vi.fn(),
}));

vi.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('../src/lib/socialApi', () => ({
  followUser: mocks.followUser,
  unfollowUser: mocks.unfollowUser,
  getLikes: mocks.getLikes,
  getComments: mocks.getComments,
  likeMedia: mocks.likeMedia,
  unlikeMedia: mocks.unlikeMedia,
  createComment: mocks.createComment,
  updateComment: mocks.updateComment,
  deleteComment: mocks.deleteComment,
  getUserProfile: mocks.getUserProfile,
  getUserPlaylists: mocks.getUserPlaylists,
  getUserLikes: mocks.getUserLikes,
  getUserConnections: mocks.getUserConnections,
}));

vi.mock('../src/lib/moviesApi', () => ({ prefetchMovieDetails: vi.fn(), saveMovie: vi.fn() }));
vi.mock('../src/lib/mediaApi', () => ({ saveMedia: vi.fn() }));
vi.mock('../src/components/AddToPlaylistButton', () => ({
  AddToPlaylistButton: () => <button type="button">Add to playlist</button>,
}));
vi.mock('../src/components/WorkspaceShell', () => ({
  WorkspaceShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useOptionalWorkspacePlayer: () => null,
}));

import { FollowButton } from '../src/components/FollowButton';
import { MediaCard } from '../src/components/MediaCard';
import { CommentThread } from '../src/components/CommentThread';
import { ProfilePage } from '../src/routes/ProfilePage';

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: 'listener', displayName: 'Listener', email: 'listener@example.test' };
  mocks.getLikes.mockResolvedValue({ count: 0, userIds: [] });
  mocks.getComments.mockResolvedValue({ comments: [], count: 0, hasMore: false });
  mocks.followUser.mockResolvedValue({});
  mocks.unfollowUser.mockResolvedValue(undefined);
  mocks.getUserProfile.mockResolvedValue({
    id: 'private-user',
    displayName: 'Quiet Listener',
    avatarUrl: null,
    bio: 'A small private listening room.',
    isPublic: false,
    followerCount: 2,
    followingCount: 3,
    playlistCount: 1,
    isFollowing: false,
  });
  mocks.getUserPlaylists.mockResolvedValue([]);
  mocks.getUserLikes.mockResolvedValue([]);
  mocks.getUserConnections.mockResolvedValue([]);
});

describe('social frontend', () => {
  it('optimistically follows and rolls back when the API fails', async () => {
    mocks.followUser.mockRejectedValueOnce(new Error('Network unavailable'));
    render(<MemoryRouter><FollowButton userId="person" initialFollowing={false} /></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'Follow' });
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Follow' }).getAttribute('aria-pressed')).toBe('false'));
    expect(screen.getByRole('alert').textContent).toContain('Network unavailable');
  });

  it('optimistically likes media and restores the previous state on failure', async () => {
    mocks.likeMedia.mockRejectedValueOnce(new Error('Could not like item'));
    render(
      <MemoryRouter>
        <MediaCard
          media={{ id: 'external-1', title: 'Soft Static', thumbnail_url: null, media_type: 'music', source: 'audius' }}
          mediaLibraryId="library-1"
        />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.getLikes).toHaveBeenCalled());
    const button = await screen.findByRole('button', { name: 'Like Soft Static' });
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Like Soft Static' }).getAttribute('aria-pressed')).toBe('false'));
    expect(screen.getByRole('alert').textContent).toContain('Could not like item');
  });

  it('disables comment submission for empty or over-limit content', async () => {
    mocks.getComments.mockResolvedValue({ comments: [], count: 0, hasMore: false });
    render(<MemoryRouter><CommentThread mediaLibraryId="library-1" /></MemoryRouter>);
    const submit = screen.getByRole('button', { name: 'Post note' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const textarea = screen.getByLabelText('Write a comment') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'x'.repeat(1001) } });
    expect(submit.disabled).toBe(true);
  });

  it('shows only the private-profile notice for another user', async () => {
    mocks.user = null;
    render(
      <MemoryRouter initialEntries={['/u/private-user']}>
        <Routes><Route path="/u/:id" element={<ProfilePage />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('This profile is private.')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(mocks.getUserPlaylists).not.toHaveBeenCalled();
  });
});
