import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  getTrending: vi.fn(),
  getNewReleases: vi.fn(),
  getForYou: vi.fn(),
  getCommunityPlaylists: vi.fn(),
  getFollowingFeed: vi.fn(),
  prefetchMovieDetails: vi.fn(),
  fetchMovieDetails: vi.fn(),
  user: null as { id: string; displayName: string } | null,
  playExternalMedia: vi.fn(),
}));
const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

vi.mock('../src/lib/discoverApi', () => ({
  getTrending: mocks.getTrending,
  getNewReleases: mocks.getNewReleases,
  getForYou: mocks.getForYou,
  getCommunityPlaylists: mocks.getCommunityPlaylists,
}));

vi.mock('../src/lib/socialApi', () => ({
  getFollowingFeed: mocks.getFollowingFeed,
}));

vi.mock('../src/lib/moviesApi', () => ({
  fetchMovieDetails: mocks.fetchMovieDetails,
  prefetchMovieDetails: mocks.prefetchMovieDetails,
  saveMovie: vi.fn(),
}));

vi.mock('../src/auth/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user, loading: false }),
}));

vi.mock('../src/components/WorkspaceShell', () => ({
  WorkspaceShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useOptionalWorkspacePlayer: () => ({ playExternalMedia: mocks.playExternalMedia }),
}));

import { Home } from '../src/routes/Home';
import { Shelf } from '../src/components/Shelf';

const trending = {
  movies: [{ id: 'movie-1', title: 'Moon Rooms', media_type: 'movie', source: 'tmdb', thumbnail_url: null }],
  podcasts: [],
  music: [{ id: 'music-1', title: 'Soft Static', media_type: 'music', source: 'audius', thumbnail_url: null }],
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  else delete (window as Partial<Window>).matchMedia;
});

beforeEach(() => {
  mocks.user = null;
  mocks.getTrending.mockResolvedValue(trending);
  mocks.getNewReleases.mockResolvedValue({
    movies: [],
    podcasts: [{ id: 'episode-1', title: 'Night Radio', media_type: 'podcast', source: 'itunes', thumbnail_url: null }],
  });
  mocks.getForYou.mockResolvedValue({ movies: [], podcasts: [], music: [] });
  mocks.getCommunityPlaylists.mockResolvedValue([]);
  mocks.getFollowingFeed.mockResolvedValue({ activities: [], hasMore: false });
  mocks.prefetchMovieDetails.mockResolvedValue({});
});

describe('discovery home and shelf', () => {
  it('renders the discovery shelves in order and isolates a failed section', async () => {
    mocks.user = { id: 'listener-1', displayName: 'June' };
    mocks.getNewReleases.mockRejectedValueOnce(new Error('iTunes unavailable'));
    render(<MemoryRouter><Home /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText("Couldn't load this section.")).toBeTruthy());
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      'Good things to press play on.',
      'For You',
      'From People You Follow',
      'Trending Movies',
      'New Podcasts',
      'Fresh Music for You',
      'Community Playlists',
    ]);
    expect(mocks.getForYou).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('Moon Rooms').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect((await screen.findAllByText('Night Radio')).length).toBeGreaterThan(0);
  });

  it('does not request the personalized endpoint for an anonymous visitor', async () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Trending Movies' });
    expect(mocks.getForYou).not.toHaveBeenCalled();
  });

  it('advances the hero feature every eight seconds', async () => {
    vi.useFakeTimers();
    render(<MemoryRouter><Home /></MemoryRouter>);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const carousel = screen.getByRole('region', { name: 'Featured discoveries' });
    expect(carousel.getAttribute('data-active-index')).toBe('0');
    await act(async () => { vi.advanceTimersByTime(8000); });
    expect(carousel.getAttribute('data-active-index')).toBe('1');
  });

  it('does not auto-rotate when reduced motion is preferred', async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    render(<MemoryRouter><Home /></MemoryRouter>);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const carousel = screen.getByRole('region', { name: 'Featured discoveries' });
    expect(carousel.getAttribute('data-active-index')).toBe('0');
    await act(async () => { vi.advanceTimersByTime(8000); });
    expect(carousel.getAttribute('data-active-index')).toBe('0');
  });

  it('exposes manual carousel controls and changes slides with next', async () => {
    render(<MemoryRouter><Home /></MemoryRouter>);
    const carousel = screen.getByRole('region', { name: 'Featured discoveries' });
    await waitFor(() => expect(carousel.getAttribute('data-active-index')).toBe('0'));
    expect(screen.getByRole('button', { name: 'Pause carousel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(carousel.getAttribute('data-active-index')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(carousel.getAttribute('data-active-index')).toBe('0');
  });

  it('scroll buttons move the shelf scroller', () => {
    const scrollBy = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollBy', {
      configurable: true,
      value: scrollBy,
    });
    render(
      <MemoryRouter>
        <Shelf title="Music" items={['one']} renderCard={(item) => <span>{item}</span>} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Scroll right' }));
    expect(scrollBy).toHaveBeenCalledWith({ left: 520, behavior: 'smooth' });
    fireEvent.click(screen.getByRole('button', { name: 'Scroll left' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -520, behavior: 'smooth' });
  });

  it('debounces movie prefetch and cancels when the pointer leaves early', async () => {
    vi.useFakeTimers();
    const { MediaCard } = await import('../src/components/MediaCard');
    render(
      <MemoryRouter>
        <MediaCard media={{
          id: 'movie-1',
          title: 'Moon Rooms',
          thumbnail_url: null,
          media_type: 'movie',
          source: 'tmdb',
        }} />
      </MemoryRouter>,
    );
    const card = document.querySelector('.media-card');
    expect(card).toBeTruthy();
    fireEvent.mouseEnter(card!);
    await act(async () => { vi.advanceTimersByTime(299); });
    fireEvent.mouseLeave(card!);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(mocks.prefetchMovieDetails).not.toHaveBeenCalled();

    fireEvent.mouseEnter(card!);
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(mocks.prefetchMovieDetails).toHaveBeenCalledTimes(1);
    expect(mocks.prefetchMovieDetails).toHaveBeenCalledWith('movie-1');
  });
});
