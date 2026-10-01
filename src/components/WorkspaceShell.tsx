import {
  createContext,
  lazy,
  Suspense,
  useContext,
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
import { Icon, type IconName } from './Icon';
import type { Mix, Track } from '../data/types';
import { formatClock } from '../lib/hooks';
import {
  fetchMixes,
  fetchNowPlaying,
  updateNowPlaying,
  type NowPlaying,
} from '../lib/musicApi';
const YouTubePlayer = lazy(() => import('react-player/youtube'));
const SoundCloudPlayer = lazy(() => import('react-player/soundcloud'));
const FilePlayer = lazy(() => import('react-player/file'));

const DEMO_AUDIO_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

type ExternalMedia = {
  id?: string;
  type: 'video' | 'podcast' | 'audio';
  provider: 'youtube' | 'itunes' | 'soundcloud' | 'audius';
  externalId: string;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  streamUrl: string;
  externalUrl: string | null;
  createdAt?: string;
};

type NavigationItem = {
  label: string;
  to: string;
  icon: IconName;
  end?: boolean;
};

const NAV_GROUPS: { label: string; items: NavigationItem[] }[] = [
  {
    label: 'Discover',
    items: [
      { label: 'Home / Dashboard', to: '/tapes', icon: 'home', end: true },
      { label: 'Search Hub', to: '/search', icon: 'search' },
      { label: 'Movies', to: '/movies', icon: 'play-circle' },
      { label: 'Trending', to: '/trending', icon: 'trend-up' },
    ],
  },
  {
    label: 'My Media',
    items: [
      { label: 'Music Library', to: '/library', icon: 'library' },
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
      { label: 'Profile Settings', to: '/lowlight/profile', icon: 'user' },
      { label: 'Appearance', to: '/settings/appearance', icon: 'settings' },
      { label: 'About', to: '/about', icon: 'moon' },
    ],
  },
];

type WorkspacePlayer = {
  mixes: Mix[];
  nowPlaying: NowPlaying | null;
  externalMedia: ExternalMedia | null;
  externalPlaying: boolean;
  buffering: boolean;
  progress: number;
  duration: number;
  error: string;
  volume: number;
  updateProgress: (seconds: number) => void;
  setDuration: (seconds: number) => void;
  setError: (message: string) => void;
  setExternalPlaying: (playing: boolean) => void;
  selectTrack: (mix: Mix, track: Track) => Promise<void>;
  playExternalMedia: (media: ExternalMedia) => void;
  toggle: () => Promise<void>;
  skip: (direction: -1 | 1) => Promise<void>;
  seek: (seconds: number) => void;
  persistSeek: () => Promise<void>;
  setVolume: (value: number) => void;
};

const PlayerContext = createContext<WorkspacePlayer | null>(null);

export function useWorkspacePlayer() {
  const player = useContext(PlayerContext);
  if (!player) throw new Error('useWorkspacePlayer must be used inside WorkspaceShell');
  return player;
}

function PlayerDock() {
  const {
    nowPlaying,
    externalMedia,
    externalPlaying,
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

  return (
    <footer className="workspace-player" aria-label="Global audio player">
      <div className="workspace-player__track">
        {track ? (
          <span className="workspace-player__art">
            <CoverArt seed={track.cover} ratio="square" />
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
      </div>
      <div className="workspace-player__controls">
        <button
          type="button"
          className="iconbtn"
          aria-label="Previous track"
          disabled={!track || Boolean(externalMedia)}
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
          disabled={!track || Boolean(externalMedia)}
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
  const progressRef = useRef(0);
  const [externalMedia, setExternalMedia] = useState<ExternalMedia | null>(null);
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

  useEffect(() => {
    let active = true;
    async function loadPlayer() {
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
  }, []);

  useEffect(() => {
    if (!externalMedia && nowPlaying) {
      progressRef.current = nowPlaying.progressSeconds;
      setProgress(nowPlaying.progressSeconds);
      audioRef.current?.seekTo(nowPlaying.progressSeconds, 'seconds');
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
    setProgress(0);
    progressRef.current = 0;
    setDuration(0);
    if (media.type === 'video') {
      setExternalPlaying(true);
    } else {
      setExternalPlaying(true);
    }
    setBuffering(true);
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
    if (!nowPlaying || externalMedia || mixes.length === 0) return;
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
    } else if (externalMedia?.type === 'video' && videoRef.current) {
      videoRef.current.seekTo(seconds, 'seconds');
    } else if (audioRef.current) {
      audioRef.current.seekTo(seconds, 'seconds');
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
    toggle,
    skip,
    seek,
    persistSeek,
    setVolume: setVolumeState,
  };

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search');
  }

  return (
    <PlayerContext.Provider value={player}>
      <div className={`workspace${collapsed ? ' workspace--collapsed' : ''}${mobileMenuOpen ? ' workspace--menu-open' : ''}`}>
        <aside className="workspace-sidebar" aria-label="Main navigation">
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
            {NAV_GROUPS.map((group) => (
              <section className="workspace-nav-group" key={group.label} aria-label={group.label}>
                <p className="workspace-sidebar__eyebrow">{group.label}</p>
                <nav>
                  {group.items.map((item) => (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      className={({ isActive }) => `workspace-nav-link${isActive ? ' is-active' : ''}`}
                    >
                      <Icon name={item.icon} size={18} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </nav>
              </section>
            ))}
          </div>
          <div className="workspace-sidebar__footer">
            <span className="dot dot--live" aria-hidden="true" />
            <span className="workspace-sidebar__footer-label">A quiet place for the night</span>
          </div>
        </aside>

        {mobileMenuOpen ? (
          <button
            className="workspace-backdrop"
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}

        <div className="workspace-main">
          <header className="workspace-topbar">
            <button
              type="button"
              className="workspace-topbar__menu"
              aria-label="Open navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Icon name="menu" size={21} />
            </button>
            <form className="workspace-search" role="search" onSubmit={submitSearch}>
              <Icon name="search" size={19} />
              <input
                type="search"
                aria-label="Search Nocturne"
                placeholder="Search songs, stories, people..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              <button type="submit" aria-label="Submit search"><kbd>Enter</kbd></button>
            </form>
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
              <button
                type="button"
                className="workspace-account__trigger"
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span className="workspace-account__avatar" aria-hidden="true">
                  {(user?.displayName ?? 'N').slice(0, 1).toUpperCase()}
                </span>
                <span className="workspace-account__name">{user?.displayName ?? 'Listener'}</span>
                <Icon name="chevron-down" size={15} />
              </button>
              {accountMenuOpen ? (
                <div className="workspace-account__menu" role="menu">
                  <div className="workspace-account__identity">
                    <strong>{user?.displayName}</strong>
                    <span>{user?.email}</span>
                  </div>
                  <Link to="/lowlight/profile" role="menuitem" className="workspace-account__item">
                    <Icon name="user" size={17} /> Profile
                  </Link>
                  <Link to="/settings/appearance" role="menuitem" className="workspace-account__item">
                    <Icon name="settings" size={17} /> Settings
                  </Link>
                  <button type="button" role="menuitem" className="workspace-account__item workspace-account__item--signout" onClick={() => void onSignOut()}>
                    <Icon name="close" size={17} /> Sign out
                  </button>
                  {signOutError ? <p className="workspace-account__error" role="alert">{signOutError}</p> : null}
                </div>
              ) : null}
            </div>
          </header>

          <main className="workspace-content" key={location.pathname}>
            {children ?? <Outlet />}
          </main>
        </div>

        {externalMedia?.type === 'video' || externalMedia?.provider === 'soundcloud' ? (
          <div className="workspace-video-window" aria-label={`Video player: ${externalMedia.title}`}>
            <Suspense fallback={<span className="workspace-video-loading" role="status">Opening the video player…</span>}>
              {externalMedia.provider === 'soundcloud' ? (
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
                  onEnded={() => setExternalPlaying(false)}
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
                  onEnded={() => setExternalPlaying(false)}
                  onError={() => {
                    setBuffering(false);
                    setError('This video could not be played. The provider may have disabled embedding.');
                  }}
                  playsinline
                />
              )}
            </Suspense>
          </div>
        ) : null}
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
          onEnded={() => externalMedia ? setExternalPlaying(false) : void skip(1)}
          onError={() => {
            setBuffering(false);
            setError('This audio could not be loaded. Check your connection or try another preview.');
          }}
          config={{ file: { forceAudio: true, forceDisableHls: true, forceDASH: false } }}
          />
        </Suspense>
        <PlayerDock />
      </div>
    </PlayerContext.Provider>
  );
}
