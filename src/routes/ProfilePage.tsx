import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import { FollowButton } from '../components/FollowButton';
import { MediaCard } from '../components/MediaCard';
import { WorkspaceShell } from '../components/WorkspaceShell';
import { Icon } from '../components/Icon';
import { SmartImage } from '../components/SmartImage';
import {
  getUserConnections,
  getUserLikes,
  getUserPlaylists,
  getUserProfile,
  type SocialUser,
  type UserProfile,
} from '../lib/socialApi';
import type { DiscoveryMedia } from '../types';
import type { LikedMedia } from '../lib/socialApi';

type ProfilePlaylist = {
  id: number;
  name: string;
  description: string | null;
  coverUrl: string | null;
  itemCount: number;
};

const PROFILE_TABS = ['playlists', 'liked', 'followers', 'following'] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

function tabLabel(tab: ProfileTab) {
  return tab.charAt(0).toUpperCase() + tab.slice(1);
}

export function ProfilePage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [tab, setTab] = useSearchParams();
  const activeTab = PROFILE_TABS.includes(tab.get('tab') as ProfileTab)
    ? tab.get('tab') as ProfileTab
    : 'playlists';
  const [playlists, setPlaylists] = useState<ProfilePlaylist[]>([]);
  const [liked, setLiked] = useState<LikedMedia[]>([]);
  const [people, setPeople] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void getUserProfile(id).then((result) => {
      if (active) setProfile(result);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load this profile.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!profile || (!profile.isPublic && profile.id !== user?.id)) return;
    let active = true;
    setContentLoading(true);
    const load = activeTab === 'playlists'
      ? getUserPlaylists(id).then(setPlaylists)
      : activeTab === 'liked'
        ? getUserLikes(id).then(setLiked)
        : getUserConnections(id, activeTab).then(setPeople);
    void load.catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load this profile section.');
    }).finally(() => {
      if (active) setContentLoading(false);
    });
    return () => { active = false; };
  }, [activeTab, id, profile, user?.id]);

  function selectTab(next: ProfileTab) {
    const params = new URLSearchParams(tab);
    params.set('tab', next);
    setTab(params, { replace: true });
  }

  const ownProfile = profile?.id === user?.id;
  if (loading) return <WorkspaceShell><section className="social-page" role="status">Opening this profile…</section></WorkspaceShell>;
  if (error && !profile) {
    return <WorkspaceShell><section className="social-page"><div className="music-error" role="alert">{error}</div></section></WorkspaceShell>;
  }
  if (!profile) return null;

  return (
    <WorkspaceShell>
      <section className="social-page profile-page">
        <header className="profile-header">
          <Avatar name={profile.displayName} src={profile.avatarUrl} size="large" />
          <div className="profile-header__copy">
            <p className="social-eyebrow">{ownProfile ? 'YOUR PROFILE' : 'A NOCTURNE LISTENER'}</p>
            <h1>{profile.displayName}</h1>
            {profile.deleted && ownProfile ? (
              <p className="profile-private">This profile is deleted.</p>
            ) : !profile.isPublic && !ownProfile ? (
              <p className="profile-private"><Icon name="lock" size={16} /> This profile is private.</p>
            ) : (
              <>
                {profile.bio ? <p className="profile-header__bio">{profile.bio}</p> : null}
                <div className="profile-header__stats">
                  <span><strong>{profile.followerCount}</strong> followers</span>
                  <span><strong>{profile.followingCount}</strong> following</span>
                  <span><strong>{profile.playlistCount}</strong> playlists</span>
                </div>
              </>
            )}
          </div>
          {!ownProfile && profile.isPublic && !profile.deleted ? (
            <FollowButton
              userId={profile.id}
              initialFollowing={profile.isFollowing}
              onChange={(following) => setProfile((current) => current ? {
                ...current,
                isFollowing: following,
                followerCount: Math.max(0, current.followerCount + (following ? 1 : -1)),
              } : current)}
            />
          ) : ownProfile ? <Link to="/settings" className="social-button">Edit profile</Link> : null}
        </header>
        {!profile.deleted && (profile.isPublic || ownProfile) ? (
          <>
            <div className="profile-tabs" role="tablist" aria-label="Profile sections">
              {PROFILE_TABS.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === name}
                  className={activeTab === name ? 'is-active' : ''}
                  onClick={() => selectTab(name)}
                >{tabLabel(name)}</button>
              ))}
            </div>
            {error ? <p className="social-inline-error" role="alert">{error}</p> : null}
            {contentLoading ? <div className="social-loading" role="status">Gathering this corner…</div> : null}
            {!contentLoading && activeTab === 'playlists' ? (
              playlists.length ? (
                <div className="profile-playlist-grid">
                  {playlists.map((playlist) => (
                    <Link className="profile-playlist" key={playlist.id} to={`/playlists/${playlist.id}`}>
                      <span className="profile-playlist__cover">
                        {playlist.coverUrl ? <SmartImage src={playlist.coverUrl} alt="" loading="lazy" /> : <span />}
                      </span>
                      <strong>{playlist.name}</strong>
                      <small>{playlist.itemCount} tracks</small>
                    </Link>
                  ))}
                </div>
              ) : <p className="social-empty">No public playlists here yet.</p>
            ) : null}
            {!contentLoading && activeTab === 'liked' ? (
              liked.length ? (
                <div className="profile-media-grid">
                  {liked.map((item) => {
                    const mediaType: DiscoveryMedia['media_type'] = item.mediaType === 'movie' || item.mediaType === 'tv'
                      ? 'movie'
                      : item.mediaType === 'video_podcast' || item.type === 'video'
                        ? 'video'
                        : item.mediaType === 'podcast' || item.type === 'podcast' ? 'podcast' : 'music';
                    return (
                      <MediaCard
                        key={item.libraryId}
                        media={{
                          id: item.externalId,
                          title: item.title,
                          thumbnail_url: item.thumbnailUrl,
                          media_type: mediaType,
                          source: item.provider,
                          artist: item.artist,
                          stream_url: item.streamUrl,
                          external_url: item.externalUrl,
                        }}
                        mediaLibraryId={item.libraryId}
                      />
                    );
                  })}
                </div>
              ) : <p className="social-empty">No liked media to show yet.</p>
            ) : null}
            {!contentLoading && (activeTab === 'followers' || activeTab === 'following') ? (
              people.length ? (
                <div className="profile-people-grid">
                  {people.map((person) => (
                    <article className="profile-person" key={person.id}>
                      <Link className="profile-person__identity" to={`/u/${encodeURIComponent(person.id)}`}>
                        <Avatar name={person.displayName} src={person.avatarUrl} size="medium" />
                        <strong>{person.displayName}</strong>
                      </Link>
                      {person.id !== user?.id ? (
                        <FollowButton userId={person.id} initialFollowing={person.isFollowing} />
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : <p className="social-empty">No {activeTab} to show yet.</p>
            ) : null}
          </>
        ) : null}
      </section>
    </WorkspaceShell>
  );
}
