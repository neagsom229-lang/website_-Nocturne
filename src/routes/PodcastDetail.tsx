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

export function PodcastDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [podcast, setPodcast] = useState<DiscoveryMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mediaLibraryId, setMediaLibraryId] = useState<string | null>(null);
  const { playExternalMedia } = useWorkspacePlayer();

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/search/unified?q=${encodeURIComponent(id)}&type=podcast`)
      .then((res) => res.json())
      .then((data: { results?: DiscoveryMedia[] }) => {
        if (!active) return;
        const found = data.results?.find((item) => item.id === id) || data.results?.[0];
        if (!found) throw new Error('Podcast not found');
        setPodcast(found);
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
    if (!podcast) return;
    setSaving(true);
    try {
      const res = await saveMedia({
        type: 'podcast',
        provider: podcast.source,
        externalId: podcast.id,
        title: podcast.title,
        artist: podcast.artist ?? null,
        thumbnailUrl: podcast.thumbnail_url ?? null,
        streamUrl: podcast.stream_url ?? '',
        externalUrl: podcast.external_url ?? null,
        mediaType: 'podcast',
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
        <span className="page-state__icon"><Icon name="mic" size={32} /></span>
        <h1>Opening podcast…</h1>
      </div>
    );
  }

  if (error || !podcast) {
    return (
      <EmptyState
        title="Podcast not found"
        body={error || 'This podcast could not be loaded.'}
        action={<button type="button" className="btn btn--primary" onClick={() => navigate(-1)}>Go Back</button>}
      />
    );
  }

  return (
    <article className="media-detail-page">
      <div className="media-detail-page__hero">
        <div className="media-detail-page__cover">
          <SmartImage src={podcast.thumbnail_url ?? undefined} alt={podcast.title} />
        </div>
        <div className="media-detail-page__info">
          <span className="badge badge--pill">Podcast</span>
          <h1>{podcast.title}</h1>
          <p className="t-mute">{podcast.artist}</p>
          <div className="media-detail-page__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => playExternalMedia({
                type: 'podcast',
                provider: podcast.source,
                externalId: podcast.id,
                title: podcast.title,
                artist: podcast.artist ?? null,
                thumbnailUrl: podcast.thumbnail_url ?? null,
                streamUrl: podcast.stream_url ?? '',
                externalUrl: podcast.external_url ?? null,
              })}
            >
              <Icon name="play" size={16} /> Play Episode
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

      {podcast.description ? (
        <section className="media-detail-page__section">
          <h2>About</h2>
          <p style={{ lineHeight: 1.6, color: 'var(--tp-mute)' }}>{podcast.description}</p>
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
