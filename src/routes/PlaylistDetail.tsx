import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { PlaylistFormModal } from '../components/PlaylistFormModal';
import { PlaylistItemRow } from '../components/PlaylistItemRow';
import { useToast } from '../components/Toast';
import { useOptionalWorkspacePlayer, WorkspaceShell } from '../components/WorkspaceShell';
import {
  deletePlaylist,
  getPlaylist,
  removeItemFromPlaylist,
  reorderPlaylistItems,
  updatePlaylist,
} from '../lib/playlistsApi';
import type { Playlist, PlaylistItem } from '../types';

const SortablePlaylistItems = lazy(() => import('../components/SortablePlaylistItems')
  .then((module) => ({ default: module.SortablePlaylistItems })));

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  const hours = Math.floor(minutes / 60);
  const leftoverMinutes = minutes % 60;
  return hours
    ? `${hours}:${String(leftoverMinutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${leftoverMinutes}:${String(remaining).padStart(2, '0')}`;
}

export async function applyPlaylistReorder(
  previous: PlaylistItem[],
  reordered: PlaylistItem[],
  save: (ids: number[]) => Promise<PlaylistItem[]>,
  setItems: (items: PlaylistItem[]) => void,
  onError: (error: unknown) => void,
) {
  setItems(reordered);
  try {
    const saved = await save(reordered.map((item) => item.id));
    setItems(reordered.map((item, index) => ({ ...item, position: saved[index]?.position ?? index + 1 })));
  } catch (error) {
    setItems(previous);
    onError(error);
  }
}

export function PlaylistDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const player = useOptionalWorkspacePlayer();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await getPlaylist(id);
      setPlaylist(result.playlist);
      setItems(result.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not open this playlist.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [id]);

  const isOwner = Boolean(playlist && playlist.userId === user?.id);
  const totalDuration = items.reduce((total, item) => total + (item.durationSeconds ?? 0), 0);

  function playerItem(item: PlaylistItem) {
    const movie = item.mediaType === 'movie' || item.mediaType === 'tv';
    const video = item.type === 'video' || item.mediaType === 'video_podcast' || movie;
    return {
      id: item.mediaLibraryId,
      type: video ? 'video' as const : item.type,
      provider: movie && item.trailerUrl ? 'youtube' as const : item.provider ?? (video ? 'youtube' as const : 'itunes' as const),
      mediaType: item.mediaType ?? undefined,
      externalId: item.externalId ?? item.mediaLibraryId,
      title: item.title,
      artist: item.artist,
      thumbnailUrl: item.thumbnailUrl,
      streamUrl: movie ? item.trailerUrl ?? '' : item.streamUrl,
      externalUrl: movie ? item.trailerUrl ?? null : item.externalUrl ?? null,
    };
  }

  function playOne(item: PlaylistItem) {
    if ((item.mediaType === 'movie' || item.mediaType === 'tv') && !item.trailerUrl) {
      setError(`No playable trailer is available for “${item.title}”.`);
      return;
    }
    player?.playExternalMedia(playerItem(item));
  }

  function playAll(shuffle = false) {
    const unavailableMovies = items.filter((item) =>
      (item.mediaType === 'movie' || item.mediaType === 'tv') && !item.trailerUrl);
    const queue = items.filter((item) => !unavailableMovies.includes(item));
    setError(unavailableMovies.length
      ? `${unavailableMovies.length} movie or TV ${unavailableMovies.length === 1 ? 'trailer is' : 'trailers are'} unavailable and were skipped.`
      : '');
    if (shuffle) {
      for (let index = queue.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [queue[index], queue[randomIndex]] = [queue[randomIndex], queue[index]];
      }
    }
    if (!queue.length) return;
    player?.playExternalQueue(queue.map(playerItem));
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.push('Link copied');
    } catch (copyError) {
      setError(copyError instanceof Error ? `Could not copy the playlist link: ${copyError.message}` : 'Could not copy the playlist link.');
    }
  }

  async function saveEdit(values: { name: string; description: string; isPublic: boolean }) {
    if (!playlist) return;
    setSaving(true);
    try {
      const updated = await updatePlaylist(playlist.id, values);
      setPlaylist(updated);
      toast.push('Playlist updated');
    } finally {
      setSaving(false);
    }
  }

  async function removePlaylist() {
    if (!playlist || !window.confirm(`Delete “${playlist.name}”? This cannot be undone.`)) return;
    try {
      await deletePlaylist(playlist.id);
      toast.push('Playlist deleted');
      navigate('/playlists');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this playlist.');
    }
  }

  async function removeItem(item: PlaylistItem) {
    try {
      await removeItemFromPlaylist(id, item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      toast.push('Removed from playlist');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove this item.');
    }
  }

  async function reorder(orderedIds: number[]) {
    const previous = items;
    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered = orderedIds.map((itemId) => byId.get(itemId)).filter((item): item is PlaylistItem => Boolean(item));
    if (ordered.length !== items.length) return;
    await applyPlaylistReorder(
      previous,
      ordered,
      (itemIds) => reorderPlaylistItems(id, itemIds),
      setItems,
      (reorderError) => setError(reorderError instanceof Error ? reorderError.message : 'Could not save the new order.'),
    );
  }

  if (loading) return <section className="playlists-page"><div className="playlist-detail-skeleton" role="status">Opening your playlist…</div></section>;
  if (error && !playlist) return <section className="playlists-page"><div className="music-error" role="alert">{error}</div><Link className="btn btn--ghost btn--sm" to="/playlists">Back to playlists</Link></section>;
  if (!playlist) return null;

  return (
    <section className="playlists-page playlist-detail">
      <Link className="playlist-back" to="/playlists"><Icon name="arrow-left" size={16} /> Playlists</Link>
      {error ? <div className="music-error" role="alert">{error}</div> : null}
      <header className="playlist-detail__header">
        <span className="playlist-detail__cover">
          {playlist.coverUrl ? <img src={playlist.coverUrl} alt="" /> : <span className="playlist-card__artwork" aria-hidden="true" />}
          <Icon name="headphones" size={32} />
        </span>
        <div className="playlist-detail__copy">
          <p className="t-eyebrow">{isOwner ? 'YOUR COLLECTION' : 'A NOCTURNE LISTENING ROOM'}</p>
          <h1 className="t-h1">{playlist.name}</h1>
          {playlist.description ? <p className="t-body">{playlist.description}</p> : null}
          <p className="playlist-detail__byline">
            by {playlist.userId ? (
              <Link to={`/u/${encodeURIComponent(playlist.userId)}`} title="Public profiles are coming in Phase 5">
                {playlist.ownerDisplayName ?? 'A Nocturne listener'}
              </Link>
            ) : <span>{playlist.ownerDisplayName ?? 'A Nocturne listener'}</span>}
            {' · '}{items.length} {items.length === 1 ? 'item' : 'items'} · {formatDuration(totalDuration)}
          </p>
          <span className={`playlist-card__badge${playlist.isPublic ? ' is-public' : ''}`}>{playlist.isPublic ? '🌐 Public' : '🔒 Private'}</span>
        </div>
      </header>
      <div className="playlist-detail__actions">
        <button className="btn btn--primary" type="button" disabled={!items.length} onClick={() => playAll()}>
          <Icon name="play" size={16} /> Play All
        </button>
        <button className="btn btn--ghost" type="button" disabled={!items.length} onClick={() => playAll(true)}>
          <Icon name="shuffle" size={16} /> Shuffle
        </button>
        {playlist.isPublic ? <button className="btn btn--ghost" type="button" onClick={() => void share()}><Icon name="share" size={16} /> Share</button> : null}
        {isOwner ? (
          <>
            <button className="btn btn--ghost" type="button" onClick={() => setEditOpen(true)}><Icon name="edit" size={16} /> Edit</button>
            <button className="btn btn--ghost playlist-detail__delete" type="button" onClick={() => void removePlaylist()}><Icon name="trash" size={16} /> Delete</button>
          </>
        ) : null}
      </div>
      {items.length ? isOwner ? (
        <Suspense fallback={<div className="playlist-item-list" role="status">Opening reorder controls…</div>}>
          <SortablePlaylistItems
            items={items}
            onPlay={playOne}
            onRemove={(item) => void removeItem(item)}
            onReorder={(ids) => void reorder(ids)}
          />
        </Suspense>
      ) : (
        <div className="playlist-item-list">
          {items.map((item) => (
            <PlaylistItemRow key={item.id} item={item} owner={false} onPlay={() => playOne(item)} onRemove={() => undefined} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="library"
          title="Nothing in this playlist yet."
          body={isOwner ? 'Bring a favorite in from your library to give this collection a first song.' : 'This playlist has not gathered any items yet.'}
          action={isOwner ? <Link className="btn btn--ghost btn--sm" to="/library">Open your library <Icon name="arrow-right" size={15} /></Link> : undefined}
        />
      )}
      <PlaylistFormModal
        open={editOpen}
        initial={playlist}
        onClose={() => setEditOpen(false)}
        onSubmit={saveEdit}
      />
      {saving ? <span className="sr-only" role="status">Saving playlist changes…</span> : null}
    </section>
  );
}

export function PlaylistDetailRoute() {
  const { loading } = useAuth();
  if (loading) return <main className="auth-loading" role="status">Turning the little key…</main>;
  return <WorkspaceShell><PlaylistDetailPage /></WorkspaceShell>;
}
