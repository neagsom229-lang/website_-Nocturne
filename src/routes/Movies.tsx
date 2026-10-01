import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { AddToPlaylistButton } from '../components/AddToPlaylistButton';
import { CommentThread } from '../components/CommentThread';
import { useWorkspacePlayer } from '../components/WorkspaceShell';
import { fetchMediaLibrary } from '../lib/mediaApi';
import {
  fetchMovieDetails,
  fetchTrendingMovies,
  fetchUpcomingMovies,
  saveMovie,
  searchMovies,
  type MovieDetails,
  type MovieSummary,
} from '../lib/moviesApi';

function MovieCard({ movie }: { movie: MovieSummary }) {
  return (
    <article className="media-card movie-card">
      <Link to={`/movies/${movie.tmdb_id}`} className="media-card__art" aria-label={`View ${movie.title}`}>
        {movie.poster_url
          ? <img src={movie.poster_url} alt="" loading="lazy" />
          : <span className="media-card__fallback"><Icon name="play-circle" size={28} /></span>}
        <span className="media-card__type">MOVIE</span>
        {movie.rating !== null ? <span className="movie-card__rating">★ {movie.rating.toFixed(1)}</span> : null}
      </Link>
      <div className="media-card__body">
        <h2><Link to={`/movies/${movie.tmdb_id}`}>{movie.title}</Link></h2>
        <p>{movie.year ?? 'Release date unavailable'}</p>
        <AddToPlaylistButton
          label={`Add ${movie.title} to a playlist`}
          ensureMediaSaved={() => saveMovie(movie.tmdb_id)}
        />
        <Link className="media-card__play-link" to={`/movies/${movie.tmdb_id}`}>
          View details <Icon name="arrow-right" size={14} />
        </Link>
      </div>
    </article>
  );
}

export function MoviesPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q')?.trim() ?? '';
  const [input, setInput] = useState(query);
  const [movies, setMovies] = useState<MovieSummary[]>([]);
  const [upcoming, setUpcoming] = useState<MovieSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => setInput(query), [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const load = query
      ? searchMovies(query)
      : Promise.all([fetchTrendingMovies(), fetchUpcomingMovies()]).then(([trending, next]) => {
        if (active) setUpcoming(next);
        return trending;
      });
    void load.then((results) => {
      if (active) setMovies(results);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load movies.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [query]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = input.trim();
    setParams(nextQuery ? { q: nextQuery } : {});
  }

  return (
    <section className="media-page">
      <header className="media-page__heading">
        <p className="t-eyebrow">THE LATE-NIGHT SCREENING ROOM</p>
        <h1 className="t-h1">Stories for<br /><em>the big screen.</em></h1>
        <p className="t-body">Find something worth staying up for, then bring its trailer to the listening room.</p>
      </header>
      <form className="movie-search" onSubmit={submitSearch} role="search">
        <label className="sr-only" htmlFor="movie-search">Search movies</label>
        <Icon name="search" size={18} />
        <input
          id="movie-search"
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Search movies"
          maxLength={200}
        />
        <button className="btn btn--primary btn--sm" type="submit">Search</button>
      </form>
      {error ? <div className="music-error" role="alert">{error}</div> : null}
      {loading ? (
        <div className="media-grid" role="status" aria-label="Loading movies">
          {Array.from({ length: 6 }, (_, index) => <div className="media-skeleton" key={index}><div className="media-skeleton__art" /></div>)}
        </div>
      ) : movies.length ? (
        <>
          <div className="movie-section-heading">
            <h2 className="t-h2">{query ? `Results for “${query}”` : 'Trending this week'}</h2>
          </div>
          <div className="media-grid">{movies.map((movie) => <MovieCard key={movie.tmdb_id} movie={movie} />)}</div>
          {!query && upcoming.length ? (
            <section className="movie-section">
              <div className="movie-section-heading"><h2 className="t-h2">Coming up</h2></div>
              <div className="media-grid">{upcoming.slice(0, 6).map((movie) => <MovieCard key={movie.tmdb_id} movie={movie} />)}</div>
            </section>
          ) : null}
        </>
      ) : !error ? (
        <EmptyState icon="search" title="No movies found." body="Try another title or clear your search to see what’s trending." />
      ) : null}
    </section>
  );
}

export function MovieDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [mediaLibraryId, setMediaLibraryId] = useState<string | null>(null);
  const { playExternalMedia } = useWorkspacePlayer();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void fetchMovieDetails(id).then((details) => {
      if (active) setMovie(details);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load this movie.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    void fetchMediaLibrary().then((items) => {
      if (!active) return;
      const savedMovie = items.find((item) => item.provider === 'tmdb' && item.externalId === id);
      if (savedMovie?.id) {
        setMediaLibraryId(savedMovie.id);
        setSaved(true);
      }
    }).catch((loadError: unknown) => console.warn('Could not check saved movie status:', loadError));
    return () => { active = false; };
  }, [id]);

  async function keepMovie() {
    if (!movie) return;
    setSaving(true);
    setError('');
    try {
      const libraryId = await saveMovie(movie.tmdb_id);
      setMediaLibraryId(libraryId);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this movie.');
    } finally {
      setSaving(false);
    }
  }

  function playTrailer() {
    if (!movie?.trailer_url) return;
    playExternalMedia({
      type: 'video',
      provider: 'youtube',
      externalId: `tmdb-${movie.tmdb_id}-trailer`,
      title: `${movie.title} · Trailer`,
      artist: 'Movie trailer',
      thumbnailUrl: movie.backdrop_url ?? movie.poster_url,
      streamUrl: movie.trailer_url,
      externalUrl: movie.trailer_url,
    });
  }

  if (loading) return <section className="media-page"><div className="music-loading" role="status">Opening the screening room…</div></section>;
  if (error && !movie) return <section className="media-page"><div className="music-error" role="alert">{error}</div><button className="btn btn--ghost" onClick={() => navigate('/movies')}>Back to movies</button></section>;
  if (!movie) return null;

  return (
    <section className="media-page movie-detail">
      <Link className="movie-back" to="/movies"><Icon name="arrow-left" size={16} /> Movies</Link>
      {error ? <div className="music-error" role="alert">{error}</div> : null}
      <div className="movie-detail__layout">
        {movie.poster_url ? <img className="movie-detail__poster" src={movie.poster_url} alt={`Poster for ${movie.title}`} /> : null}
        <div className="movie-detail__copy">
          <p className="t-eyebrow">NOW SHOWING IN NOCTURNE</p>
          <h1 className="t-h1">{movie.title}</h1>
          <p className="movie-detail__meta">
            {movie.year ?? 'Release date unavailable'}
            {movie.runtime ? ` · ${movie.runtime} min` : ''}
            {movie.rating !== null ? ` · ★ ${movie.rating.toFixed(1)}` : ''}
          </p>
          {movie.genres.length ? <p className="movie-detail__genres">{movie.genres.join(' · ')}</p> : null}
          <p className="t-body">{movie.overview || 'No overview is available yet.'}</p>
          <div className="movie-detail__actions">
            {movie.trailer_url ? (
              <button className="btn btn--primary" type="button" onClick={playTrailer}>
                <Icon name="play" size={16} /> Play trailer in player
              </button>
            ) : <p className="t-small t-mute">No trailer is available for this title.</p>}
            <button className="btn btn--ghost" type="button" onClick={() => void keepMovie()} disabled={saving || saved}>
              <Icon name={saved ? 'check' : 'bookmark'} size={16} /> {saved ? 'Saved to Library' : saving ? 'Saving…' : 'Save to Library'}
            </button>
            <AddToPlaylistButton
              label={`Add ${movie.title} to a playlist`}
              ensureMediaSaved={() => saveMovie(movie.tmdb_id)}
            />
          </div>
          {movie.cast.length ? (
            <section className="movie-cast">
              <h2 className="t-h2">With</h2>
              <p>{movie.cast.map((person) => `${person.name}${person.character ? ` as ${person.character}` : ''}`).join(' · ')}</p>
            </section>
          ) : null}
        </div>
        </div>
        {mediaLibraryId ? (
          <div id="comments"><CommentThread mediaLibraryId={mediaLibraryId} /></div>
        ) : (
          <section id="comments" className="comment-thread">
            <h2>Notes from the room</h2>
            <p>Save this movie to your library to open its conversation.</p>
          </section>
        )}
    </section>
  );
}
