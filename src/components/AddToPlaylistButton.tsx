import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { createPlaylist, getMyPlaylists, addItemToPlaylist } from '../lib/playlistsApi';
import type { Playlist } from '../types';
import { useToast } from './Toast';
import { PlaylistFormModal } from './PlaylistFormModal';
import { Icon } from './Icon';

export function AddToPlaylistButton({
  mediaLibraryId,
  ensureMediaSaved,
  label = 'Add to playlist',
  className = 'iconbtn',
}: {
  mediaLibraryId?: string;
  ensureMediaSaved?: () => Promise<string>;
  label?: string;
  className?: string;
}) {
  const { user, loading } = useAuth();
  const toast = useToast();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const lastFetchedAt = useRef(0);

  useEffect(() => {
    function dismiss(event: MouseEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  async function toggle() {
    if (!user) {
      setOpen((value) => !value);
      return;
    }
    setOpen((value) => !value);
    setError('');
    if (loaded && Date.now() - lastFetchedAt.current < 30_000) return;
    setBusy(true);
    try {
      setPlaylists(await getMyPlaylists());
      setLoaded(true);
      lastFetchedAt.current = Date.now();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your playlists.');
    } finally {
      setBusy(false);
    }
  }

  async function addTo(playlist: Playlist) {
    setBusy(true);
    setError('');
    try {
      const itemId = mediaLibraryId ?? await ensureMediaSaved?.();
      if (!itemId) throw new Error('Save this item to your library before adding it to a playlist.');
      await addItemToPlaylist(playlist.id, itemId);
      toast.push(`Added to ${playlist.name}`);
      setOpen(false);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Could not add this item.');
    } finally {
      setBusy(false);
    }
  }

  async function create(values: { name: string; description: string; isPublic: boolean }) {
    const playlist = await createPlaylist(values);
    setPlaylists((current) => [playlist, ...current]);
    setLoaded(true);
    lastFetchedAt.current = Date.now();
    toast.push('Playlist created');
    const itemId = mediaLibraryId ?? await ensureMediaSaved?.();
    if (itemId) {
      await addItemToPlaylist(playlist.id, itemId);
      toast.push(`Added to ${playlist.name}`);
    }
    setShowCreate(false);
  }

  return (
    <div className="add-playlist" ref={rootRef}>
      <button
        className={className}
        type="button"
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={() => void toggle()}
      >
        <Icon name="plus" size={16} />
      </button>
      {open ? (
        <div className="add-playlist__popover" role="dialog" aria-label="Add item to playlist">
          {loading ? <p className="t-small t-mute">Checking your sign-in…</p> : user ? (
            <>
              <strong className="add-playlist__title">Add to a playlist</strong>
              <button type="button" className="add-playlist__new" onClick={() => setShowCreate(true)}>
                <Icon name="plus" size={15} /> New playlist
              </button>
              {busy && !playlists.length ? <p className="t-small t-mute">Finding your playlists…</p> : null}
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="add-playlist__option"
                  disabled={busy}
                  onClick={() => void addTo(playlist)}
                >
                  <span>{playlist.name}</span><small>{playlist.itemCount ?? 0} tracks</small>
                </button>
              ))}
              {!busy && !playlists.length ? <p className="t-small t-mute">Make a playlist to keep this close.</p> : null}
            </>
          ) : (
            <p className="t-small"><Link to="/auth/login">Sign in to save</Link> this to a playlist.</p>
          )}
          {error ? <p className="add-playlist__error" role="alert">{error}</p> : null}
        </div>
      ) : null}
      <PlaylistFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={create}
      />
    </div>
  );
}
