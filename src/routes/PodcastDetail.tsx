import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { SmartImage } from '../components/SmartImage';
import { AddToPlaylistButton } from '../components/AddToPlaylistButton';
import { CommentThread } from '../components/CommentThread';
import { useWorkspacePlayer } from '../components/WorkspaceShell';
import { fetchMediaLibrary, saveDiscoveryMedia } from '../lib/mediaApi';

export function PodcastDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [podcast, setPodcast] = useState<any | null>(null);
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
      .then((data) => {
        if (!active) return;
        const found = data.results?.find((item: any) => item.id === id) || data.results?.[0];
        if (!found) throw new Error('Podcast not found');
        setPodcast(found);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetchMediaLibrary().then((items) => {
      if (!active) return;
      const found = items.find((item) => item.externalId === id);
      if (found?.id) {
        setMediaLibraryId(found.id);
        setSaved(true);
      }
    }).catch(() => {});

    return () => { active = false; };
  }, [id]);

  async function savePodcast() {
    if (!podcast) return;
    setSaving(true);
    try {
      const libraryId = await saveDiscoveryMedia({
        id: podcast.id,
        title: podcast.title,
        channel: podcast.subtitle,
        media_type: 'podcast',
        source: podcast.source,
        thumbnail_url: podcast.thumbnail_url,
        stream_url: podcast.stream_url,
        external_url: podcast.external_url,
      });
      setMediaLibraryId(libraryId);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save podcast.');
    } finally {
      setSaving(false);
    }
  }

  function play() {
    if (!podcast?.stream_url) return;
    playExternalMedia({
      type: 'podcast',
      provider: podcast.source,
      mediaType: 'podcast',
      externalId: podcast.id,
      title: podcast.title,
      artist: podcast.subtitle,
      thumbnailUrl: podcast.thumbnail_url,
      streamUrl: podcast.stream_url,
      externalUrl: podcast.external_url,
    });
  }

  if (loading) return <section className="media-page" role="status"><div className="music-loading">Loading podcast…</div></section>;
  if (error || !podcast) {
    return (
      <section className="media-page">
        <EmptyState icon="mic" title="Podcast not found." body="Could not load podcast episode details." />
        <button className="btn btn--ghost" onClick={() => navigate('/search')}>Back to Search</button>
      </section>
    );
  }

  return (
    <section className="media-page movie-detail">
      <Link className="movie-back" to="/search"><Icon name="arrow-left" size={16} /> Search</Link>
      <div className="movie-detail__layout">
        {podcast.thumbnail_url ? <SmartImage className="movie-detail__poster" src={podcast.thumbnail_url} alt="" /> : null}
        <div className="movie-detail__copy">
          <p className="t-eyebrow">NOCTURNE PODCAST</p>
          <h1 className="t-h1">{podcast.title}</h1>
          <p className="movie-detail__meta">{podcast.subtitle ?? 'Show'} {podcast.release_year ? `· ${podcast.release_year}` : ''}</p>
          <p className="t-body">{podcast.description || 'An episode for the curious ear.'}</p>

          <div className="movie-detail__actions">
            {podcast.stream_url && !podcast.stream_url.endsWith('.xml') ? (
              <button className="btn btn--primary" type="button" onClick={play}>
                <Icon name="play" size={16} /> Play Episode
              </button>
            ) : podcast.external_url ? (
              <a className="btn btn--primary" href={podcast.external_url} target="_blank" rel="noopener noreferrer">
                Open RSS / External Link
              </a>
            ) : null}
            <button className="btn btn--ghost" type="button" onClick={savePodcast} disabled={saving || saved}>
              <Icon name={saved ? 'check' : 'bookmark'} size={16} /> {saved ? 'Saved' : saving ? 'Saving…' : 'Save to Library'}
            </button>
            <AddToPlaylistButton
              label={`Add ${podcast.title} to playlist`}
              ensureMediaSaved={() => saveDiscoveryMedia(podcast)}
            />
          </div>
        </div>
      </div>

      {mediaLibraryId ? (
        <div id="comments"><CommentThread mediaLibraryId={mediaLibraryId} /></div>
      ) : (
        <section id="comments" className="comment-thread">
          <h2>Notes from the room</h2>
          <p>Save this podcast to your library to open its conversation.</p>
        </section>
      )}
    </section>
  );
}
