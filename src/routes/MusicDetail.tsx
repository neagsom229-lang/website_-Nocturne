import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { SmartImage } from '../components/SmartImage';
import { AddToPlaylistButton } from '../components/AddToPlaylistButton';
import { CommentThread } from '../components/CommentThread';
import { useWorkspacePlayer } from '../components/WorkspaceShell';
import { fetchMediaLibrary, saveMedia } from '../lib/mediaApi';
import type { DiscoveryMedia } from '../types';

export function MusicDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [track, setTrack] = useState<DiscoveryMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mediaLibraryId, setMediaLibraryId] = useState<string | null>(null);
  const { playExternalMedia } = useWorkspacePlayer();

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/search/unified?q=${encodeURIComponent(id)}&type=music`)
      .then((res) => res.json())
      .then((data: { results?: DiscoveryMedia[] }) => {
        if (!active) return;
        const found = data.results?.find((item) => item.id === id) || data.results?.[0];
        if (!found) throw new Error('Music track not found');
        setTrack(found);
      })
      .catch((err: unknown) => {
        if (active) setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetchMediaLibrary()
      .then((items) => {
        if (!active) return;
        const existing = items.find((i) => i.externalId === id);
        if (existing?.id) {
          setSaved(true);
          setMediaLibraryId(existing.id);
        }
      })
      .catch(() => {});

    return () => { active = false; };
  }, [id]);

  async function handleSave() {
    if (!track) return;
    setSaving(true);
    try {
      const res = await saveMedia({
        type: 'audio',
        provider: track.source,
        externalId: track.id,
        title: track.title,
        artist: track.artist ?? null,
        thumbnailUrl: track.thumbnail_url ?? null,
        streamUrl: track.stream_url ?? '',
        externalUrl: track.external_url ?? null,
        mediaType: 'music',
      });
      setSaved(true);
      if (res.item.id) setMediaLibraryId(res.item.id);
    } catch (saveErr: unknown) {
      setError((saveErr as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-state" role="status">
        <span className="page-state__icon"><Icon name="headphones" size={32} /></span>
        <h1>Opening track…</h1>
      </div>
    );
  }

  if (error || !track) {
    return (
      <EmptyState
        title="Track not found"
        body={error || 'This music track could not be loaded.'}
        action={<button type="button" className="btn btn--primary" onClick={() => navigate(-1)}>Go Back</button>}
      />
    );
  }

  return (
    <article className="media-detail-page">
      <div className="media-detail-page__hero">
        <div className="media-detail-page__cover">
          <SmartImage src={track.thumbnail_url ?? undefined} alt={track.title} />
        </div>
        <div className="media-detail-page__info">
          <span className="badge badge--pill">Music</span>
          <h1>{track.title}</h1>
          <p className="t-mute">{track.artist}</p>
          <div className="media-detail-page__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => playExternalMedia({
                type: 'audio',
                provider: track.source,
                externalId: track.id,
                title: track.title,
                artist: track.artist ?? null,
                thumbnailUrl: track.thumbnail_url ?? null,
                streamUrl: track.stream_url ?? '',
                externalUrl: track.external_url ?? null,
              })}
            >
              <Icon name="play" size={16} /> Listen Now
            </button>
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
        </div>
      </div>

      {track.description ? (
        <section className="media-detail-page__section">
          <h2>About</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--tp-mute)' }}>{track.description}</p>
        </section>
      ) : null}

      {mediaLibraryId ? (
        <section className="media-detail-page__section">
          <h2>Discussion</h2>
          <CommentThread mediaLibraryId={mediaLibraryId} />
        </section>
      ) : null}

      <div style={{ marginTop: '32px' }}>
        <Link to="/search" className="btn btn--ghost"><Icon name="arrow-left" size={16} /> Back to Search</Link>
      </div>
    </article>
  );
}
