import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import type FilePlayerInstance from 'react-player/file';
import type SoundCloudPlayerInstance from 'react-player/soundcloud';
import type YouTubePlayerInstance from 'react-player/youtube';
import type { OnProgressProps } from 'react-player/base';
import { useAuth } from '../auth/AuthContext';
import { CoverArt } from './CoverArt';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { SmartImage } from './SmartImage';
import { Icon, type IconName } from './Icon';
import type { Mix, Track } from '../data/types';
import { formatClock } from '../lib/hooks';
import { saveMedia } from '../lib/mediaApi';
import { useCommandPalette } from '../lib/useCommandPalette';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { OfflineBanner } from './OfflineBanner';
import { useQueue } from '../lib/useQueue';
import { useSleepTimer } from '../lib/useSleepTimer';
import { usePlaybackModes } from '../lib/usePlaybackModes';
import { IdleRecommendations } from './player/IdleRecommendations';
import { QueueButton } from './player/QueueButton';
import { WaveformPlaceholder } from './player/WaveformPlaceholder';
import '../styles/top-bar.css';
import '../styles/player-dock.css';
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
const CommandPalette = lazy(() => import('./command-palette/CommandPalette'));
const SleepTimer = lazy(() => import('./player/SleepTimer').then((m) => ({ default: m.SleepTimer })));

const DEMO_AUDIO_URL = 'https://discoveryprovider.audius.co/v1/tracks/95wro/stream?app_name=Nocturne';

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
    shuffle,
    repeat,
    toggleShuffle,
    cycleRepeat,
    queue,
    removeFromQueue,
    clearQueue,
    timerMode,
    timeLeftMinutes,
    setTimer,
    toggle,
    skip,
    seek,
    persistSeek,
    setVolume,
    playExternalMedia,
  } = useWorkspacePlayer();

  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState(0);

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
              ? <SmartImage src={externalMedia.thumbnailUrl} alt="" loading="lazy" />
              : <CoverArt seed={track.cover} ratio="square" />}
          </span>
        ) : (
          <span className="workspace-player__art workspace-player__art--empty">
            <Icon name="headphones" size={19} />
          </span>
        )}
        <span className="workspace-player__copy">
          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {track?.title ?? 'Nothing playing yet'}
            {!track && <WaveformPlaceholder />}
          </strong>
          <span>{track?.artist ?? 'Choose something from your listening room'}</span>
        </span>
        {!track && (
          <IdleRecommendations
            isIdle={!track}
            onPlay={(item) => playExternalMedia(item)}
          />
        )}
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

        <button
          type="button"
          className={`playback-mode-btn ${shuffle ? 'is-active' : ''}`}
          aria-label="Shuffle"
          aria-pressed={shuffle}
          onClick={toggleShuffle}
        >
          <Icon name="trend-up" size={16} />
        </button>

        <button
          type="button"
          className={`playback-mode-btn ${repeat !== 'off' ? 'is-active' : ''}`}
          aria-label={`Repeat: ${repeat}`}
          onClick={cycleRepeat}
        >
          <Icon name="refresh" size={16} />
          {repeat === 'one' && <span className="repeat-one-badge">1</span>}
        </button>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 80 }}>
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
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const pct = Math.max(0, Math.min(1, x / rect.width));
              setHoverTime(pct * (track?.seconds ?? 0));
              setTooltipPos(x);
            }}
            onMouseLeave={() => setHoverTime(null)}
          />
          {hoverTime !== null && (
            <div style={{ position: 'absolute', top: -28, left: tooltipPos, transform: 'translateX(-50%)', background: 'var(--tp-surf)', border: '1px solid var(--tp-line)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--tp-font-mono)', pointerEvents: 'none', zIndex: 10 }}>
              {formatClock(hoverTime)}
            </div>
          )}
        </div>
        <span className="workspace-player__time t-mono">
          {formatClock(progress)} / {formatClock(track?.seconds ?? 0)}
        </span>
      </div>
      <div className="workspace-player__volume" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <QueueButton
          queue={queue}
          currentIndex={externalQueueIndex >= 0 ? externalQueueIndex : 0}
          onClear={clearQueue}
          onRemove={removeFromQueue}
          onSelectIndex={() => {}}
        />
        <Suspense fallback={null}>
          <SleepTimer
            timerMode={timerMode}
            timeLeftMinutes={timeLeftMinutes}
            setTimer={setTimer}
          />
        </Suspense>
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
  const { user } = useAuth();
  const location = useLocation();
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [recentlyPlayed, setRecentlyPlayed] = useState<Array<{ id: string; title: string; artist?: string }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('nocturne_play_history') || '[]');
    } catch {
      return [];
    }
  });

  const sidebarBodyRef = useRef<HTMLDivElement>(null);
  const lastUserScrollRef = useRef(0);

  useEffect(() => {
    const now = Date.now();
    if (sidebarBodyRef.current && now - lastUserScrollRef.current > 5000) {
      sidebarBodyRef.current.scrollTop = 0;
    }
  }, [location.pathname, location.search]);

  const { queue, addToQueue, removeFromQueue, clearQueue, reorderQueue } = useQueue(externalQueue);
  const { shuffle, repeat, toggleShuffle, cycleRepeat } = usePlaybackModes();
  const [sleepToast, setSleepToast] = useState('');
  const { timerMode, timeLeftMinutes, setTimer } = useSleepTimer(() => {
    if (externalPlaying || nowPlaying?.isPlaying) {
      void toggle();
    }
    setSleepToast('Sleep timer complete. Good night.');
    window.setTimeout(() => setSleepToast(''), 5000);
  });

  useEffect(() => {
    if (!shuffle) {
      setExternalQueue((prev) => [...prev].sort((a: any, b: any) => (a._originalIndex ?? 0) - (b._originalIndex ?? 0)));
    }
  }, [shuffle]);

  const { isOpen: isPaletteOpen, open: openPalette, close: closePalette } = useCommandPalette();
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(
      (navigator as any).userAgentData?.platform || navigator.platform || ''
    ));
  }, []);

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
    setExternalQueue([{ ...media, _originalIndex: 0 }]);
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

  function playExternalQueue(queueList: ExternalMedia[]) {
    if (!queueList.length) return;
    const tagged = queueList.map((item, idx) => ({ ...item, _originalIndex: (item as any)._originalIndex ?? idx }));
    setExternalQueue(tagged);
    setExternalQueueIndex(0);
    playExternalMedia(tagged[0]);
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
      let nextIndex = externalQueueIndex + direction;
      if (shuffle && direction === 1 && externalQueue.length > 1) {
        const unplayed = externalQueue
          .map((_, i) => i)
          .filter((i) => i > externalQueueIndex);
        if (unplayed.length > 0) {
          nextIndex = unplayed[Math.floor(Math.random() * unplayed.length)]!;
        } else {
          nextIndex = Math.floor(Math.random() * externalQueue.length);
        }
      }
      const nextMedia = externalQueue[nextIndex];
      if (!nextMedia) {
        if (repeat === 'all' && externalQueue.length > 0) {
          nextIndex = shuffle ? Math.floor(Math.random() * externalQueue.length) : 0;
          const firstMedia = externalQueue[nextIndex];
          setExternalQueueIndex(nextIndex);
          setExternalMedia(firstMedia);
          setExternalPlaying(true);
          setProgress(0);
          progressRef.current = 0;
          setDuration(0);
          setBuffering(true);
          return;
        }
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
    const queueList = mixes.flatMap((mix) => mix.tracks.map((track) => ({ mix, track })));
    const currentIndex = queueList.findIndex(({ track }) => track.id === nowPlaying.track.id);
    if (currentIndex < 0 || queueList.length === 0) return;
    let nextIndex = (currentIndex + direction + queueList.length) % queueList.length;
    if (shuffle && direction === 1 && queueList.length > 1) {
      nextIndex = Math.floor(Math.random() * queueList.length);
    }
    const next = queueList[nextIndex];
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
    const playerInst = audioRef.current?.getInternalPlayer();
    if (!(playerInst instanceof HTMLVideoElement) || !playerInst.requestPictureInPicture) {
      setError('Picture-in-Picture is not available for this video.');
      return;
    }
    try {
      if (document.pictureInPictureElement === playerInst) await document.exitPictureInPicture();
      else await playerInst.requestPictureInPicture();
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
    shuffle,
    repeat,
    toggleShuffle,
    cycleRepeat,
    queue,
    addToQueue,
    removeFromQueue,
    clearQueue,
    reorderQueue,
    timerMode,
    timeLeftMinutes,
    setTimer,
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
      <OfflineBanner />
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
            <div className="workspace-search-container">
              <button
                type="button"
                className="workspace-search"
                onClick={() => openPalette()}
                aria-label="Open command palette"
                style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--tp-line)', background: 'color-mix(in oklab, var(--tp-surf) 72%, transparent)' }}
              >
                <Icon name="search" size={19} />
                <span style={{ flex: 1, color: 'var(--tp-mute)', fontSize: '13px' }}>Search songs, stories, people…</span>
                <kbd>{isMac ? '⌘K' : 'Ctrl+K'}</kbd>
              </button>
            </div>
            <NotificationBell />
            <UserMenu />
          </header> : null}

          <main className="workspace-content route-outlet" key={location.pathname}>
            {children ?? <Outlet />}
          </main>
        </div>

        <Suspense fallback={null}>
          <CommandPalette isOpen={isPaletteOpen} onClose={closePalette} />
        </Suspense>

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
                  onEnded={() => {
                    if (repeat === 'one') {
                      seek(0);
                      setExternalPlaying(true);
                    } else if (externalQueueIndex < externalQueue.length - 1) {
                      let nextIdx = externalQueueIndex + 1;
                      if (shuffle) {
                        const unplayed = externalQueue
                          .map((_, i) => i)
                          .filter((i) => i > externalQueueIndex);
                        if (unplayed.length > 0) {
                          nextIdx = unplayed[Math.floor(Math.random() * unplayed.length)]!;
                        }
                      }
                      setExternalQueueIndex(nextIdx);
                      setExternalMedia(externalQueue[nextIdx]);
                      setExternalPlaying(true);
                    } else if (repeat === 'all' && externalQueue.length > 0) {
                      const nextIdx = shuffle ? Math.floor(Math.random() * externalQueue.length) : 0;
                      setExternalQueueIndex(nextIdx);
                      setExternalMedia(externalQueue[nextIdx]);
                      setExternalPlaying(true);
                    } else {
                      setExternalPlaying(false);
                    }
                  }}
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
                  onEnded={() => {
                    if (repeat === 'one') {
                      seek(0);
                      setExternalPlaying(true);
                    } else if (externalQueueIndex < externalQueue.length - 1) {
                      let nextIdx = externalQueueIndex + 1;
                      if (shuffle) {
                        const unplayed = externalQueue
                          .map((_, i) => i)
                          .filter((i) => i > externalQueueIndex);
                        if (unplayed.length > 0) {
                          nextIdx = unplayed[Math.floor(Math.random() * unplayed.length)]!;
                        }
                      }
                      setExternalQueueIndex(nextIdx);
                      setExternalMedia(externalQueue[nextIdx]);
                      setExternalPlaying(true);
                    } else if (repeat === 'all' && externalQueue.length > 0) {
                      const nextIdx = shuffle ? Math.floor(Math.random() * externalQueue.length) : 0;
                      setExternalQueueIndex(nextIdx);
                      setExternalMedia(externalQueue[nextIdx]);
                      setExternalPlaying(true);
                    } else {
                      setExternalPlaying(false);
                    }
                  }}
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
                  onEnded={() => {
                    if (repeat === 'one') {
                      seek(0);
                      setExternalPlaying(true);
                    } else if (externalQueueIndex < externalQueue.length - 1) {
                      let nextIdx = externalQueueIndex + 1;
                      if (shuffle) {
                        const unplayed = externalQueue
                          .map((_, i) => i)
                          .filter((i) => i > externalQueueIndex);
                        if (unplayed.length > 0) {
                          nextIdx = unplayed[Math.floor(Math.random() * unplayed.length)]!;
                        }
                      }
                      setExternalQueueIndex(nextIdx);
                      setExternalMedia(externalQueue[nextIdx]);
                      setExternalPlaying(true);
                    } else if (repeat === 'all' && externalQueue.length > 0) {
                      const nextIdx = shuffle ? Math.floor(Math.random() * externalQueue.length) : 0;
                      setExternalQueueIndex(nextIdx);
                      setExternalMedia(externalQueue[nextIdx]);
                      setExternalPlaying(true);
                    } else {
                      setExternalPlaying(false);
                    }
                  }}
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
          onEnded={() => {
            if (repeat === 'one') {
              seek(0);
              if (externalMedia) setExternalPlaying(true);
            } else if (externalMedia) {
              if (externalQueueIndex < externalQueue.length - 1) {
                let nextIdx = externalQueueIndex + 1;
                if (shuffle) {
                  const unplayed = externalQueue
                    .map((_, i) => i)
                    .filter((i) => i > externalQueueIndex);
                  if (unplayed.length > 0) {
                    nextIdx = unplayed[Math.floor(Math.random() * unplayed.length)]!;
                  }
                }
                setExternalQueueIndex(nextIdx);
                setExternalMedia(externalQueue[nextIdx]);
                setExternalPlaying(true);
              } else if (repeat === 'all' && externalQueue.length > 0) {
                const nextIdx = shuffle ? Math.floor(Math.random() * externalQueue.length) : 0;
                setExternalQueueIndex(nextIdx);
                setExternalMedia(externalQueue[nextIdx]);
                setExternalPlaying(true);
              } else {
                setExternalPlaying(false);
              }
            } else {
              void skip(1);
            }
          }}
          onError={() => {
            setBuffering(false);
            setError('This audio could not be loaded. Check your connection or try another preview.');
          }}
          config={{ file: { forceAudio: true, forceDisableHls: true, forceDASH: false } }}
          />
        </Suspense>
        ) : null}
        {sleepToast && <div role="status" aria-live="polite" className="sr-only">{sleepToast}</div>}
        <PlayerDock />
      </div>
    </PlayerContext.Provider>
  );
}
