import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AppShell } from '../../components/AppShell';
import { CoverArt } from '../../components/CoverArt';
import { Icon } from '../../components/Icon';
import { AddToPlaylistButton } from '../../components/AddToPlaylistButton';
import { CommentThread } from '../../components/CommentThread';
import { PageBar } from '../../components/PageBar';
import { TabBar } from '../../components/TabBar';
import { fetchMediaLibrary, saveMedia } from '../../lib/mediaApi';
import type {
  PodcastEpisode,
  PodcastPlayerState,
  PodcastShow,
} from '../../lib/podcastApi';
import {
  fetchListenLater,
  fetchPodcastEpisode,
  fetchPodcastEpisodes,
  fetchPodcastPlayer,
  fetchPodcastShow,
  fetchPodcastShows,
  removePodcastEpisode,
  savePodcastEpisode,
  updatePodcastPlayer,
} from '../../lib/podcastApi';
import { formatClock } from '../../lib/hooks';

const PODCAST_TABS = [
  { to: '/static', label: 'Listen', icon: 'headphones' as const, end: true },
  { to: '/static/shows', label: 'Shows', icon: 'library' as const },
  { to: '/static/saved', label: 'Later', icon: 'bookmark' as const },
];

const DEMO_AUDIO_URL = 'https://discoveryprovider.audius.co/v1/tracks/95wro/stream?app_name=Nocturne';

function PodcastFrame({ children }: { children: ReactNode }) {
  return (
    <AppShell
      bar={
        <PageBar
          title="static & sincerity"
          eyebrow="BEDROOM POP · STORIES AFTER DARK"
          actions={<Link to="/static/saved" className="iconbtn" aria-label="Listen later"><Icon name="bookmark" size={18} /></Link>}
        />
      }
      nav={<TabBar items={PODCAST_TABS} fab={{ to: '/static/player', label: 'Open episode player', icon: 'play' }} />}
    >
      <div className="podcast-content">{children}</div>
    </AppShell>
  );
}

function PodcastError({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="music-error" role="alert">
      <span>{message}</span>
      {retry ? <button type="button" className="btn btn--ghost btn--sm" onClick={retry}>Try again</button> : null}
    </div>
  );
}

function PodcastHeading({ eyebrow, title, to, link = 'See all' }: { eyebrow: string; title: string; to?: string; link?: string }) {
  return (
    <div className="podcast-heading">
      <div><p className="t-eyebrow">{eyebrow}</p><h2 className="t-h2">{title}</h2></div>
      {to ? <Link to={to} className="music-text-link">{link}<Icon name="arrow-right" size={15} /></Link> : null}
    </div>
  );
}

function EpisodeCard({
  episode,
  onPlay,
  onToggleSave,
}: {
  episode: PodcastEpisode;
  onPlay: (episode: PodcastEpisode) => void;
  onToggleSave: (episode: PodcastEpisode) => void;
}) {
  return (
    <article className="podcast-episode">
      <button type="button" className="podcast-episode__art" aria-label={`Play ${episode.title}`} onClick={() => onPlay(episode)}>
        <CoverArt seed={episode.showArt} ratio="fill" />
        <span className="podcast-episode__play"><Icon name="play" size={17} /></span>
      </button>
      <div className="podcast-episode__body">
        <Link to={`/static/shows/${episode.showId}`} className="t-eyebrow podcast-episode__show">
          {episode.showTitle} · {episode.published}
        </Link>
        <h3 className="podcast-episode__title">
          <Link to={`/static/episode/${episode.id}`}>{episode.title}</Link>
        </h3>
        <p className="podcast-episode__summary">{episode.summary}</p>
        <div className="podcast-episode__meta">
          <span className="t-mono">{formatClock(episode.seconds)}</span>
          <AddToPlaylistButton
            label={`Add ${episode.title} to a playlist`}
            ensureMediaSaved={async () => {
              const result = await saveMedia({
                type: 'podcast',
                provider: 'itunes',
                externalId: episode.id,
                title: episode.title,
                artist: episode.showTitle,
                thumbnailUrl: null,
                streamUrl: episode.audioUrl,
                externalUrl: null,
                mediaType: 'podcast',
                durationSeconds: episode.seconds,
              });
              if (!result.item.id) throw new Error('The episode was saved, but its library ID was not returned.');
              return result.item.id;
            }}
          />
          <button
            type="button"
            className={`podcast-save${episode.isSaved ? ' is-saved' : ''}`}
            aria-pressed={episode.isSaved}
            aria-label={episode.isSaved ? `Remove ${episode.title} from Listen Later` : `Save ${episode.title} for later`}
            onClick={() => onToggleSave(episode)}
          >
            <Icon name={episode.isSaved ? 'bookmark-filled' : 'bookmark'} size={16} />
            {episode.isSaved ? 'Saved' : 'Listen later'}
          </button>
        </div>
      </div>
    </article>
  );
}

function usePodcastActions() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function playEpisode(episode: PodcastEpisode) {
    setError('');
    try {
      await updatePodcastPlayer(episode.id, true, 0);
      navigate('/static/player');
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : 'Could not open this episode.');
    }
  }

  async function toggleSaved(episode: PodcastEpisode) {
    setError('');
    try {
      if (episode.isSaved) await removePodcastEpisode(episode.id);
      else await savePodcastEpisode(episode.id);
      return !episode.isSaved;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update Listen Later.');
      return null;
    }
  }

  return { error, setError, playEpisode, toggleSaved };
}

export function PodcastHome() {
  const [shows, setShows] = useState<PodcastShow[]>([]);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [error, setError] = useState('');
  const { error: actionError, playEpisode, toggleSaved } = usePodcastActions();

  async function load() {
    setError('');
    try {
      const [loadedShows, loadedEpisodes] = await Promise.all([fetchPodcastShows(), fetchPodcastEpisodes()]);
      setShows(loadedShows);
      setEpisodes(loadedEpisodes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load podcast episodes.');
    }
  }

  useEffect(() => { void load(); }, []);

  async function onToggleSave(episode: PodcastEpisode) {
    const isSaved = await toggleSaved(episode);
    if (isSaved !== null) {
      setEpisodes((list) => list.map((item) => item.id === episode.id ? { ...item, isSaved } : item));
    }
  }

  const newest = episodes[0];

  return (
    <PodcastFrame>
      {error ? <PodcastError message={error} retry={() => void load()} /> : null}
      {actionError ? <PodcastError message={actionError} /> : null}
      <header className="podcast-intro">
        <p className="t-eyebrow">A voice in the next room</p>
        <h1 className="t-h1">Good stories<br /><em>keep you company.</em></h1>
        <p className="t-body">Conversations, songs, and soft voices for the hour you’re still awake.</p>
      </header>
      {newest ? (
        <section className="podcast-featured">
          <div className="podcast-featured__art"><CoverArt seed={newest.showArt} ratio="fill" /></div>
          <div className="podcast-featured__body">
            <p className="t-eyebrow">THE LATEST LISTEN · {newest.showTitle}</p>
            <h2>{newest.title}</h2>
            <p className="t-small t-mute">{newest.summary}</p>
            <button className="btn btn--primary podcast-featured__play" type="button" onClick={() => void playEpisode(newest)}>
              <Icon name="play" size={16} /> Listen to the episode
            </button>
          </div>
        </section>
      ) : !error ? <p className="t-small t-mute">Finding a story for tonight…</p> : null}
      <section className="podcast-section">
        <PodcastHeading eyebrow="One lamp, no edit" title="A show to sit with" to="/static/shows" />
        <div className="podcast-show-rail">
          {shows.map((show) => (
            <Link to={`/static/shows/${show.id}`} className="podcast-show-card" key={show.id}>
              <span className="podcast-show-card__art"><CoverArt seed={show.art} ratio="square" /></span>
              <span className="podcast-show-card__title">{show.title}</span>
              <span className="t-small t-mute">{show.host} · {show.episodeCount} episodes</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="podcast-section">
        <PodcastHeading eyebrow="Put the kettle on" title="A little more to hear" />
        <div className="podcast-episode-list">
          {episodes.slice(1, 5).map((episode) => (
            <EpisodeCard key={episode.id} episode={episode} onPlay={playEpisode} onToggleSave={onToggleSave} />
          ))}
        </div>
      </section>
      <Link to="/static/saved" className="podcast-listen-later-callout">
        <Icon name="bookmark" size={19} />
        <span><strong>Your little listening pile</strong><small>Saved episodes stay here for later.</small></span>
        <Icon name="chevron-right" size={18} />
      </Link>
    </PodcastFrame>
  );
}

export function PodcastShows() {
  const [shows, setShows] = useState<PodcastShow[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    void fetchPodcastShows().then(setShows).catch((loadError: unknown) =>
      setError(loadError instanceof Error ? loadError.message : 'Could not load shows.'));
  }, []);
  return (
    <PodcastFrame>
      {error ? <PodcastError message={error} /> : null}
      <header className="podcast-intro">
        <p className="t-eyebrow">Different rooms, different voices</p>
        <h1 className="t-h1">Find a show<br /><em>that feels like yours.</em></h1>
      </header>
      <div className="podcast-show-list">
        {shows.map((show) => (
          <Link className="podcast-show-row" to={`/static/shows/${show.id}`} key={show.id}>
            <span className="podcast-show-row__art"><CoverArt seed={show.art} ratio="square" /></span>
            <span className="podcast-show-row__body">
              <span className="t-eyebrow">{show.cadence}</span>
              <strong>{show.title}</strong>
              <span className="t-small t-mute">with {show.host} · {show.episodeCount} episodes</span>
              <span className="podcast-show-row__blurb">{show.blurb}</span>
            </span>
            <Icon name="chevron-right" size={19} />
          </Link>
        ))}
      </div>
    </PodcastFrame>
  );
}

export function PodcastShowPage() {
  const { showId = '' } = useParams();
  const [show, setShow] = useState<PodcastShow | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [error, setError] = useState('');
  const { error: actionError, playEpisode, toggleSaved } = usePodcastActions();

  async function load() {
    try {
      const result = await fetchPodcastShow(showId);
      setShow(result.show);
      setEpisodes(result.episodes);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this show.');
    }
  }
  useEffect(() => { void load(); }, [showId]);

  async function onToggleSave(episode: PodcastEpisode) {
    const isSaved = await toggleSaved(episode);
    if (isSaved !== null) setEpisodes((items) => items.map((item) => item.id === episode.id ? { ...item, isSaved } : item));
  }

  return (
    <PodcastFrame>
      <Link to="/static/shows" className="music-player__back"><Icon name="chevron-left" size={18} /> All shows</Link>
      {error ? <PodcastError message={error} retry={() => void load()} /> : null}
      {actionError ? <PodcastError message={actionError} /> : null}
      {show ? (
        <>
          <header className="podcast-show-hero">
            <div className="podcast-show-hero__art"><CoverArt seed={show.art} ratio="square" /></div>
            <div className="podcast-show-hero__body">
              <p className="t-eyebrow">{show.cadence} · {show.episodeCount} episodes</p>
              <h1 className="t-h1">{show.title}</h1>
              <p className="t-small t-mute">Hosted by {show.host}</p>
              <p className="t-body">{show.blurb}</p>
            </div>
          </header>
          <section className="podcast-section">
            <PodcastHeading eyebrow="Made with the lights low" title="Episodes" />
            <div className="podcast-episode-list">
              {episodes.map((episode) => <EpisodeCard key={episode.id} episode={episode} onPlay={playEpisode} onToggleSave={onToggleSave} />)}
            </div>
          </section>
        </>
      ) : !error ? <p className="t-small t-mute">Opening the show…</p> : null}
    </PodcastFrame>
  );
}

export function PodcastSaved() {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [error, setError] = useState('');
  const { error: actionError, playEpisode, toggleSaved } = usePodcastActions();

  async function load() {
    try {
      setEpisodes(await fetchListenLater());
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your saved episodes.');
    }
  }
  useEffect(() => { void load(); }, []);
  async function onToggleSave(episode: PodcastEpisode) {
    const isSaved = await toggleSaved(episode);
    if (isSaved !== null) setEpisodes((items) => items.filter((item) => item.id !== episode.id));
  }

  return (
    <PodcastFrame>
      {error ? <PodcastError message={error} retry={() => void load()} /> : null}
      {actionError ? <PodcastError message={actionError} /> : null}
      <header className="podcast-intro">
        <p className="t-eyebrow">Whenever you’re ready</p>
        <h1 className="t-h1">Listen<br /><em>when the room is quiet.</em></h1>
      </header>
      <section className="podcast-section">
        <PodcastHeading eyebrow={`${episodes.length} kept for later`} title="Your listening pile" />
        {episodes.length ? (
          <div className="podcast-episode-list">
            {episodes.map((episode) => <EpisodeCard key={episode.id} episode={episode} onPlay={playEpisode} onToggleSave={onToggleSave} />)}
          </div>
        ) : !error ? (
          <div className="podcast-empty">
            <Icon name="bookmark" size={25} />
            <p className="t-serif-italic">Nothing saved yet. That’s alright; the night is long.</p>
            <Link to="/static" className="btn btn--ghost btn--sm">Find an episode</Link>
          </div>
        ) : null}
      </section>
    </PodcastFrame>
  );
}

export function PodcastEpisodePage() {
  const { episodeId = '' } = useParams();
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [error, setError] = useState('');
  const { error: actionError, playEpisode, toggleSaved } = usePodcastActions();
  const [mediaLibraryId, setMediaLibraryId] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState('');
  useEffect(() => {
    let active = true;
    void fetchPodcastEpisode(episodeId).then((loaded) => {
      if (active) setEpisode(loaded);
      return fetchMediaLibrary().then((items) => {
        const existing = items.find((item) => item.provider === 'itunes' && item.externalId === loaded.id);
        if (active && existing?.id) setMediaLibraryId(existing.id);
      }).catch((loadError: unknown) => {
        console.warn('Could not check saved episode status:', loadError);
      });
    }).catch((loadError: unknown) =>
      setError(loadError instanceof Error ? loadError.message : 'Could not load this episode.'));
    return () => { active = false; };
  }, [episodeId]);

  async function onToggleSave() {
    if (!episode) return;
    const isSaved = await toggleSaved(episode);
    if (isSaved !== null) setEpisode({ ...episode, isSaved });
  }

  async function saveForComments() {
    if (!episode) return;
    setLibraryError('');
    try {
      const result = await saveMedia({
        type: 'podcast',
        provider: 'itunes',
        externalId: episode.id,
        title: episode.title,
        artist: episode.showTitle,
        thumbnailUrl: null,
        streamUrl: episode.audioUrl,
        externalUrl: null,
        mediaType: 'podcast',
        durationSeconds: episode.seconds,
      });
      if (!result.item.id) throw new Error('The episode was saved, but its library ID was not returned.');
      setMediaLibraryId(result.item.id);
    } catch (saveError) {
      setLibraryError(saveError instanceof Error ? saveError.message : 'Could not save this episode.');
    }
  }

  return (
    <PodcastFrame>
      {error ? <PodcastError message={error} /> : null}
      {actionError ? <PodcastError message={actionError} /> : null}
      {episode ? (
        <>
        <article className="podcast-episode-detail">
          <div className="podcast-episode-detail__art"><CoverArt seed={episode.showArt} ratio="square" /></div>
          <Link to={`/static/shows/${episode.showId}`} className="t-eyebrow music-text-link">{episode.showTitle} <Icon name="arrow-right" size={14} /></Link>
          <h1 className="t-h1">{episode.title}</h1>
          <p className="t-small t-mute">Season {episode.season} · Episode {episode.number} · {episode.published} · {formatClock(episode.seconds)}</p>
          <p className="t-body">{episode.summary}</p>
          <div className="podcast-episode-detail__actions">
            <button type="button" className="btn btn--primary" onClick={() => void playEpisode(episode)}><Icon name="play" size={16} /> Play episode</button>
            <button type="button" className="btn btn--ghost" aria-pressed={episode.isSaved} onClick={() => void onToggleSave()}>
              <Icon name={episode.isSaved ? 'bookmark-filled' : 'bookmark'} size={16} /> {episode.isSaved ? 'Saved for later' : 'Listen later'}
            </button>
            <AddToPlaylistButton
              label={`Add ${episode.title} to a playlist`}
              ensureMediaSaved={async () => {
                const result = await saveMedia({
                  type: 'podcast',
                  provider: 'itunes',
                  externalId: episode.id,
                  title: episode.title,
                  artist: episode.showTitle,
                  thumbnailUrl: null,
                  streamUrl: episode.audioUrl,
                  externalUrl: null,
                  mediaType: 'podcast',
                  durationSeconds: episode.seconds,
                });
                if (!result.item.id) throw new Error('The episode was saved, but its library ID was not returned.');
                return result.item.id;
              }}
            />
          </div>
        </article>
        {mediaLibraryId ? (
          <CommentThread mediaLibraryId={mediaLibraryId} />
        ) : (
          <section className="comment-thread">
            <h2>Notes from the room</h2>
            <p>Save this episode to your library to open its conversation.</p>
            {libraryError ? <p className="social-inline-error" role="alert">{libraryError}</p> : null}
            <button className="social-button" type="button" onClick={() => void saveForComments()}>Save to library</button>
          </section>
        )}
        </>
      ) : !error ? <p className="t-small t-mute">Opening the episode…</p> : null}
    </PodcastFrame>
  );
}

export function PodcastPlayer() {
  const [state, setState] = useState<PodcastPlayerState | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekValue = useRef(0);

  async function load() {
    try {
      const loaded = await fetchPodcastPlayer();
      if (loaded.isPlaying) {
        const paused = await updatePodcastPlayer(loaded.episodeId, false, loaded.progressSeconds);
        setState(paused);
        setProgress(paused.progressSeconds);
        seekValue.current = paused.progressSeconds;
      } else {
        setState(loaded);
        setProgress(loaded.progressSeconds);
        seekValue.current = loaded.progressSeconds;
      }
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not open the podcast player.');
    }
  }
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (audioRef.current && state) audioRef.current.currentTime = state.progressSeconds;
  }, [state?.episodeId]);

  async function persist(playing: boolean, seconds = audioRef.current?.currentTime ?? progress) {
    if (!state) return;
    try {
      const updated = await updatePodcastPlayer(state.episodeId, playing, Math.floor(seconds));
      setState(updated);
      setProgress(seconds);
      seekValue.current = Math.floor(seconds);
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save playback progress.');
    }
  }

  async function toggle() {
    if (!state || !audioRef.current) return;
    if (state.isPlaying) {
      audioRef.current.pause();
      await persist(false, audioRef.current.currentTime);
    } else {
      try {
        await audioRef.current.play();
        await persist(true, audioRef.current.currentTime);
      } catch (playError) {
        setError(playError instanceof Error ? playError.message : 'Audio playback failed.');
      }
    }
  }

  return (
    <PodcastFrame>
      {error ? <PodcastError message={error} retry={() => void load()} /> : null}
      {state ? (
        <section className="podcast-player">
          <audio
            ref={audioRef}
            src={state.episode.audioUrl || DEMO_AUDIO_URL}
            preload="metadata"
            onTimeUpdate={(event) => {
              setProgress(event.currentTarget.currentTime);
              seekValue.current = Math.floor(event.currentTarget.currentTime);
            }}
            onError={() => setError('The demo audio could not be loaded. Check your connection and try again.')}
          />
          <Link to={`/static/episode/${state.episodeId}`} className="music-player__back"><Icon name="chevron-left" size={18} /> Episode details</Link>
          <div className="podcast-player__art"><CoverArt seed={state.episode.showArt} ratio="square" /></div>
          <p className="t-eyebrow">{state.episode.showTitle} · WITH {state.episode.showHost.toUpperCase()}</p>
          <h1 className="podcast-player__title">{state.episode.title}</h1>
          <p className="t-small t-mute">{state.episode.summary}</p>
          <label className="sr-only" htmlFor="podcast-progress">Episode progress</label>
          <input
            id="podcast-progress"
            className="music-player__seek"
            type="range"
            min="0"
            max={state.episode.seconds}
            value={progress}
            onChange={(event) => {
              const next = Number(event.target.value);
              setProgress(next);
              seekValue.current = next;
              if (audioRef.current) audioRef.current.currentTime = next;
            }}
            onPointerUp={() => void persist(state.isPlaying, seekValue.current)}
            onKeyUp={() => void persist(state.isPlaying, seekValue.current)}
            style={{ '--seek-progress': `${(progress / state.episode.seconds) * 100}%` } as CSSProperties}
          />
          <div className="music-player__times t-mono"><span>{formatClock(progress)}</span><span>{formatClock(state.episode.seconds)}</span></div>
          <button className="music-player__toggle podcast-player__toggle" type="button" onClick={() => void toggle()} aria-label={state.isPlaying ? 'Pause episode' : 'Play episode'}>
            <Icon name={state.isPlaying ? 'pause' : 'play'} size={24} />
          </button>
          <p className="t-small t-mute center">Demo episode audio uses a public sample MP3.</p>
        </section>
      ) : !error ? <p className="t-small t-mute">Tuning the radio…</p> : null}
    </PodcastFrame>
  );
}
