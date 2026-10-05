import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { SmartImage } from '../components/SmartImage';
import { AddToPlaylistButton } from '../components/AddToPlaylistButton';
import { CommentThread } from '../components/CommentThread';
import { useWorkspacePlayer } from '../components/WorkspaceShell';
import { fetchMediaLibrary, saveDiscoveryMedia } from '../lib/mediaApi';

export function MusicDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [track, setTrack] = useState<any | null>(null);
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
      .then((data) => {
        if (!active) return;
        const found = data.results?.find((item: any) => item.id === id) || data.results?.[0];
        if (!found) throw new Error('Music track not found');
        setTrack(found);
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

  async function saveTrack() {
    if (!track) return;
    setSaving(true);
    try {
      const libraryId = await saveDiscoveryMedia({
        id: track.id,
        title: track.title,
        artist: track.subtitle,
        media_type: 'music',
        source: track.source,
        thumbnail_url: track.thumbnail_url,
        stream_url: track.stream_url,
        external_url: track.external_url,
      });
      setMediaLibraryId(libraryId);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save track.');
    } finally {
      setSaving(false);
    }
  }

  function play() {
    if (!track?.stream_url) return;
    playExternalMedia({
      type: 'audio',
      provider: track.source,
      mediaType: 'music',
      externalId: track.id,
      title: track.title,
      artist: track.subtitle,
      thumbnailUrl: track.thumbnail_url,
      streamUrl: track.stream_url,
      externalUrl: track.external_url,
    });
  }

  if (loading) return <section className="media-page" role="status"><div className="music-loading">Loading track…</div></section>;
  if (error || !track) {
    return (
      <section className="media-page">
        <EmptyState icon="library" title="Track not found." body="Could not load music track details." />
        <button className="btn btn--ghost" onClick={() => navigate('/search')}>Back to Search</button>
      </section>
    );
  }

  return (
    <section className="media-page movie-detail">
      <Link className="movie-back" to="/search"><Icon name="arrow-left" size={16} /> Search</Link>
      <div className="movie-detail__layout">
        {track.thumbnail_url ? <SmartImage className="movie-detail__poster" src={track.thumbnail_url} alt="" /> : null}
        <div className="movie-detail__copy">
          <p className="t-eyebrow">NOCTURNE MUSIC & PREVIEW</p>
          <h1 className="t-h1">{track.title}</h1>
          <p className="movie-detail__meta">{track.subtitle ?? 'Artist'} · {track.source === 'deezer' ? 'Deezer 30s Preview' : 'Audius Full Stream'}</p>
          <p className="t-body">{track.description || 'A late-night listening selection.'}</p>

          <div className="movie-detail__actions">
            {track.stream_url ? (
              <button className="btn btn--primary" type="button" onClick={play}>
                <Icon name="play" size={16} /> Play Track
              </button>
            ) : null}
            <button className="btn btn--ghost" type="button" onClick={saveTrack} disabled={saving || saved}>
              <Icon name={saved ? 'check' : 'bookmark'} size={16} /> {saved ? 'Saved' : saving ? 'Saving…' : 'Save to Library'}
            </button>
            <AddToPlaylistButton
              label={`Add ${track.title} to playlist`}
              ensureMediaSaved={() => saveDiscoveryMedia(track)}
            />
          </div>
        </div>
      </div>

      {mediaLibraryId ? (
        <div id="comments"><CommentThread mediaLibraryId={mediaLibraryId} /></div>
      ) : (
        <section id="comments" className="comment-thread">
          <h2>Notes from the room</h2>
          <p>Save this track to your library to open its conversation.</p>
        </section>
      )}
    </section>
  );
}
