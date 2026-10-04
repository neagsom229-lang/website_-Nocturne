import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { MediaCard } from '../components/MediaCard';
import { Shelf } from '../components/Shelf';
import { WorkspaceShell, useOptionalWorkspacePlayer } from '../components/WorkspaceShell';
import { Icon } from '../components/Icon';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { useBreadcrumbs } from '../lib/useBreadcrumbs';
import { fetchMovieDetails } from '../lib/moviesApi';
import { getFollowingFeed } from '../lib/socialApi';
import {
  getCommunityPlaylists,
  getForYou,
  getNewReleases,
  getTrending,
  type NewReleases,
  type TrendingFeed,
} from '../lib/discoverApi';
import type { DiscoveryMedia, PublicPlaylistCard } from '../types';

type SectionState<T> = {
  items: T;
  loading: boolean;
  error: boolean;
  retry: () => void;
};

function useSection<T>(load: () => Promise<T>, initial: T, enabled = true): SectionState<T> {
  const [items, setItems] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setLoading(false);
      setError(false);
      return () => { active = false; };
    }
    setLoading(true);
    setError(false);
    void load().then((result) => {
      if (active) setItems(result);
    }).catch((loadError: unknown) => {
      console.error('Discovery section failed to load:', loadError);
      if (active) setError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [load, attempt, enabled]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { items, loading, error, retry };
}

const emptyTrending: TrendingFeed = { movies: [], podcasts: [], music: [] };
const emptyReleases: NewReleases = { movies: [], podcasts: [] };

function DiscoveryHome({ signedIn }: { signedIn: boolean }) {
  const player = useOptionalWorkspacePlayer();
  const navigate = useNavigate();
  const trending = useSection(getTrending, emptyTrending);
  const releases = useSection(getNewReleases, emptyReleases);
  const playlists = useSection(getCommunityPlaylists, [] as PublicPlaylistCard[]);
  const forYou = useSection(getForYou, emptyTrending, signedIn);
  const following = useSection(
    getFollowingFeed,
    { activities: [], hasMore: false },
    signedIn,
  );

  const failedCount = [trending.error, releases.error, playlists.error, forYou.error, following.error].filter(Boolean).length;

  const heroItems = useMemo(() => [
    ...trending.items.movies,
    ...releases.items.podcasts,
    ...trending.items.music,
  ], [trending.items.movies, releases.items.podcasts, trending.items.music]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) return;
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mediaQuery.addEventListener?.('change', onChange);
    return () => mediaQuery.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion || heroPaused || manualPaused || heroItems.length < 2) return;
    const timer = window.setInterval(() => {
      setHeroIndex((index) => (index + 1) % heroItems.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [heroItems.length, heroPaused, manualPaused, reducedMotion]);
  useEffect(() => {
    if (heroIndex >= heroItems.length) setHeroIndex(0);
  }, [heroIndex, heroItems.length]);

  const featured = heroItems[heroIndex];

  function changeHero(direction: -1 | 1) {
    if (!heroItems.length) return;
    setHeroIndex((index) => (index + direction + heroItems.length) % heroItems.length);
  }

  const play = useCallback(async (media: DiscoveryMedia) => {
    if (media.media_type === 'movie') {
      try {
        const details = await fetchMovieDetails(media.id);
        const trailer = details.trailer_url;
        if (!trailer) {
          navigate(`/movies/${encodeURIComponent(media.id)}`);
          return;
        }
        player?.playExternalMedia({
          type: 'video',
          provider: 'tmdb',
          mediaType: 'movie',
          externalId: media.id,
          title: media.title,
          artist: null,
          thumbnailUrl: media.thumbnail_url,
          streamUrl: trailer,
          externalUrl: trailer,
        });
      } catch (error) {
        console.error('Could not load the featured movie trailer:', error);
        navigate(`/movies/${encodeURIComponent(media.id)}`);
      }
      return;
    }
    if (!media.stream_url) return;
    player?.playExternalMedia({
      type: media.media_type === 'podcast' ? 'podcast' : 'audio',
      provider: media.source,
      mediaType: media.media_type === 'video' ? 'video_podcast' : media.media_type,
      externalId: media.id,
      title: media.title,
      artist: media.artist ?? media.channel ?? null,
      thumbnailUrl: media.thumbnail_url,
      streamUrl: media.stream_url,
      externalUrl: media.external_url ?? null,
    });
  }, [navigate, player]);

  const renderMedia = (media: DiscoveryMedia) => (
    <MediaCard media={media} onPlay={(item) => void play(item)} />
  );

  const crumbs = useBreadcrumbs();
  return (
    <div className="discovery-home">
      <Breadcrumbs items={crumbs} />
      {failedCount >= 3 ? (
        <div className="discovery-banner-error" role="alert" style={{ background: 'var(--color-surface-elevated, #222)', padding: '12px 20px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Some sections are temporarily unavailable. We are trying to reconnect.</span>
        </div>
      ) : null}

      <header
        className="discovery-hero"
        aria-roledescription="carousel"
        role="region"
        aria-label="Featured discoveries"
        data-active-index={heroIndex}
        onMouseEnter={() => setHeroPaused(true)}
        onMouseLeave={() => setHeroPaused(false)}
        onFocus={() => setHeroPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHeroPaused(false);
        }}
      >
        {featured?.thumbnail_url ? (
          <img className="discovery-hero__backdrop" src={featured.thumbnail_url} alt="" />
        ) : null}
        <div className="discovery-hero__content">
          <p className="discovery-eyebrow">A little something for tonight</p>
          <h1>{featured?.title ?? 'Find your next favorite.'}</h1>
          <p className="discovery-hero__description">
            {featured?.description?.trim().slice(0, 180)
              || featured?.artist
              || featured?.channel
              || (featured?.release_year ? `A ${featured.release_year} release` : null)}
            {!featured ? 'Movies, podcasts, and music gathered in one quiet place.' : null}
          </p>
          {featured ? (
            <button type="button" className="discovery-hero__cta" onClick={() => void play(featured)}>
              <Icon name="play" size={17} />
              {featured.media_type === 'movie' ? 'Watch trailer' : 'Play now'}
            </button>
          ) : (
            <Link className="discovery-hero__cta" to="/search">
              <Icon name="search" size={17} /> Find something
            </Link>
          )}
        </div>
        <div className="discovery-hero__controls">
          <button type="button" aria-label="Previous slide" disabled={!heroItems.length} onClick={() => changeHero(-1)}>
            <Icon name="skip-back" size={16} />
          </button>
          <button
            type="button"
            aria-label={manualPaused ? 'Play carousel' : 'Pause carousel'}
            aria-pressed={manualPaused}
            onClick={() => setManualPaused((paused) => !paused)}
          >
            <Icon name={manualPaused ? 'play' : 'pause'} size={16} />
          </button>
          <button type="button" aria-label="Next slide" disabled={!heroItems.length} onClick={() => changeHero(1)}>
            <Icon name="skip-forward" size={16} />
          </button>
          <span className="discovery-hero__position" aria-live="polite">
            {heroItems.length ? `${heroIndex + 1} / ${heroItems.length}` : 'No. 01'}
          </span>
        </div>
      </header>

      <div className="discovery-home__heading">
        <div>
          <p className="discovery-eyebrow">THE NOCTURNE STORE</p>
          <h2>Good things to press play on.</h2>
        </div>
        <Link to="/search" className="discovery-home__search"><Icon name="search" size={16} /> Search everything</Link>
      </div>

      {signedIn ? (
        <HomeShelf title="For You" loading={forYou.loading} error={forYou.error} retry={forYou.retry} items={[
          ...forYou.items.movies,
          ...forYou.items.podcasts,
          ...forYou.items.music,
        ]} renderCard={renderMedia} seeAllHref="/library" />
      ) : null}
      {signedIn ? (
        <section className="following-feed" aria-label="From People You Follow">
          <header className="following-feed__heading">
            <div><p className="discovery-eyebrow">YOUR COMMUNITY</p><h2>From People You Follow</h2></div>
          </header>
          {following.error ? (
            <div className="discovery-retry" role="status">
              <span>Couldn't load this section.</span>
              <button type="button" onClick={following.retry}>Retry</button>
            </div>
          ) : following.loading ? (
            <p className="following-feed__empty" role="status">Listening for your people…</p>
          ) : following.items.activities.length ? (
            <div className="following-feed__list">
              {following.items.activities.map((activity) => (
                <article className="following-feed__item" key={`${activity.type}-${activity.id}`}>
                  <Link to={`/u/${encodeURIComponent(activity.userId)}`} className="following-feed__person">
                    {activity.displayName}
                  </Link>
                  <p>
                    {activity.type === 'playlist' ? 'created a playlist' : activity.type === 'like' ? 'liked' : 'left a note on'}
                    {' “'}{activity.title}{'”'}
                    {activity.body ? <span> — {activity.body}</span> : null}
                  </p>
                  <time dateTime={activity.createdAt}>{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(activity.createdAt))}</time>
                  {activity.playlistId ? <Link className="following-feed__open" to={`/playlists/${activity.playlistId}`}>Open playlist</Link> : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="following-feed__empty">
              Follow people to see their activity here. <Link to="/playlists?tab=discover">Explore community playlists</Link> to find listeners.
            </p>
          )}
        </section>
      ) : null}
      <HomeShelf title="Trending Movies" loading={trending.loading} error={trending.error} retry={trending.retry}
        items={trending.items.movies} renderCard={renderMedia} seeAllHref="/movies" />
      <HomeShelf title="New Podcasts" loading={releases.loading} error={releases.error} retry={releases.retry}
        items={releases.items.podcasts} renderCard={renderMedia} seeAllHref="/static" />
      <HomeShelf title="Fresh Music for You" loading={trending.loading} error={trending.error} retry={trending.retry}
        items={trending.items.music} renderCard={renderMedia} seeAllHref="/tapes/discover" />
      <HomeShelf title="Community Playlists" loading={playlists.loading} error={playlists.error} retry={playlists.retry}
        items={playlists.items} seeAllHref="/playlists?tab=discover" renderCard={(playlist) => (
          <Link className="discovery-playlist-card" to={`/playlists/${playlist.id}`}>
            <div className="discovery-playlist-card__cover">
              {playlist.coverUrl
                ? <img src={playlist.coverUrl} alt="" loading="lazy" />
                : <span aria-hidden="true" />}
            </div>
            <strong>{playlist.name}</strong>
            <small>{playlist.itemCount} tracks · {playlist.ownerDisplayName}</small>
          </Link>
        )} />
    </div>
  );
}

function HomeShelf<T>({
  title,
  items,
  renderCard,
  loading,
  error,
  retry,
  seeAllHref,
}: {
  title: string;
  items: T[];
  renderCard: (item: T) => ReactNode;
  loading: boolean;
  error: boolean;
  retry: () => void;
  seeAllHref?: string;
}) {
  if (error) {
    return (
      <section className="discovery-shelf" aria-label={title}>
        <div className="discovery-shelf__heading"><h2>{title}</h2></div>
        <div className="discovery-retry" role="status">
          <span>Couldn't load this section.</span>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      </section>
    );
  }
  return <Shelf title={title} items={items} renderCard={renderCard} loading={loading} seeAllHref={seeAllHref} />;
}

export function Home() {
  const { user } = useAuth();
  return (
    <WorkspaceShell>
      <DiscoveryHome signedIn={Boolean(user)} />
    </WorkspaceShell>
  );
}
