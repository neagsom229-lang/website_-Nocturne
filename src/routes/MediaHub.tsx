import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { useWorkspacePlayer } from '../components/WorkspaceShell';
import type { LibraryMediaType, MediaItem, MediaType } from '../lib/mediaApi';
import { deleteLibraryItem, fetchMediaLibrary, saveMedia, searchMedia, searchVideoPodcasts } from '../lib/mediaApi';
import { searchMovies, type MovieSummary } from '../lib/moviesApi';

const MEDIA_TABS: { type: MediaType | 'movie'; label: string }[] = [
  { type: 'audio', label: 'Music' },
  { type: 'podcast', label: 'Podcasts' },
  { type: 'movie', label: 'Movies' },
  { type: 'video_podcast', label: 'Video' },
  { type: 'video', label: 'Music Videos' },
];

const LIBRARY_FILTERS: { type: 'all' | LibraryMediaType | 'video'; label: string }[] = [
  { type: 'all', label: 'All' },
  { type: 'music', label: 'Music' },
  { type: 'podcast', label: 'Podcasts' },
  { type: 'movie', label: 'Movies' },
  { type: 'video', label: 'Video' },
];

function MediaSkeletons() {
  return (
    <div className="media-grid" role="status" aria-label="Loading media">
      {Array.from({ length: 6 }, (_, index) => (
        <article className="media-skeleton" key={index}>
          <div className="media-skeleton__art" />
          <div className="media-skeleton__line media-skeleton__line--title" />
          <div className="media-skeleton__line" />
          <div className="media-skeleton__actions">
            <span />
            <span />
          </div>
        </article>
      ))}
    </div>
  );
}

function MediaCard({
  item,
  saved,
  saving,
  deleting,
  onPlay,
  onSave,
  onDelete,
  onCopy,
  copied,
}: {
  item: MediaItem;
  saved?: boolean;
  saving?: boolean;
  deleting?: boolean;
  onPlay: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <article className="media-card">
      <button type="button" className="media-card__art" onClick={onPlay} aria-label={`Play ${item.title}`}>
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <span className="media-card__fallback"><Icon name={item.type === 'video' ? 'play-circle' : 'headphones'} size={28} /></span>
        )}
        <span className="media-card__play"><Icon name="play" size={17} /></span>
        <span className="media-card__type">
          {item.mediaType === 'video_podcast'
            ? 'VIDEO PODCAST'
            : item.mediaType === 'movie' || item.mediaType === 'tv'
              ? item.mediaType.toUpperCase()
              : item.mediaType === 'music'
                ? 'MUSIC'
                : item.mediaType === 'podcast'
                  ? 'PODCAST'
                  : item.type === 'audio' ? 'AUDIO PREVIEW' : item.type.toUpperCase()}
        </span>
      </button>
      <div className="media-card__body">
        <h2>{item.title}</h2>
        <p>{item.artist || (item.provider === 'youtube' ? 'YouTube' : item.provider === 'audius' ? 'Audius' : 'iTunes')}</p>
        <div className="media-card__actions">
          {onSave ? (
            <button className="btn btn--primary btn--sm" type="button" onClick={onSave} disabled={saved || saving}>
              <Icon name={saved ? 'check' : 'bookmark'} size={15} />
              {saved ? 'Saved' : saving ? 'Saving…' : 'Save to Library'}
            </button>
          ) : null}
          {onDelete ? (
            <button className="btn btn--ghost btn--sm media-card__remove" type="button" onClick={onDelete} disabled={deleting}>
              <Icon name="trash" size={15} /> Remove
            </button>
          ) : null}
          {onCopy ? (
            <button className="btn btn--ghost btn--sm media-card__copy" type="button" onClick={onCopy}>
              <Icon name={copied ? 'check' : 'share'} size={15} /> {copied ? 'Copied' : 'Copy Link'}
            </button>
          ) : null}
          <button className="media-card__play-link" type="button" onClick={onPlay}>
            Play <Icon name="arrow-right" size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const requestedType = params.get('type');
  const activeType: MediaType | 'movie' = MEDIA_TABS.some((tab) => tab.type === requestedType)
    ? requestedType as MediaType | 'movie'
    : 'video';
  const [results, setResults] = useState<MediaItem[]>([]);
  const [movieResults, setMovieResults] = useState<MovieSummary[]>([]);
  const [videoHint, setVideoHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savingId, setSavingId] = useState('');
  const { playExternalMedia } = useWorkspacePlayer();

  useEffect(() => {
    let active = true;
    if (!query) {
      setResults([]);
      setMovieResults([]);
      setVideoHint('');
      setLoading(false);
      setError('');
      return () => { active = false; };
    }
    setLoading(true);
    setError('');
    setVideoHint('');
    if (activeType === 'movie') {
      setResults([]);
      void searchMovies(query)
        .then((items) => { if (active) setMovieResults(items); })
        .catch((searchError: unknown) => {
          if (active) setError(searchError instanceof Error ? searchError.message : 'Movie search could not be completed.');
        })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }
    setMovieResults([]);
    if (activeType === 'video_podcast') {
      void searchVideoPodcasts(query)
        .then(({ items, hint }) => {
          if (active) {
            setResults(items);
            setVideoHint(hint ?? '');
          }
        })
        .catch((searchError: unknown) => {
          if (active) setError(searchError instanceof Error ? searchError.message : 'Video podcast search could not be completed.');
        })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }
    const search = searchMedia(query, activeType);
    void search
      .then((items) => { if (active) setResults(items); })
      .catch((searchError: unknown) => {
        if (active) setError(searchError instanceof Error ? searchError.message : 'Search could not be completed.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, activeType]);

  function selectType(type: MediaType | 'movie') {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('type', type);
      return next;
    });
  }

  async function save(item: MediaItem) {
    const key = `${item.provider}:${item.externalId}`;
    setSavingId(key);
    setError('');
    try {
      await saveMedia(item);
      setSavedIds((ids) => ids.includes(key) ? ids : [...ids, key]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this media.');
    } finally {
      setSavingId('');
    }
  }

  return (
    <section className="media-page">
      <header className="media-page__heading">
        <p className="t-eyebrow">THE WORLD IS A VERY BIG LISTENING ROOM</p>
        <h1 className="t-h1">Find your next<br /><em>keep.</em></h1>
        <p className="t-body">Search music videos, late-night conversations, and songs worth bringing home.</p>
      </header>
      <div className="media-tabs" role="tablist" aria-label="Search media type">
        {MEDIA_TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            role="tab"
            aria-selected={activeType === tab.type}
            className={activeType === tab.type ? 'is-active' : ''}
            onClick={() => selectType(tab.type)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {query ? <p className="media-query">Results for <strong>“{query}”</strong></p> : null}
      {error ? <div className="music-error" role="alert">{error}</div> : null}
      {loading ? <MediaSkeletons /> : query ? (
        activeType === 'movie' ? (
          movieResults.length ? (
            <div className="media-grid">
              {movieResults.map((movie) => (
                <article className="media-card movie-card" key={movie.tmdb_id}>
                  <Link to={`/movies/${movie.tmdb_id}`} className="media-card__art" aria-label={`View ${movie.title}`}>
                    {movie.poster_url ? <img src={movie.poster_url} alt="" loading="lazy" /> : <span className="media-card__fallback"><Icon name="play-circle" size={28} /></span>}
                    <span className="media-card__type">MOVIE</span>
                    {movie.rating !== null ? <span className="movie-card__rating">★ {movie.rating.toFixed(1)}</span> : null}
                  </Link>
                  <div className="media-card__body">
                    <h2><Link to={`/movies/${movie.tmdb_id}`}>{movie.title}</Link></h2>
                    <p>{movie.year ?? 'Release date unavailable'}</p>
                    <Link className="media-card__play-link" to={`/movies/${movie.tmdb_id}`}>View details <Icon name="arrow-right" size={14} /></Link>
                  </div>
                </article>
              ))}
            </div>
          ) : !error ? (
            <EmptyState icon="search" title="No movies found." body="Try another title or switch to a different media type." />
          ) : null
        ) : (
          results.length ? (
            <div className="media-grid">
              {results.map((item) => (
                <MediaCard
                  key={`${item.provider}-${item.externalId}`}
                  item={item}
                  saved={savedIds.includes(`${item.provider}:${item.externalId}`)}
                  saving={savingId === `${item.provider}:${item.externalId}`}
                  onPlay={() => playExternalMedia(item)}
                  onSave={() => void save(item)}
                />
              ))}
            </div>
          ) : !error ? (
            <EmptyState
              icon="search"
              title="Nothing came through this time."
              body={videoHint || 'Try a different search, or switch the kind of media you’re looking for.'}
            />
          ) : null
        )
      ) : (
        <EmptyState
          icon="headphones"
          title="A little room for discovery."
          body="Use the search bar above to find videos, podcasts, and song previews."
        />
      )}
    </section>
  );
}

export function MusicLibraryPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [activeFilter, setActiveFilter] = useState<(typeof LIBRARY_FILTERS)[number]['type']>('all');
  const { playExternalMedia } = useWorkspacePlayer();

  async function loadLibrary() {
    setLoading(true);
    setError('');
    try {
      setItems(await fetchMediaLibrary());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your library.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadLibrary(); }, []);

  const filteredItems = items.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'video') return item.mediaType === 'video_podcast' || item.type === 'video';
    if (activeFilter === 'music') return item.mediaType === 'music' || item.type === 'audio';
    if (activeFilter === 'podcast') return item.mediaType === 'podcast' || item.type === 'podcast';
    return item.mediaType === activeFilter || (activeFilter === 'movie' && item.mediaType === 'tv');
  });

  async function remove(item: MediaItem) {
    if (!item.id) return;
    setDeletingId(item.id);
    setError('');
    try {
      await deleteLibraryItem(item.id);
      setItems((current) => current.filter(({ id }) => id !== item.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not remove this item.');
    } finally {
      setDeletingId('');
    }
  }

  async function copyLink(item: MediaItem) {
    const url = item.externalUrl ?? item.streamUrl;
    setError('');
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(item.id ?? item.externalId);
      window.setTimeout(() => setCopiedId((current) => (
        current === (item.id ?? item.externalId) ? '' : current
      )), 1800);
    } catch (copyError) {
      setError(copyError instanceof Error
        ? `Could not copy the link: ${copyError.message}`
        : 'Could not copy the link. Check your browser clipboard permissions.');
    }
  }

  return (
    <section className="media-page">
      <header className="media-page__heading media-page__heading--compact">
        <p className="t-eyebrow">THE THINGS YOU BROUGHT HOME</p>
        <h1 className="t-h1">My Library</h1>
        <p className="t-body">A collection of songs, stories, and videos to return to.</p>
      </header>
      {error ? <div className="music-error" role="alert">{error}</div> : null}
      <div className="media-tabs" role="tablist" aria-label="Filter library by media type">
        {LIBRARY_FILTERS.map((filter) => (
          <button
            key={filter.type}
            type="button"
            role="tab"
            aria-selected={activeFilter === filter.type}
            className={activeFilter === filter.type ? 'is-active' : ''}
            onClick={() => setActiveFilter(filter.type)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {loading ? <MediaSkeletons /> : filteredItems.length ? (
        <div className="media-grid">
          {filteredItems.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onPlay={() => playExternalMedia(item)}
              deleting={deletingId === item.id}
              onDelete={() => void remove(item)}
              onCopy={() => void copyLink(item)}
              copied={copiedId === (item.id ?? item.externalId)}
            />
          ))}
        </div>
      ) : !error ? (
        <EmptyState
          icon="library"
          title={items.length ? 'Nothing in this shelf yet.' : 'Your library is still a little quiet.'}
          body={items.length ? 'Try another library filter to see more of what you have saved.' : 'Start exploring and save anything you want to keep close.'}
          action={<Link className="btn btn--primary btn--sm" to="/search"><Icon name="search" size={15} /> Start exploring</Link>}
        />
      ) : null}
      {deletingId ? <span className="sr-only" role="status">Updating your library…</span> : null}
    </section>
  );
}

export function WorkspacePlaceholder({
  title,
  eyebrow = 'A NEW CORNER OF YOUR LISTENING ROOM',
  body,
  icon = 'sparkle',
}: {
  title: string;
  eyebrow?: string;
  body: string;
  icon?: 'sparkle' | 'users' | 'settings' | 'moon' | 'trend-up' | 'message';
}) {
  return (
    <section className="workspace-placeholder">
      <span className="workspace-placeholder__art"><Icon name={icon} size={34} /></span>
      <p className="t-eyebrow">{eyebrow}</p>
      <h1 className="t-h1">{title}</h1>
      <p className="t-body">{body}</p>
      <Link to="/tapes" className="btn btn--ghost btn--sm"><Icon name="arrow-left" size={15} /> Back to your room</Link>
    </section>
  );
}
