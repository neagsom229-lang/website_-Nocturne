import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { AddToPlaylistButton } from '../components/AddToPlaylistButton';
import { CommentThread } from '../components/CommentThread';
import { useWorkspacePlayer } from '../components/WorkspaceShell';
import { fetchMediaLibrary, saveDiscoveryMedia } from '../lib/mediaApi';

export function VideoPodcastDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mediaLibraryId, setMediaLibraryId] = useState<string | null>(null);
  const { playExternalMedia } = useWorkspacePlayer();

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/search/unified?q=${encodeURIComponent(id)}&type=video_podcast`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const found = data.results?.find((item: any) => item.id === id) || data.results?.[0];
        if (!found) throw new Error('Video podcast not found');
        setVideo(found);
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

  async function saveVideo() {
    if (!video) return;
    setSaving(true);
    try {
      const libraryId = await saveDiscoveryMedia({
        id: video.id,
        title: video.title,
        channel: video.subtitle,
        media_type: 'video_podcast',
        source: video.source,
        thumbnail_url: video.thumbnail_url,
        stream_url: video.stream_url,
        external_url: video.external_url,
      });
      setMediaLibraryId(libraryId);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save video.');
    } finally {
      setSaving(false);
    }
  }

  function play() {
    if (!video?.stream_url) return;
    playExternalMedia({
      type: 'video',
      provider: video.source,
      mediaType: 'video_podcast',
      externalId: video.id,
      title: video.title,
      artist: video.subtitle,
      thumbnailUrl: video.thumbnail_url,
      streamUrl: video.stream_url,
      externalUrl: video.external_url,
    });
  }

  if (loading) return <section className="media-page" role="status"><div className="music-loading">Loading video…</div></section>;
  if (error || !video) {
    return (
      <section className="media-page">
        <EmptyState icon="play-circle" title="Video not found." body="Could not load video podcast details." />
        <button className="btn btn--ghost" onClick={() => navigate('/search')}>Back to Search</button>
      </section>
    );
  }

  return (
    <section className="media-page movie-detail">
      <Link className="movie-back" to="/search"><Icon name="arrow-left" size={16} /> Search</Link>
      <div className="movie-detail__layout">
        {video.thumbnail_url ? <img className="movie-detail__poster" src={video.thumbnail_url} alt="" /> : null}
        <div className="movie-detail__copy">
          <p className="t-eyebrow">NOCTURNE VIDEO PODCAST</p>
          <h1 className="t-h1">{video.title}</h1>
          <p className="movie-detail__meta">{video.subtitle ?? 'Channel'}</p>
          <p className="t-body">{video.description || 'A visual conversation in the quiet hours.'}</p>

          <div className="movie-detail__actions">
            {video.stream_url ? (
              <button className="btn btn--primary" type="button" onClick={play}>
                <Icon name="play" size={16} /> Play Video with PiP
              </button>
            ) : null}
            <button className="btn btn--ghost" type="button" onClick={saveVideo} disabled={saving || saved}>
              <Icon name={saved ? 'check' : 'bookmark'} size={16} /> {saved ? 'Saved' : saving ? 'Saving…' : 'Save to Library'}
            </button>
            <AddToPlaylistButton
              label={`Add ${video.title} to playlist`}
              ensureMediaSaved={() => saveDiscoveryMedia(video)}
            />
          </div>
        </div>
      </div>

      {mediaLibraryId ? (
        <div id="comments"><CommentThread mediaLibraryId={mediaLibraryId} /></div>
      ) : (
        <section id="comments" className="comment-thread">
          <h2>Notes from the room</h2>
          <p>Save this video to your library to open its conversation.</p>
        </section>
      )}
    </section>
  );
}
