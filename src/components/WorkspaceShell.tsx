import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type FilePlayerInstance from 'react-player/file';
import type SoundCloudPlayerInstance from 'react-player/soundcloud';
import type YouTubePlayerInstance from 'react-player/youtube';
import type { OnProgressProps } from 'react-player/base';
import { useAuth } from '../auth/AuthContext';
import { CoverArt } from './CoverArt';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { Icon, type IconName } from './Icon';
import type { Mix, Track } from '../data/types';
import { formatClock } from '../lib/hooks';
import { saveMedia, searchSuggest, type SuggestionItem } from '../lib/mediaApi';
import {
  fetchMixes,
  fetchNowPlaying,
  updateNowPlaying,
  type NowPlaying,
} from '../lib/musicApi';
import { PlayerContext, useWorkspacePlayer, type ExternalMedia, type WorkspacePlayer } from '../lib/workspaceHooks';

export { useOptionalWorkspacePlayer, useWorkspacePlayer } from '../lib/workspaceHooks';
const YouTubePlayer = lazy(() => import('react-player/youtube'));
const SoundCloudPlayer = lazy(() => import('react-player/soundcloud'));
const FilePlayer = lazy(() => import('react-player/file'));

const DEMO_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

type NavigationItem = {
  label: string;
  to: string;
  icon: IconName;
  end?: boolean;
  queryTab?: 'mine' | 'discover';
};

const NAV_GROUPS: { label: string; items: NavigationItem[] }[] = [
  {
    label: 'Discover',
    items: [
      { label: 'Home / Dashboard', to: '/tapes', icon: 'home', end: true },
      { label: 'Search Hub', to: '/search', icon: 'search' },
      { label: 'Movies', to: '/movies', icon: 'play-circle' },
      { label: 'Discover Playlists', to: '/playlists?tab=discover', icon: 'library', end: true, queryTab: 'discover' },
      { label: 'Trending', to: '/trending', icon: 'trend-up' },
    ],
  },
  {
    label: 'My Media',
    items: [
      { label: 'Music Library', to: '/library', icon: 'library' },
      { label: 'Playlists', to: '/playlists', icon: 'library', end: true, queryTab: 'mine' },
      { label: 'Podcast Subscriptions', to: '/static/shows', icon: 'mic' },
      { label: 'Watch Later', to: '/static/saved', icon: 'bookmark' },
    ],
  },
  {
    label: 'Personal',
    items: [
      { label: 'Song Diary', to: '/diary', icon: 'book', end: true },
      { label: 'Listening Stats', to: '/diary/stats', icon: 'dial' },
      { label: 'Mood Check-in', to: '/mood', icon: 'sparkle' },
    ],
  },
  {
    label: 'Social',
    items: [
      { label: 'Matches', to: '/lowlight/matches', icon: 'users' },
      { label: 'Chat', to: '/chat', icon: 'message' },
      { label: 'Community Feed', to: '/community', icon: 'heart' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', to: '/settings', icon: 'settings' },
      { label: 'Appearance', to: '/settings/appearance', icon: 'settings' },
      { label: 'About', to: '/about', icon: 'moon' },
    ],
  },
];

function PlayerDock() {
  const { user } = useAuth();
  const {
    nowPlaying,
    externalMedia,
    externalQueue,
    externalQueueIndex,
    externalPlaying,
    ensureExternalMediaSaved,
    buffering,
    progress,
    duration,
    error,
    volume,
    toggle,
    skip,
    seek,
    persistSeek,
    setVolume,
  } = useWorkspacePlayer();
  const track = externalMedia ? {
    id: externalMedia.externalId,
    title: externalMedia.title,
    artist: externalMedia.artist ?? externalMedia.provider,
    seconds: duration,
    cover: externalMedia.thumbnailUrl ?? 'moonlit-sill',
  } : nowPlaying?.track;
  const isVideo = externalMedia?.type === 'video' || externalMedia?.mediaType === 'video_podcast';

  return (
    <footer className={`workspace-player${isVideo ? ' workspace-player--video' : ''}`} aria-label="Global audio player">
      <div className="workspace-player__track">
        {track ? (
          <span className="workspace-player__art">
            {externalMedia?.thumbnailUrl
              ? <img src={externalMedia.thumbnailUrl} alt="" loading="lazy" />
              : <CoverArt seed={track.cover} ratio="square" />}
          </span>
        ) : (
          <span className="workspace-player__art workspace-player__art--empty">
            <Icon name="headphones" size={19} />
          </span>
        )}
        <span className="workspace-player__copy">
          <strong>{track?.title ?? 'Nothing playing yet'}</strong>
          <span>{track?.artist ?? 'Choose something from your listening room'}</span>
        </span>
        {user && externalMedia ? (
          <AddToPlaylistButton
            mediaLibraryId={externalMedia.id}
            ensureMediaSaved={ensureExternalMediaSaved}
            label="Add current media to playlist"
          />
        ) : null}
      </div>
      <div className="workspace-player__controls">
        <button
          type="button"
          className="iconbtn"
          aria-label="Previous track"
          disabled={!track || (Boolean(externalMedia) && (!externalQueue.length || externalQueueIndex <= 0))}
          onClick={() => void skip(-1)}
        >
          <Icon name="skip-back" size={19} />
        </button>
        <button
          type="button"
          className="workspace-player__toggle"
          aria-label={(externalMedia ? externalPlaying : nowPlaying?.isPlaying) ? 'Pause' : 'Play'}
          disabled={!track}
          onClick={() => void toggle()}
        >
          <Icon name={(externalMedia ? externalPlaying : nowPlaying?.isPlaying) ? 'pause' : 'play'} size={18} />
        </button>
        <button
          type="button"
          className="iconbtn"
          aria-label="Next track"
          disabled={!track || (Boolean(externalMedia) && externalQueueIndex >= externalQueue.length - 1)}
          onClick={() => void skip(1)}
        >
          <Icon name="skip-forward" size={19} />
        </button>
        <label className="sr-only" htmlFor="workspace-player-progress">Track progress</label>
        <input
          id="workspace-player-progress"
          className="workspace-player__seek"
          type="range"
          min="0"
          max={track?.seconds ?? 1}
          value={track?.seconds ? Math.min(progress, track.seconds) : 0}
          disabled={!track || !track.seconds}
          onChange={(event) => {
            const seconds = Number(event.target.value);
            seek(seconds);
          }}
          onPointerUp={() => void persistSeek()}
          onKeyUp={() => void persistSeek()}
        />
        <span className="workspace-player__time t-mono">
          {formatClock(progress)} / {formatClock(track?.seconds ?? 0)}
        </span>
      </div>
      <div className="workspace-player__volume">
        <Icon name={volume === 0 ? 'volume-off' : 'volume'} size={17} />
        <label className="sr-only" htmlFor="workspace-player-volume">Volume</label>
        <input
          id="workspace-player-volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
      </div>
      {buffering ? <span className="workspace-player__buffering" role="status"><i /> Loading media…</span> : null}
      {error ? <span className="workspace-player__error" role="status">{error}</span> : null}
    </footer>
  );
}

export function WorkspaceShell({ children }: { children?: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const audioRef = useRef<FilePlayerInstance>(null);
  const videoRef = useRef<YouTubePlayerInstance>(null);
  const soundcloudRef = useRef<SoundCloudPlayerInstance>(null);
  const videoWindowRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [externalMedia, setExternalMedia] = useState<ExternalMedia | null>(null);
  const [externalQueue, setExternalQueue] = useState<ExternalMedia[]>([]);
  const [externalQueueIndex, setExternalQueueIndex] = useState(-1);
  const [externalPlaying, setExternalPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [duration, setDuration] = useState(0);
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(0.72);
  const [error, setError] = useState('');
  const [playerReady, setPlayerReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('nocturne_recent_searches') || '[]');
    } catch {
      return [];
    }
  });

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [recentlyPlayed, setRecentlyPlayed] = useState<Array<{ id: string; title: string; artist?: string }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('nocturne_play_history') || '[]');
    } catch {
      return [];
    }
  });

  function toggleGroup(groupLabel: string) {
    setCollapsedGroups((prev) => ({ ...prev, [groupLabel]: !prev[groupLabel] }));
  }

  function recordPlayHistory(item: { id: string; title: string; artist?: string }) {
    try {
      const history = JSON.parse(localStorage.getItem('nocturne_play_history') || '[]');
      const next = [item, ...history.filter((i: any) => i.id !== item.id)].slice(0, 5);
      localStorage.setItem('nocturne_play_history', JSON.stringify(next));
      setRecentlyPlayed(next);
    } catch {}
  }

  const suggestCacheRef = useRef<Map<string, { time: number; data: SuggestionItem[] }>>(new Map());
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    const cached = suggestCacheRef.current.get(q);
    const now = Date.now();
    if (cached && now - cached.time < 300000) {
      setSuggestions(cached.data);
      setSuggestLoading(false);
      return;
    }

    let active = true;
    setSuggestLoading(true);
    const timer = setTimeout(() => {
      searchSuggest(q)
        .then((items) => {
          if (!active) return;
          suggestCacheRef.current.set(q, { time: Date.now(), data: items });
          setSuggestions(items);
        })
        .catch(() => {
          if (active) setSuggestions([]);
        })
        .finally(() => {
          if (active) setSuggestLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  function saveRecentSearch(queryStr: string) {
    if (!queryStr.trim()) return;
    const updated = [queryStr, ...recentSearches.filter((s) => s !== queryStr)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('nocturne_recent_searches', JSON.stringify(updated));
  }

  function submitSearch(event?: FormEvent) {
    if (event) event.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      saveRecentSearch(query);
      navigate(`/search?q=${encodeURIComponent(query)}`);
    } else {
      navigate('/search');
    }
    setShowDropdown(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const listCount = searchQuery.trim().length >= 2 ? suggestions.length : (searchQuery.trim() === '' ? recentSearches.length : 0);
    if (!showDropdown || listCount === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % listCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + listCount) % listCount);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      if (searchQuery.trim().length >= 2 && suggestions[selectedIndex]) {
        const item = suggestions[selectedIndex];
        saveRecentSearch(item.title);
        setSearchQuery(item.title);
        setShowDropdown(false);
        navigate(`/search?q=${encodeURIComponent(item.title)}`);
      } else if (searchQuery.trim() === '' && recentSearches[selectedIndex]) {
        const queryStr = recentSearches[selectedIndex];
        setSearchQuery(queryStr);
        setShowDropdown(false);
        navigate(`/search?q=${encodeURIComponent(queryStr)}`);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadPlayer() {
      if (!user) {
        setPlayerReady(true);
        return;
      }
      try {
        const [loadedMixes, loadedState] = await Promise.all([fetchMixes(), fetchNowPlaying()]);
        let safeState = loadedState;
        if (loadedState.isPlaying) {
          const loadedMix = loadedMixes.find((mix) => mix.id === loadedState.mix.id);
          if (!loadedMix) throw new Error('Saved playback references a mix that is no longer available.');
          safeState = await updateNowPlaying(
            loadedMix,
            loadedState.track,
            false,
            loadedState.progressSeconds,
          );
        }
        if (!active) return;
        setMixes(loadedMixes);
        setNowPlaying(safeState);
        setProgress(safeState.progressSeconds);
        progressRef.current = safeState.progressSeconds;
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load the player.');
      } finally {
        if (active) setPlayerReady(true);
      }
    }
    void loadPlayer();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!externalMedia && nowPlaying) {
      progressRef.current = nowPlaying.progressSeconds;
      setProgress(nowPlaying.progressSeconds);
      audioRef.current?.seekTo(nowPlaying.progressSeconds, 'seconds');
      recordPlayHistory({ id: nowPlaying.track.id, title: nowPlaying.track.title, artist: nowPlaying.track.artist });
    }
  }, [nowPlaying?.track.id, playerReady]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
  }, [location.pathname]);

  async function selectTrack(mix: Mix, track: Track) {
    setError('');
    setExternalMedia(null);
    setExternalPlaying(false);
    setDuration(track.seconds);
    audioRef.current?.seekTo(0, 'seconds');
    recordPlayHistory({ id: track.id, title: track.title, artist: track.artist });
    try {
      const updated = await updateNowPlaying(mix, track, false, 0);
      setNowPlaying(updated);
      setProgress(0);
      progressRef.current = 0;
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : 'Could not select that track.');
      throw playError;
    }
  }

  function playExternalMedia(media: ExternalMedia) {
    setError('');
    setBuffering(true);
    setNowPlaying(null);
    setExternalMedia(media);
    setExternalQueue([media]);
    setExternalQueueIndex(0);
    setProgress(0);
    progressRef.current = 0;
    setDuration(0);
    recordPlayHistory({ id: media.externalId, title: media.title, artist: media.artist || undefined });
    if (media.type === 'video') {
      setExternalPlaying(true);
    } else {
      setExternalPlaying(true);
    }
    setBuffering(true);
  }

  function playExternalQueue(queue: ExternalMedia[]) {
    if (!queue.length) return;
    setExternalQueue(queue);
    setExternalQueueIndex(0);
    playExternalMedia(queue[0]);
    setExternalQueue(queue);
    setExternalQueueIndex(0);
  }

  async function ensureExternalMediaSaved() {
    if (!externalMedia) throw new Error('There is no external media playing.');
    if (externalMedia.id) return externalMedia.id;
    if (externalMedia.provider === 'soundcloud') {
      throw new Error('SoundCloud media cannot be added to playlists yet.');
    }
    const result = await saveMedia({
      type: externalMedia.type,
      provider: externalMedia.provider,
      externalId: externalMedia.externalId,
      title: externalMedia.title,
      artist: externalMedia.artist,
      thumbnailUrl: externalMedia.thumbnailUrl,
      streamUrl: externalMedia.streamUrl,
      externalUrl: externalMedia.externalUrl,
      mediaType: externalMedia.mediaType,
    });
    if (!result.item.id) throw new Error('The item was saved, but its library ID was not returned.');
    setExternalMedia((current) => current ? { ...current, id: result.item.id } : current);
    return result.item.id;
  }

  async function persistPlayback(mix: Mix, track: Track, playing: boolean, seconds: number) {
    const updated = await updateNowPlaying(mix, track, playing, Math.floor(seconds));
    setNowPlaying(updated);
    setProgress(seconds);
    progressRef.current = Math.floor(seconds);
  }

  async function toggle() {
    if (externalMedia) {
      setError('');
      if (externalMedia.type === 'video' || externalMedia.provider === 'soundcloud') {
        setExternalPlaying(!externalPlaying);
      } else if (!audioRef.current) {
        setError('Audio playback is not available.');
      } else if (externalPlaying) {
        setExternalPlaying(false);
      } else {
        setExternalPlaying(true);
      }
      return;
    }
    if (!nowPlaying) return;
    const mix = mixes.find((item) => item.id === nowPlaying.mix.id);
    if (!mix) {
      setError('The current mix is no longer available.');
      return;
    }
    setError('');
    if (nowPlaying.isPlaying) {
      try {
        await persistPlayback(mix, nowPlaying.track, false, progressRef.current);
      } catch (playError) {
        setError(playError instanceof Error ? playError.message : 'Could not pause playback.');
      }
      return;
    }
    try {
      await persistPlayback(mix, nowPlaying.track, true, progressRef.current);
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : 'Audio playback could not start.');
    }
  }

  async function skip(direction: -1 | 1) {
    if (externalMedia) {
      const nextIndex = externalQueueIndex + direction;
      const nextMedia = externalQueue[nextIndex];
      if (!nextMedia) {
        setExternalPlaying(false);
        return;
      }
      setExternalQueueIndex(nextIndex);
      setExternalMedia(nextMedia);
      setExternalPlaying(true);
      setProgress(0);
      progressRef.current = 0;
      setDuration(0);
      setBuffering(true);
      recordPlayHistory({ id: nextMedia.externalId, title: nextMedia.title, artist: nextMedia.artist || undefined });
      return;
    }
    if (!nowPlaying || mixes.length === 0) return;
    const queue = mixes.flatMap((mix) => mix.tracks.map((track) => ({ mix, track })));
    const currentIndex = queue.findIndex(({ track }) => track.id === nowPlaying.track.id);
    if (currentIndex < 0 || queue.length === 0) return;
    const next = queue[(currentIndex + direction + queue.length) % queue.length];
    if (!next) return;
    const wasPlaying = nowPlaying.isPlaying;
    try {
      await selectTrack(next.mix, next.track);
    } catch {
      return;
    }
    if (wasPlaying) {
      try {
        await persistPlayback(next.mix, next.track, true, 0);
      } catch (playError) {
        setError(playError instanceof Error ? playError.message : 'Audio playback could not start.');
      }
    }
  }

  function seek(seconds: number) {
    progressRef.current = seconds;
    setProgress(seconds);
    if (externalMedia?.provider === 'soundcloud' && soundcloudRef.current) {
      soundcloudRef.current.seekTo(seconds, 'seconds');
    } else if (externalMedia?.mediaType === 'video_podcast' && audioRef.current) {
      audioRef.current.seekTo(seconds, 'seconds');
    } else if (externalMedia?.type === 'video' && videoRef.current) {
      videoRef.current.seekTo(seconds, 'seconds');
    } else if (audioRef.current) {
      audioRef.current.seekTo(seconds, 'seconds');
    }
  }

  async function togglePictureInPicture() {
    if (!document.pictureInPictureEnabled) return;
    const player = audioRef.current?.getInternalPlayer();
    if (!(player instanceof HTMLVideoElement) || !player.requestPictureInPicture) {
      setError('Picture-in-Picture is not available for this video.');
      return;
    }
    try {
      if (document.pictureInPictureElement === player) await document.exitPictureInPicture();
      else await player.requestPictureInPicture();
    } catch (pipError) {
      setError(pipError instanceof Error ? pipError.message : 'Could not open Picture-in-Picture.');
    }
  }

  async function enterVideoFullscreen() {
    if (!videoWindowRef.current?.requestFullscreen) return;
    try {
      await videoWindowRef.current.requestFullscreen();
    } catch (fullscreenError) {
      setError(fullscreenError instanceof Error ? fullscreenError.message : 'Could not open fullscreen video.');
    }
  }

  async function persistSeek() {
    if (!nowPlaying) return;
    const mix = mixes.find((item) => item.id === nowPlaying.mix.id);
    if (!mix) return;
    try {
      await persistPlayback(mix, nowPlaying.track, nowPlaying.isPlaying, progressRef.current);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save playback progress.');
    }
  }

  async function onSignOut() {
    setSignOutError('');
    try {
      await signOut();
      setExternalPlaying(false);
      navigate('/auth/login', { replace: true });
    } catch (signOutFailure) {
      setSignOutError(signOutFailure instanceof Error ? signOutFailure.message : 'Could not sign out.');
    }
  }

  function updateProgress(seconds: number) {
    if (!Number.isFinite(seconds)) return;
    progressRef.current = Math.floor(seconds);
    setProgress(seconds);
    setBuffering(false);
  }

  const player: WorkspacePlayer = {
    mixes,
    nowPlaying,
    externalMedia,
    externalQueue,
    externalQueueIndex,
    externalPlaying,
    buffering,
    progress,
    duration,
    error,
    volume,
    setDuration,
    setExternalPlaying,
    setError,
    updateProgress,
    selectTrack,
    playExternalMedia,
    playExternalQueue,
    ensureExternalMediaSaved,
    toggle,
    skip,
    seek,
    persistSeek,
    setVolume: setVolumeState,
  };

  return (
    <PlayerContext.Provider value={player}>
      <div className={`workspace${collapsed ? ' workspace--collapsed' : ''}${mobileMenuOpen ? ' workspace--menu-open' : ''}${user ? '' : ' workspace--anonymous'}`}>
        {user ? <aside className="workspace-sidebar" aria-label="Main navigation">
          <div className="workspace-sidebar__brand">
            <Link to="/tapes" className="workspace-brand">
              <span className="workspace-brand__mark"><Icon name="headphones" size={18} /></span>
              <span className="workspace-brand__text">BEDROOM POP</span>
            </Link>
            <button
              type="button"
              className="workspace-sidebar__collapse"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={18} />
            </button>
            <button
              type="button"
              className="workspace-sidebar__close"
              aria-label="Close navigation"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon name="close" size={19} />
            </button>
          </div>
          <div className="workspace-sidebar__body">
            {NAV_GROUPS.map((group, groupIdx) => {
              const isGroupCollapsed = collapsedGroups[group.label];
              return (
                <div key={group.label}>
                  <section className="workspace-nav-group" aria-label={group.label}>
                    <button
                      type="button"
                      className="workspace-sidebar__eyebrow-btn"
                      onClick={() => toggleGroup(group.label)}
                      style={{ background: 'none', border: 'none', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0 8px 14px' }}
                    >
                      <span className="workspace-sidebar__eyebrow" style={{ margin: 0 }}>{group.label}</span>
                      <span style={{ color: 'var(--tp-mute)', display: 'inline-flex' }}>
                        <Icon name={isGroupCollapsed ? 'chevron-down' : 'chevron-right'} size={14} />
                      </span>
                    </button>
                    {!isGroupCollapsed && (
                      <nav>
                        {group.items.map((item) => (
                          <NavLink
                            key={item.label}
                            to={item.to}
                            end={item.end}
                            title={collapsed ? item.label : undefined}
                            aria-label={collapsed ? item.label : undefined}
                            className={({ isActive }) => {
                              const active = item.queryTab
                                ? isActive && (new URLSearchParams(location.search).get('tab') ?? 'mine') === item.queryTab
                                : isActive;
                              return `workspace-nav-link${active ? ' is-active' : ''}`;
                            }}
                          >
                            <Icon name={item.icon} size={18} />
                            <span>{item.label}</span>
                          </NavLink>
                        ))}
                      </nav>
                    )}
                  </section>
                  {groupIdx === 0 && recentlyPlayed.length > 0 && !isGroupCollapsed && (
                    <section className="workspace-nav-group workspace-recent-group" aria-label="Recently Played" style={{ marginTop: '19px' }}>
                      <p className="workspace-sidebar__eyebrow" style={{ margin: '0 8px 14px' }}>Recently Played</p>
                      <nav>
                        {recentlyPlayed.map((track) => (
                          <div key={track.id} className="workspace-nav-link" style={{ fontSize: '11px', opacity: 0.85, paddingLeft: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Icon name="headphones" size={14} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</span>
                          </div>
                        ))}
                      </nav>
                    </section>
                  )}
                </div>
              );
            })}
          </div>
          <div className="workspace-sidebar__footer">
            <span className="dot dot--live" aria-hidden="true" />
            <span className="workspace-sidebar__footer-label">A quiet place for the night</span>
          </div>
        </aside> : null}

        {user && mobileMenuOpen ? (
          <button
            className="workspace-backdrop"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}

        <div className="workspace-main">
          {user ? <header className="workspace-topbar">
            <button
              type="button"
              className="workspace-topbar__menu"
              aria-label="Open navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Icon name="menu" size={21} />
            </button>
            <div className="workspace-search-container" ref={searchContainerRef}>
              <form className="workspace-search" role="search" onSubmit={submitSearch}>
                <Icon name="search" size={19} />
                <input
                  type="search"
                  aria-label="Search Nocturne"
                  placeholder="Search songs, stories, people..."
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setShowDropdown(true);
                    setSelectedIndex(-1);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={handleKeyDown}
                />
                <button type="submit" aria-label="Submit search"><kbd>Enter</kbd></button>
              </form>

              {showDropdown && (
                <div className="workspace-search__dropdown" role="listbox">
                  {searchQuery.trim().length >= 2 ? (
                    suggestLoading ? (
                      <div className="workspace-search__suggestion-item" style={{ justifyContent: 'center', color: 'var(--tp-mute)' }}>
                        <span className="route-loading__spinner" style={{ width: 14, height: 14 }} />
                        <span>Searching suggestions…</span>
                      </div>
                    ) : suggestions.length > 0 ? (
                      suggestions.map((item, index) => (
                        <button
                          key={`${item.source}-${item.id}`}
                          type="button"
                          role="option"
                          aria-selected={selectedIndex === index}
                          className={`workspace-search__suggestion-item ${selectedIndex === index ? 'is-selected' : ''}`}
                          onClick={() => {
                            saveRecentSearch(item.title);
                            setSearchQuery(item.title);
                            setShowDropdown(false);
                            navigate(`/search?q=${encodeURIComponent(item.title)}`);
                          }}
                        >
                          {item.thumbnail_url ? (
                            <img src={item.thumbnail_url} alt="" className="workspace-search__suggestion-thumb" />
                          ) : (
                            <div className="workspace-search__suggestion-thumb" style={{ background: 'var(--tp-surf-2)', display: 'grid', placeItems: 'center' }}>
                              <Icon name="search" size={14} />
                            </div>
                          )}
                          <div className="workspace-search__suggestion-info">
                            <span className="workspace-search__suggestion-title">{item.title}</span>
                            <span className="workspace-search__suggestion-badge">{item.media_type} ({item.source})</span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="workspace-search__suggestion-item" style={{ color: 'var(--tp-mute)' }}>
                        <span>No suggestions found. Press Enter to search.</span>
                      </div>
                    )
                  ) : searchQuery.trim() === '' && recentSearches.length > 0 ? (
                    <>
                      <div className="workspace-search__dropdown-footer" style={{ borderBottom: '1px solid var(--tp-line)' }}>
                        <span>Recent searches</span>
                        <button type="button" onClick={() => { setRecentSearches([]); localStorage.removeItem('nocturne_recent_searches'); }}>Clear all</button>
                      </div>
                      {recentSearches.map((queryStr, index) => (
                        <button
                          key={queryStr}
                          type="button"
                          role="option"
                          aria-selected={selectedIndex === index}
                          className={`workspace-search__recent-item ${selectedIndex === index ? 'is-selected' : ''}`}
                          onClick={() => {
                            setSearchQuery(queryStr);
                            setShowDropdown(false);
                            navigate(`/search?q=${encodeURIComponent(queryStr)}`);
                          }}
                        >
                          <Icon name="search" size={14} />
                          <span>{queryStr}</span>
                        </button>
                      ))}
                    </>
                  ) : null}
                </div>
              )}
            </div>
            <button
              type="button"
              className="workspace-topbar__notifications"
              aria-label="Notifications, coming soon"
              title="Notifications are coming soon"
              disabled
            >
              <Icon name="bell" size={19} />
            </button>
            <div className="workspace-account">
              <div className="workspace-account__trigger">
                {user ? (
                  <Link to={`/u/${encodeURIComponent(user.id)}`} className="workspace-account__avatar" aria-label="My Profile">
                    {(user.displayName ?? 'N').slice(0, 1).toUpperCase()}
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="workspace-account__toggle"
                  aria-haspopup="menu"
                  aria-expanded={accountMenuOpen}
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  <span className="workspace-account__name">{user?.displayName ?? 'Listener'}</span>
                  <Icon name="chevron-down" size={15} />
                </button>
              </div>
              {accountMenuOpen ? (
                <div className="workspace-account__menu" role="menu">
                  <div className="workspace-account__identity">
                    <strong>{user?.displayName}</strong>
                    <span>{user?.email}</span>
                  </div>
                  <Link to={user ? `/u/${encodeURIComponent(user.id)}` : '/auth/login'} role="menuitem" className="workspace-account__item">
                    <Icon name="user" size={17} /> My Profile
                  </Link>
                  <Link to="/settings" role="menuitem" className="workspace-account__item">
                    <Icon name="settings" size={17} /> Settings
                  </Link>
                  <Link to="/settings?tab=following" role="menuitem" className="workspace-account__item">
                    <Icon name="users" size={17} /> Following
                  </Link>
                  <button type="button" role="menuitem" className="workspace-account__item workspace-account__item--signout" onClick={() => void onSignOut()}>
                    <Icon name="close" size={17} /> Sign out
                  </button>
                  {signOutError ? <p className="workspace-account__error" role="alert">{signOutError}</p> : null}
                </div>
              ) : null}
            </div>
          </header> : null}

          <main className="workspace-content" key={location.pathname}>
            {children ?? <Outlet />}
          </main>
        </div>

        {externalMedia?.type === 'video' || externalMedia?.provider === 'soundcloud' ? (
          <div
            className={`workspace-video-window${externalMedia.mediaType === 'video_podcast' ? ' workspace-video-window--podcast' : ''}`}
            aria-label={`Video player: ${externalMedia.title}`}
            ref={videoWindowRef}
          >
            <Suspense fallback={<span className="workspace-video-loading" role="status">Opening the video player…</span>}>
              {externalMedia.mediaType === 'video_podcast' && externalPlaying ? (
                <FilePlayer
                  key={externalMedia.externalId}
                  ref={audioRef}
                  url={externalMedia.streamUrl}
                  playing={externalPlaying}
                  controls
                  playsinline
                  volume={volume}
                  width="100%"
                  height="100%"
                  progressInterval={500}
                  onProgress={(state: OnProgressProps) => updateProgress(state.playedSeconds)}
                  onDuration={setDuration}
                  onBuffer={() => setBuffering(true)}
                  onBufferEnd={() => setBuffering(false)}
                  onReady={() => setBuffering(false)}
                  onEnded={() => externalQueueIndex < externalQueue.length - 1 ? void skip(1) : setExternalPlaying(false)}
                  onError={() => {
                    setBuffering(false);
                    setError('This video podcast episode could not be played.');
                  }}
                  config={{ file: { forceVideo: true, forceDisableHls: true } }}
                />
              ) : externalMedia.provider === 'soundcloud' ? (
                <SoundCloudPlayer
                  key={externalMedia.externalId}
                  ref={soundcloudRef}
                  url={externalMedia.externalUrl ?? externalMedia.streamUrl}
                  playing={externalPlaying}
                  controls
                  volume={volume}
                  width="100%"
                  height="100%"
                  onProgress={(state: OnProgressProps) => updateProgress(state.playedSeconds)}
                  onDuration={setDuration}
                  onBuffer={() => setBuffering(true)}
                  onBufferEnd={() => setBuffering(false)}
                  onReady={() => setBuffering(false)}
                  onEnded={() => externalQueueIndex < externalQueue.length - 1 ? void skip(1) : setExternalPlaying(false)}
                  onError={() => {
                    setBuffering(false);
                    setError('This SoundCloud item could not be played.');
                  }}
                />
              ) : (
                <YouTubePlayer
                  key={externalMedia.externalId}
                  ref={videoRef}
                  url={externalMedia.externalUrl ?? externalMedia.streamUrl}
                  playing={externalPlaying}
                  controls
                  volume={volume}
                  width="100%"
                  height="100%"
                  onProgress={(state: OnProgressProps) => updateProgress(state.playedSeconds)}
                  onDuration={setDuration}
                  onBuffer={() => setBuffering(true)}
                  onBufferEnd={() => setBuffering(false)}
                  onReady={() => setBuffering(false)}
                  onEnded={() => externalQueueIndex < externalQueue.length - 1 ? void skip(1) : setExternalPlaying(false)}
                  onError={() => {
                    setBuffering(false);
                    setError('This video could not be played. The provider may have disabled embedding.');
                  }}
                  playsinline
                />
              )}
            </Suspense>
            {externalMedia.mediaType === 'video_podcast' ? (
              <div className="workspace-video-window__actions">
                {document.pictureInPictureEnabled ? (
                  <button type="button" className="iconbtn" onClick={() => void togglePictureInPicture()} aria-label="Toggle Picture-in-Picture">
                    <Icon name="picture-in-picture" size={17} />
                  </button>
                ) : null}
                {document.fullscreenEnabled ? (
                  <button type="button" className="iconbtn" onClick={() => void enterVideoFullscreen()} aria-label="Enter fullscreen">
                    <Icon name="fullscreen" size={17} />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {externalMedia?.mediaType !== 'video_podcast' ? (
        <Suspense fallback={<span className="sr-only" role="status">Loading audio player…</span>}>
          <FilePlayer
          className="workspace-file-player"
          ref={audioRef}
          key={externalMedia?.type === 'audio' || externalMedia?.type === 'podcast'
            ? externalMedia.externalId
            : 'nocturne-audio'}
          url={externalMedia?.type === 'audio' || externalMedia?.type === 'podcast'
            ? externalMedia.streamUrl
            : DEMO_AUDIO_URL}
          playing={externalMedia?.type === 'audio' || externalMedia?.type === 'podcast'
            ? externalPlaying
            : Boolean(nowPlaying?.isPlaying)}
          volume={volume}
          width="1px"
          height="1px"
          progressInterval={500}
          onReady={() => setBuffering(false)}
          onBuffer={() => setBuffering(true)}
          onBufferEnd={() => setBuffering(false)}
          onProgress={(state: OnProgressProps) => updateProgress(state.playedSeconds)}
          onDuration={setDuration}
          onEnded={() => externalMedia
            ? externalQueueIndex < externalQueue.length - 1 ? void skip(1) : setExternalPlaying(false)
            : void skip(1)}
          onError={() => {
            setBuffering(false);
            setError('This audio could not be loaded. Check your connection or try another preview.');
          }}
          config={{ file: { forceAudio: true, forceDisableHls: true, forceDASH: false } }}
          />
        </Suspense>
        ) : null}
        <PlayerDock />
      </div>
    </PlayerContext.Provider>
  );
}
