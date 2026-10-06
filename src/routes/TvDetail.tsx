import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { SmartImage } from '../components/SmartImage';
import { AddToPlaylistButton } from '../components/AddToPlaylistButton';
import { CommentThread } from '../components/CommentThread';
import { useWorkspacePlayer } from '../components/WorkspaceShell';
import { fetchMediaLibrary, saveDiscoveryMedia } from '../lib/mediaApi';

export function TvDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState<Record<string, unknown> | null>(null);
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
      .then((data: { show?: Record<string, unknown> }) => {
        if (active && data.show) setShow(data.show);
      })
      .catch((err: unknown) => {
        if (active) setError((err as Error).message);
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

  async function handleSave() {
    if (!show) return;
    setSaving(true);
    try {
      const res = await saveDiscoveryMedia({
        type: 'video',
        provider: 'tmdb',
        externalId: String(show.id ?? id),
        title: String(show.title ?? show.name ?? ''),
        artist: String(show.tagline ?? ''),
        thumbnailUrl: String(show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : ''),
        streamUrl: String(show.trailer_url ?? ''),
        externalUrl: String(show.homepage ?? ''),
      });
      setSaved(true);
      setMediaLibraryId(res.item.id);
    } catch (saveErr: unknown) {
      setError((saveErr as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-state" role="status">
        <span className="page-state__icon"><Icon name="play-circle" size={32} /></span>
        <h1>Opening TV show…</h1>
      </div>
    );
  }

  if (error || !show) {
    return (
      <EmptyState
        title="TV Show not found"
        body={error || 'This TV show could not be loaded.'}
        action={<button type="button" className="btn btn--primary" onClick={() => navigate(-1)}>Go Back</button>}
      />
    );
  }

  return (
    <section className="media-detail-page">
      <div className="media-detail-page__hero">
        <div className="media-detail-page__cover">
          <SmartImage src={show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : undefined} alt={String(show.title ?? show.name ?? '')} />
        </div>
        <div className="media-detail-page__info">
          <span className="badge badge--pill">TV Series</span>
          <h1>{String(show.title ?? show.name ?? '')}</h1>
          <p className="t-mute">{String(show.tagline ?? '')}</p>
          <div className="media-detail-page__actions">
            {show.trailer_url ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => playExternalMedia({
                  type: 'video',
                  provider: 'tmdb',
                  externalId: String(show.id ?? id),
                  title: String(show.title ?? show.name ?? ''),
                  artist: String(show.tagline ?? ''),
                  thumbnailUrl: String(show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : ''),
                  streamUrl: String(show.trailer_url),
                })}
              >
                <Icon name="play" size={16} /> Watch Trailer
              </button>
            ) : null}
            {!saved ? (
              <button type="button" className="btn btn--ghost" disabled={saving} onClick={() => void handleSave()}>
                <Icon name="bookmark" size={16} /> {saving ? 'Saving…' : 'Save to Library'}
              </button>
            ) : (
              <span className="badge badge--pill"><Icon name="check" size={14} /> Saved in Library</span>
            )}
            {mediaLibraryId ? (
              <AddToPlaylistButton mediaLibraryId={mediaLibraryId} label="Add to Playlist" />
            ) : null}
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
                {show.seasons.map((s: Record<string, unknown>) => (
                  <option key={String(s.id ?? s.season_number)} value={Number(s.season_number ?? 1)}>
                    {String(s.name ?? `Season ${s.season_number}`)} ({Number(s.episode_count ?? 0)} eps)
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
