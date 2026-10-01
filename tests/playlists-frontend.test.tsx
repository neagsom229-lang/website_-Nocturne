import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getMyPlaylists: vi.fn(),
  getPublicPlaylists: vi.fn(),
  getPlaylist: vi.fn(),
  createPlaylist: vi.fn(),
  addItemToPlaylist: vi.fn(),
  playExternalQueue: vi.fn(),
  toast: vi.fn(),
  authUser: { id: 'user-1', displayName: 'June' } as { id: string; displayName: string } | null,
}));

vi.mock('../src/lib/playlistsApi', () => ({
  getMyPlaylists: mocks.getMyPlaylists,
  getPublicPlaylists: mocks.getPublicPlaylists,
  getPlaylist: mocks.getPlaylist,
  createPlaylist: mocks.createPlaylist,
  addItemToPlaylist: mocks.addItemToPlaylist,
  removeItemFromPlaylist: vi.fn(),
  reorderPlaylistItems: vi.fn(),
  updatePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
}));

vi.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: mocks.authUser, loading: false }),
}));

vi.mock('../src/components/Toast', () => ({
  useToast: () => ({ push: mocks.toast }),
}));

vi.mock('../src/components/WorkspaceShell', () => ({
  useOptionalWorkspacePlayer: () => ({ playExternalQueue: mocks.playExternalQueue, playExternalMedia: vi.fn() }),
  WorkspaceShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { AddToPlaylistButton } from '../src/components/AddToPlaylistButton';
import { PlaylistsPage } from '../src/routes/Playlists';
import { applyPlaylistReorder, PlaylistDetailPage, PlaylistDetailRoute } from '../src/routes/PlaylistDetail';

const playlist = {
  id: 4,
  userId: 'user-1',
  name: 'After Hours',
  description: 'Soft songs',
  isPublic: true,
  coverUrl: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  itemCount: 1,
  ownerDisplayName: 'June',
};

const item = {
  id: 10,
  mediaLibraryId: 'library-1',
  position: 1,
  addedAt: '2026-10-01T00:00:00.000Z',
  provider: 'itunes' as const,
  externalId: 'track-1',
  externalUrl: null,
  type: 'audio' as const,
  mediaType: 'music' as const,
  title: 'Soft Static',
  artist: 'Ivy Lorne',
  thumbnailUrl: 'https://img.example/soft-static.jpg',
  streamUrl: 'https://audio.example/soft-static.mp3',
  durationSeconds: 189,
};

afterEach(cleanup);
beforeEach(() => {
  mocks.authUser = { id: 'user-1', displayName: 'June' };
  mocks.getMyPlaylists.mockResolvedValue([]);
  mocks.getPublicPlaylists.mockResolvedValue([]);
  mocks.createPlaylist.mockResolvedValue(playlist);
  mocks.addItemToPlaylist.mockResolvedValue({});
  mocks.getPlaylist.mockResolvedValue({ playlist, items: [item] });
});

describe('playlist frontend', () => {
  it('shows the empty state when the listener has no playlists', async () => {
    render(<MemoryRouter><PlaylistsPage /></MemoryRouter>);
    expect(await screen.findByText('Your shelves are still quiet.')).toBeTruthy();
    expect(screen.getByText("You haven't created any playlists yet. Start curating your favorites.")).toBeTruthy();
  });

  it('submits the new playlist modal', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PlaylistsPage /></MemoryRouter>);
    await screen.findByText('Your shelves are still quiet.');
    await user.click(screen.getByRole('button', { name: /new playlist/i }));
    await user.type(screen.getByLabelText('Name'), 'After Hours');
    await user.type(screen.getByLabelText(/description/i), 'Soft songs');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create playlist/i }));
    await waitFor(() => expect(mocks.createPlaylist).toHaveBeenCalledWith({
      name: 'After Hours',
      description: 'Soft songs',
      isPublic: true,
    }));
  });

  it('loads playlists in the add-to-playlist popover and adds the item', async () => {
    mocks.getMyPlaylists.mockResolvedValue([playlist]);
    const user = userEvent.setup();
    render(<MemoryRouter><AddToPlaylistButton mediaLibraryId="library-1" /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Add to playlist' }));
    await user.click(await screen.findByRole('button', { name: /After Hours/ }));
    await waitFor(() => expect(mocks.addItemToPlaylist).toHaveBeenCalledWith(4, 'library-1'));
    expect(mocks.toast).toHaveBeenCalledWith('Added to After Hours');
  });

  it('reuses the playlist list when the add popover is reopened within 30 seconds', async () => {
    mocks.getMyPlaylists.mockResolvedValue([playlist]);
    const user = userEvent.setup();
    render(<MemoryRouter><AddToPlaylistButton mediaLibraryId="library-1" /></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'Add to playlist' });
    await user.click(button);
    await screen.findByRole('button', { name: /After Hours/ });
    await user.click(button);
    await user.click(button);
    await screen.findByRole('button', { name: /After Hours/ });
    expect(mocks.getMyPlaylists).toHaveBeenCalledTimes(1);
  });

  it('rolls back the item order when the reorder API fails', async () => {
    const initial = [{ ...item, id: 10, position: 1 }, { ...item, id: 11, position: 2 }];
    const reordered = [...initial].reverse();
    let visible = initial;
    const snapshots: number[][] = [];
    await applyPlaylistReorder(
      initial,
      reordered,
      async () => { throw new Error('Reorder failed'); },
      (next) => {
        visible = next;
        snapshots.push(next.map((entry) => entry.id));
      },
      () => {},
    );
    expect(snapshots).toEqual([[11, 10], [10, 11]]);
    expect(visible.map((entry) => entry.id)).toEqual([10, 11]);
  });

  it('queues playlist items in order when Play All is pressed', async () => {
    render(
      <MemoryRouter initialEntries={['/playlists/4']}>
        <Routes><Route path="/playlists/:id" element={<PlaylistDetailPage />} /></Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'After Hours' });
    fireEvent.click(screen.getByRole('button', { name: /play all/i }));
    expect(mocks.playExternalQueue).toHaveBeenCalledWith([{
      id: 'library-1',
      type: 'audio',
      provider: 'itunes',
      mediaType: 'music',
      externalId: 'track-1',
      title: 'Soft Static',
      artist: 'Ivy Lorne',
      thumbnailUrl: 'https://img.example/soft-static.jpg',
      streamUrl: 'https://audio.example/soft-static.mp3',
      externalUrl: null,
    }]);
  });

  it('opens a public playlist detail link without authentication', async () => {
    mocks.authUser = null;
    render(
      <MemoryRouter initialEntries={['/playlists/4']}>
        <Routes><Route path="/playlists/:id" element={<PlaylistDetailRoute />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'After Hours' })).toBeTruthy();
    expect(screen.getByText('🌐 Public')).toBeTruthy();
  });
});
