import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getPlaylist: vi.fn(),
}));

vi.mock('../src/lib/playlistsApi', () => ({
  getPlaylist: mocks.getPlaylist,
  getMyPlaylists: vi.fn(),
  getPublicPlaylists: vi.fn(),
  createPlaylist: vi.fn(),
  addItemToPlaylist: vi.fn(),
  removeItemFromPlaylist: vi.fn(),
  reorderPlaylistItems: vi.fn(),
  updatePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
}));

vi.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }),
}));

vi.mock('react-player/file', () => ({ default: () => null }));
vi.mock('react-player/youtube', () => ({ default: () => null }));
vi.mock('react-player/soundcloud', () => ({ default: () => null }));

import { PlaylistDetailRoute } from '../src/routes/PlaylistDetail';
import { ToastProvider, useToast } from '../src/components/Toast';

const publicPlaylist = {
  id: 4,
  userId: 'owner-1',
  name: 'After Hours',
  description: 'Soft songs',
  isPublic: true,
  coverUrl: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  itemCount: 1,
  ownerDisplayName: 'June',
};

const media = {
  id: 10,
  mediaLibraryId: 'library-1',
  position: 1,
  addedAt: '2026-10-01T00:00:00.000Z',
  provider: 'itunes',
  externalId: 'track-1',
  externalUrl: null,
  type: 'audio',
  mediaType: 'music',
  title: 'Soft Static',
  artist: 'Ivy Lorne',
  thumbnailUrl: null,
  streamUrl: 'https://audio.example/soft-static.mp3',
  durationSeconds: 189,
};

afterEach(cleanup);

it('lets an anonymous listener play a public playlist in the persistent dock', async () => {
  mocks.getPlaylist.mockResolvedValue({ playlist: publicPlaylist, items: [media] });
  render(
    <MemoryRouter initialEntries={['/playlists/4']}>
      <Routes><Route path="/playlists/:id" element={<PlaylistDetailRoute />} /></Routes>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'After Hours' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /play all/i }));
  expect(await screen.findByRole('contentinfo', { name: 'Global audio player' })).toBeTruthy();
  expect(screen.getAllByText('Soft Static').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull();
  expect(screen.queryByRole('button', { name: /add current media/i })).toBeNull();
});

function ToastTrigger() {
  const toast = useToast();
  return <button type="button" onClick={() => toast.push('Added to After Hours')}>Show toast</button>;
}

it('announces toast messages using a polite status region', () => {
  render(<ToastProvider><ToastTrigger /></ToastProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Show toast' }));
  const status = screen.getByRole('status');
  expect(status.getAttribute('aria-live')).toBe('polite');
  expect(status.textContent).toContain('Added to After Hours');
});
