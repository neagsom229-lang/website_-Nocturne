import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { AddToPlaylistButton } from '../components/AddToPlaylistButton';
import { CommentThread } from '../components/CommentThread';
import { useWorkspacePlayer } from '../components/WorkspaceShell';
import { fetchMediaLibrary, saveDiscoveryMedia } from '../lib/mediaApi';

export function TvDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mediaLibraryId, setMediaLibraryId] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const { playExternalMedia } = useWorkspacePlayer();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetch(`/api/movies/tv/${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('TV show not found');
          throw new Error('Could not load TV show');
        }
        return res.json();
      })
      .then((data) => {
        if (active) setShow(data.show);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetchMediaLibrary().then((items) => {
      if (!active) return;
      const found = items.find((item) => item.provider === 'tmdb' && item.externalId === id);
      if (found?.id) {
        setMediaLibraryId(found.id);
        setSaved(true);
      }
    }).catch(() => {});

    return () => { active = false; };
  }, [id]);

  async function saveShow() {
    if (!show) return;
    setSaving(true);
    try {
      const res = await fetch('/api/movies/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdb_id: show.tmdb_id ?? id, media_type: 'tv' }),
      });
      const data = await res.json();
      if (data.item?.id) {
        setMediaLibraryId(data.item.id);
        setSaved(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save show.');
    } finally {
      setSaving(false);
    }
  }

  function playTrailer() {
    if (!show?.trailer_url) return;
    playExternalMedia({
      type: 'video',
      provider: 'youtube',
      externalId: `tmdb-tv-${id}-trailer`,
      title: `${show.title} · Trailer`,
      artist: 'TV Show Trailer',
      thumbnailUrl: show.poster_url,
      streamUrl: show.trailer_url,
      externalUrl: show.trailer_url,
    });
  }

  if (loading) {
    return (
      <section className="media-page" role="status">
        <div className="music-loading">Opening the screening room…</div>
      </section>
    );
  }

  if (error || !show) {
    return (
      <section className="media-page">
        <EmptyState icon="library" title="TV Show not found." body="This show may have been removed or the ID is incorrect." />
        <button className="btn btn--ghost" onClick={() => navigate('/search')}>Back to Search</button>
      </section>
    );
  }

  const discoveryMedia = {
    id: String(id),
    title: show.title,
    media_type: 'tv' as const,
    source: 'tmdb' as const,
    thumbnail_url: show.poster_url,
    external_url: show.external_url ?? `https://www.themoviedb.org/tv/${id}`,
    stream_url: show.trailer_url,
    release_year: show.year,
    rating: show.rating,
    description: show.overview,
  };

  return (
    <section className="media-page movie-detail">
      <Link className="movie-back" to="/search"><Icon name="arrow-left" size={16} /> Search</Link>
      <div className="movie-detail__layout">
        {show.poster_url ? <img className="movie-detail__poster" src={show.poster_url} alt="" /> : null}
        <div className="movie-detail__copy">
          <p className="t-eyebrow">NOCTURNE TV SERIES</p>
          <h1 className="t-h1">{show.title}</h1>
          <p className="movie-detail__meta">
            {show.year ?? 'Date unavailable'}
            {show.number_of_seasons ? ` · ${show.number_of_seasons} Seasons` : ''}
            {show.rating !== null ? ` · ★ ${show.rating.toFixed(1)}` : ''}
          </p>
          <p className="t-body">{show.overview || 'No overview available.'}</p>

          <div className="movie-detail__actions">
            {show.trailer_url ? (
              <button className="btn btn--primary" type="button" onClick={playTrailer}>
                <Icon name="play" size={16} /> Play Trailer
              </button>
            ) : null}
            <button className="btn btn--ghost" type="button" onClick={saveShow} disabled={saving || saved}>
              <Icon name={saved ? 'check' : 'bookmark'} size={16} /> {saved ? 'Saved' : saving ? 'Saving…' : 'Save to Library'}
            </button>
            <AddToPlaylistButton
              label={`Add ${show.title} to playlist`}
              ensureMediaSaved={() => saveDiscoveryMedia(discoveryMedia)}
            />
          </div>

          {Array.isArray(show.seasons) && show.seasons.length > 0 ? (
            <div className="tv-seasons" style={{ marginTop: '1.5rem' }}>
              <h2 className="t-h2">Seasons</h2>
              <select
                aria-label="Select season"
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                className="tv-season-select"
              >
                {show.seasons.map((s: any) => (
                  <option key={s.id ?? s.season_number} value={s.season_number}>
                    {s.name ?? `Season ${s.season_number}`} ({s.episode_count ?? 0} eps)
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </div>

      {mediaLibraryId ? (
        <div id="comments">
          <CommentThread mediaLibraryId={mediaLibraryId} />
        </div>
      ) : (
        <section id="comments" className="comment-thread">
          <h2>Notes from the room</h2>
          <p>Save this TV show to your library to open its conversation.</p>
        </section>
      )}
    </section>
  );
}
