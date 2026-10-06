import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { saveDiscoveryMedia } from '../lib/mediaApi';
import { prefetchMovieDetails } from '../lib/moviesApi';
import { getComments, getLikes, likeMedia, unlikeMedia } from '../lib/socialApi';
import { getPlaybackTarget } from '../lib/playbackRouter';
import type { DiscoveryMedia } from '../types';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { Icon } from './Icon';
import { SmartImage } from './SmartImage';
import { useOptionalWorkspacePlayer } from './WorkspaceShell';

function mediaTypeLabel(type: DiscoveryMedia['media_type']) {
  if (type === 'movie') return '🎬 Movie';
  if (type === 'tv') return '📺 TV';
  if (type === 'podcast') return '🎙️ Podcast';
  if (type === 'music') return '🎵 Music';
  if (type === 'audiobook') return '📖 Audiobook';
  if (type === 'video_podcast') return '📹 Video';
  return '📹 Video';
}

function getDetailHref(media: DiscoveryMedia) {
  if (media.media_type === 'movie') return `/movies/${encodeURIComponent(media.id)}`;
  if (media.media_type === 'tv') return `/tv/${encodeURIComponent(media.id)}`;
  if (media.media_type === 'music') return `/music/${encodeURIComponent(media.id)}`;
  if (media.media_type === 'podcast') return `/podcasts/${encodeURIComponent(media.id)}`;
  if (media.media_type === 'audiobook') return `/audiobooks/${encodeURIComponent(media.id)}`;
  if (media.media_type === 'video' || media.media_type === 'video_podcast') return `/video-podcasts/${encodeURIComponent(media.id)}`;
  return undefined;
}

export { saveDiscoveryMedia } from '../lib/mediaApi';

export function MediaCard({
  media,
  onPlay,
  onSave,
  ensureMediaSaved,
  mediaLibraryId,
  saved = false,
  saving = false,
  showTypeBadge = true,
}: {
  media: DiscoveryMedia;
  onPlay?: (media: DiscoveryMedia) => void;
  onSave?: () => void;
  ensureMediaSaved?: (media: DiscoveryMedia) => Promise<string>;
  mediaLibraryId?: string;
  saved?: boolean;
  saving?: boolean;
  showTypeBadge?: boolean;
}) {
  const player = useOptionalWorkspacePlayer();
  const { user } = useAuth();
  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const [likeError, setLikeError] = useState('');
  const [likeBusy, setLikeBusy] = useState(false);
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailHref = getDetailHref(media);

  useEffect(() => {
    if (!mediaLibraryId) return;
    let active = true;
    void Promise.all([getLikes(mediaLibraryId), getComments(mediaLibraryId, { limit: 1 })])
      .then(([likes, comments]) => {
        if (!active) return;
        setLikeCount(likes.count);
        setLiked(Boolean(user && likes.userIds.includes(user.id)));
        setCommentCount(comments.count);
      })
      .catch((error: unknown) => console.warn('Could not load social counts:', error));
    return () => { active = false; };
  }, [mediaLibraryId, user]);

  function prefetch() {
    if (media.media_type !== 'movie') return;
    prefetchTimer.current = setTimeout(() => {
      void prefetchMovieDetails(media.id)
        .catch((error: unknown) => console.warn('Movie detail prefetch failed:', error));
    }, 300);
  }

  function clearPrefetch() {
    if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
    prefetchTimer.current = null;
  }

  function play() {
    if (onPlay) {
      onPlay(media);
      return;
    }
    const target = getPlaybackTarget(media);
    if (target.kind === 'youtube') {
      player?.playExternalMedia({
        type: 'video',
        provider: 'youtube',
        mediaType: media.media_type === 'video_podcast' ? 'video_podcast' : media.media_type,
        externalId: target.videoId,
        title: target.title,
        artist: media.artist ?? media.channel ?? null,
        thumbnailUrl: media.thumbnail_url,
        streamUrl: `https://www.youtube.com/watch?v=${target.videoId}`,
        externalUrl: media.external_url ?? null,
      });
    } else if (target.kind === 'audio') {
      player?.playExternalMedia({
        type: 'audio',
        provider: media.source,
        mediaType: media.media_type,
        externalId: media.id,
        title: target.title,
        artist: media.artist ?? media.channel ?? null,
        thumbnailUrl: media.thumbnail_url,
        streamUrl: target.streamUrl,
        externalUrl: media.external_url ?? null,
      });
    } else if (target.kind === 'video') {
      player?.playExternalMedia({
        type: 'video',
        provider: media.source,
        mediaType: media.media_type,
        externalId: media.id,
        title: target.title,
        artist: media.artist ?? media.channel ?? null,
        thumbnailUrl: media.thumbnail_url,
        streamUrl: target.streamUrl,
        externalUrl: media.external_url ?? null,
      });
    } else if (target.kind === 'external') {
      window.open(target.url, '_blank', 'noopener,noreferrer');
    } else {
      console.warn('Playback unsupported:', target.reason);
    }
  }

  async function toggleLike() {
    if (!user || likeBusy) return;
    const previous = liked;
    setLiked(!previous);
    setLikeCount((count) => count === null ? null : Math.max(0, count + (previous ? -1 : 1)));
    setLikeBusy(true);
    setLikeError('');
    let actualLiked = previous;
    let actualCount = likeCount;
    try {
      const id = mediaLibraryId ?? await (ensureMediaSaved ?? saveDiscoveryMedia)(media);
      if (!mediaLibraryId) {
        const result = await getLikes(id);
        actualCount = result.count;
        actualLiked = result.userIds.includes(user.id);
      }
      const next = !actualLiked;
      setLiked(next);
      setLikeCount(actualCount === null ? null : Math.max(0, actualCount + (next ? 1 : -1)));
      if (next) await likeMedia(id);
      else await unlikeMedia(id);
    } catch (error) {
      setLiked(actualLiked);
      setLikeCount(actualCount);
      setLikeError(error instanceof Error ? error.message : 'Could not update like.');
    } finally {
      setLikeBusy(false);
    }
  }

  const subtitle = media.release_year ?? media.artist ?? media.channel ?? '';
  const playbackTarget = getPlaybackTarget(media);
  const isUnsupported = playbackTarget.kind === 'unsupported';

  return (
    <article
      className={`media-card card-hover${media.media_type === 'music' ? ' media-card--square' : ''}`}
      onMouseEnter={prefetch}
      onMouseLeave={clearPrefetch}
      onFocus={prefetch}
      onBlur={clearPrefetch}
    >
      <div className="media-card__art">
        {media.thumbnail_url
          ? <SmartImage src={media.thumbnail_url} alt="" loading="lazy" />
          : <span className="media-card__fallback" aria-hidden="true" />}
        {showTypeBadge ? <span className="media-card__badge">{mediaTypeLabel(media.media_type)}</span> : null}
        {isUnsupported ? (
          <span className="media-card__unsupported-badge" title={playbackTarget.reason}>Not available</span>
        ) : null}
        <div className="media-card__actions">
          {media.isPlayable !== false && !isUnsupported ? (
            <button
              className="media-card__play"
              type="button"
              aria-label={`Play ${media.title}`}
              onClick={play}
              disabled={!onPlay && !media.stream_url && !media.external_url && !detailHref}
            ><Icon name="play" size={17} /></button>
          ) : media.external_url ? (
            <a
              className="media-card__external-badge"
              href={media.external_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Listen to ${media.title} externally`}
            >External</a>
          ) : null}
        </div>
      </div>
      <div className="media-card__copy">
        {detailHref
          ? <Link to={detailHref} className="media-card__title">{media.title}</Link>
          : <strong className="media-card__title">{media.title}</strong>}
        {subtitle ? <span>{subtitle}</span> : null}
        <div className="media-card__copy-actions">
          <span className="media-card__social">
            {user ? (
              <button
                type="button"
                className={`media-card__like${liked ? ' is-liked' : ''}`}
                aria-label={liked ? `Unlike ${media.title}` : `Like ${media.title}`}
                aria-pressed={liked}
                disabled={likeBusy}
                onClick={() => void toggleLike()}
              ><Icon name={liked ? 'heart-filled' : 'heart'} size={15} />{likeCount ?? ''}</button>
            ) : (
              <Link className="media-card__like" to="/auth/login" aria-label={`Sign in to like ${media.title}`}>
                <Icon name="heart" size={15} />
              </Link>
            )}
            {likeError ? <span className="social-inline-error" role="alert">{likeError}</span> : null}
            {commentCount !== null ? detailHref ? (
              <Link className="media-card__comment-count" to={`${detailHref}#comments`} aria-label={`${commentCount} comments`}>
                <Icon name="message" size={14} />{commentCount}
              </Link>
            ) : (
              <span className="media-card__comment-count" aria-label={`${commentCount} comments`}>
                <Icon name="message" size={14} />{commentCount}
              </span>
            ) : null}
          </span>
          <AddToPlaylistButton
            className="media-card__add"
            label={`Add ${media.title} to a playlist`}
            ensureMediaSaved={() => (ensureMediaSaved ?? saveDiscoveryMedia)(media)}
          />
          {onSave ? (
            <button type="button" className="media-card__save" onClick={onSave} disabled={saved || saving}>
              <Icon name={saved ? 'check' : 'bookmark'} size={14} />
              {saved ? 'Saved' : saving ? 'Saving…' : 'Save to Library'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
