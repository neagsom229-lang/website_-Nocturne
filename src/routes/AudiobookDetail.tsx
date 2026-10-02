import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { AddToPlaylistButton } from '../components/AddToPlaylistButton';
import { CommentThread } from '../components/CommentThread';
import { useWorkspacePlayer } from '../components/WorkspaceShell';
import { fetchMediaLibrary, saveDiscoveryMedia } from '../lib/mediaApi';

export function AudiobookDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mediaLibraryId, setMediaLibraryId] = useState<string | null>(null);
  const { playExternalMedia } = useWorkspacePlayer();

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/search/unified?q=${encodeURIComponent(id)}&type=audiobook`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const found = data.results?.find((item: any) => item.id === id) || data.results?.[0];
        if (!found) throw new Error('Audiobook not found');
        setBook(found);
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

  async function saveBook() {
    if (!book) return;
    setSaving(true);
    try {
      const libraryId = await saveDiscoveryMedia({
        id: book.id,
        title: book.title,
        artist: book.subtitle,
        media_type: 'audiobook',
        source: book.source,
        thumbnail_url: book.thumbnail_url,
        stream_url: book.stream_url,
        external_url: book.external_url,
      });
      setMediaLibraryId(libraryId);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save audiobook.');
    } finally {
      setSaving(false);
    }
  }

  function play() {
    if (!book?.stream_url) return;
    playExternalMedia({
      type: 'audio',
      provider: book.source,
      mediaType: 'audiobook',
      externalId: book.id,
      title: book.title,
      artist: book.subtitle,
      thumbnailUrl: book.thumbnail_url,
      streamUrl: book.stream_url,
      externalUrl: book.external_url,
    });
  }

  if (loading) return <section className="media-page" role="status"><div className="music-loading">Loading audiobook…</div></section>;
  if (error || !book) {
    return (
      <section className="media-page">
        <EmptyState icon="book" title="Audiobook not found." body="Could not load audiobook details." />
        <button className="btn btn--ghost" onClick={() => navigate('/search')}>Back to Search</button>
      </section>
    );
  }

  return (
    <section className="media-page movie-detail">
      <Link className="movie-back" to="/search"><Icon name="arrow-left" size={16} /> Search</Link>
      <div className="movie-detail__layout">
        {book.thumbnail_url ? <img className="movie-detail__poster" src={book.thumbnail_url} alt="" /> : null}
        <div className="movie-detail__copy">
          <p className="t-eyebrow">NOCTURNE AUDIOBOOK & LIBRIVOX</p>
          <h1 className="t-h1">{book.title}</h1>
          <p className="movie-detail__meta">{book.subtitle ?? 'Author'} {book.release_year ? `· ${book.release_year}` : ''}</p>
          <p className="t-body">{book.description || 'A timeless classic read aloud in the quiet hours.'}</p>

          <div className="movie-detail__actions">
            {book.stream_url ? (
              <button className="btn btn--primary" type="button" onClick={play}>
                <Icon name="play" size={16} /> Play Audiobook
              </button>
            ) : null}
            <button className="btn btn--ghost" type="button" onClick={saveBook} disabled={saving || saved}>
              <Icon name={saved ? 'check' : 'bookmark'} size={16} /> {saved ? 'Saved' : saving ? 'Saving…' : 'Save to Library'}
            </button>
            <AddToPlaylistButton
              label={`Add ${book.title} to playlist`}
              ensureMediaSaved={() => saveDiscoveryMedia(book)}
            />
          </div>
        </div>
      </div>

      {mediaLibraryId ? (
        <div id="comments"><CommentThread mediaLibraryId={mediaLibraryId} /></div>
      ) : (
        <section id="comments" className="comment-thread">
          <h2>Notes from the room</h2>
          <p>Save this audiobook to your library to open its conversation.</p>
        </section>
      )}
    </section>
  );
}
