import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { SmartImage } from '../components/SmartImage';
import { PlaylistFormModal } from '../components/PlaylistFormModal';
import { useToast } from '../components/Toast';
import { createPlaylist, getMyPlaylists, getPublicPlaylists } from '../lib/playlistsApi';
import type { Playlist } from '../types';

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Link className="playlist-card" to={`/playlists/${playlist.id}`}>
      <span className="playlist-card__cover">
        {playlist.coverUrl ? <SmartImage src={playlist.coverUrl} alt="" loading="lazy" /> : <span className="playlist-card__artwork" aria-hidden="true" />}
        <span className="playlist-card__cover-mark"><Icon name="headphones" size={26} /></span>
      </span>
      <span className="playlist-card__body">
        <span className="playlist-card__title">{playlist.name}</span>
        <span className="playlist-card__meta">{playlist.itemCount ?? 0} {playlist.itemCount === 1 ? 'item' : 'items'}</span>
        <span className={`playlist-card__badge${playlist.isPublic ? ' is-public' : ''}`}>
          {playlist.isPublic ? '🌐 Public' : '🔒 Private'}
        </span>
        {playlist.ownerDisplayName ? <span className="playlist-card__owner">by {playlist.ownerDisplayName}</span> : null}
      </span>
    </Link>
  );
}

export function PlaylistsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'discover' ? 'discover' : 'mine';
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const load = activeTab === 'mine' ? getMyPlaylists() : getPublicPlaylists({ sort });
    void load.then((items) => {
      if (active) setPlaylists(items);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load playlists.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [activeTab, sort]);

  function chooseTab(tab: 'mine' | 'discover') {
    const next = new URLSearchParams(searchParams);
    if (tab === 'discover') next.set('tab', 'discover');
    else next.delete('tab');
    setSearchParams(next);
  }

  async function create(values: { name: string; description: string; isPublic: boolean }) {
    const playlist = await createPlaylist(values);
    toast.push('Playlist created');
    if (activeTab === 'mine') setPlaylists((current) => [playlist, ...current]);
    else chooseTab('mine');
  }

  return (
    <section className="playlists-page">
      <header className="playlists-heading">
        <div>
          <p className="t-eyebrow">THINGS WE KEEP TOGETHER</p>
          <h1 className="t-h1">Playlists, <em>by feel.</em></h1>
          <p className="t-body">Gather the songs and stories that belong in the same room.</p>
        </div>
        <button className="btn btn--primary" type="button" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={16} /> New Playlist
        </button>
      </header>
      <div className="playlist-tabs" role="tablist" aria-label="Playlist collection">
        <button type="button" role="tab" aria-selected={activeTab === 'mine'} className={activeTab === 'mine' ? 'is-active' : ''} onClick={() => chooseTab('mine')}>
          My Playlists
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'discover'} className={activeTab === 'discover' ? 'is-active' : ''} onClick={() => chooseTab('discover')}>
          Discover
        </button>
        {activeTab === 'discover' ? (
          <label className="playlist-sort">
            <span className="sr-only">Sort public playlists</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as 'recent' | 'popular')}>
              <option value="recent">Recent</option>
              <option value="popular">Popular</option>
            </select>
          </label>
        ) : null}
      </div>
      {error ? <div className="music-error" role="alert">{error}</div> : null}
      {loading ? (
        <div className="playlist-grid" role="status" aria-label="Loading playlists">
          {Array.from({ length: 6 }, (_, index) => <div className="playlist-skeleton" key={index} />)}
        </div>
      ) : playlists.length ? (
        <div className="playlist-grid">
          {playlists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
        </div>
      ) : !error ? (
        activeTab === 'mine' ? (
          <EmptyState
            icon="library"
            title="Your shelves are still quiet."
            body="You haven't created any playlists yet. Start curating your favorites."
            action={<button className="btn btn--primary btn--sm" type="button" onClick={() => setCreateOpen(true)}><Icon name="plus" size={15} /> Start a playlist</button>}
          />
        ) : (
          <EmptyState icon="users" title="A little room for discovery." body="No public playlists yet. Be the first to share one." />
        )
      ) : null}
      <PlaylistFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={create} />
    </section>
  );
}
