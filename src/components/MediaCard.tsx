import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { saveMedia } from '../lib/mediaApi';
import { prefetchMovieDetails, saveMovie } from '../lib/moviesApi';
import type { DiscoveryMedia } from '../types';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { Icon } from './Icon';
import { useOptionalWorkspacePlayer } from './WorkspaceShell';

function mediaTypeLabel(type: DiscoveryMedia['media_type']) {
  if (type === 'movie') return '🎬 Movie';
  if (type === 'podcast') return '🎙️ Podcast';
  if (type === 'music') return '🎵 Music';
  return '📹 Video';
}

function playerMedia(media: DiscoveryMedia) {
  const isMovie = media.media_type === 'movie';
  return {
    type: isMovie || media.media_type === 'video' ? 'video' as const
      : media.media_type === 'podcast' ? 'podcast' as const : 'audio' as const,
    provider: media.source,
    mediaType: media.media_type === 'video' ? 'video_podcast' as const : media.media_type,
    externalId: media.id,
    title: media.title,
    artist: media.artist ?? media.channel ?? null,
    thumbnailUrl: media.thumbnail_url,
    streamUrl: media.stream_url ?? media.external_url ?? '',
    externalUrl: media.external_url ?? null,
  };
}

export async function saveDiscoveryMedia(media: DiscoveryMedia): Promise<string> {
  if (media.source === 'tmdb') return saveMovie(Number(media.id));
  const provider = media.source;
  const type = media.media_type === 'podcast' ? 'podcast' : 'audio';
  const result = await saveMedia({
    type,
    provider,
    externalId: media.id,
    title: media.title,
    artist: media.artist ?? media.channel ?? null,
    thumbnailUrl: media.thumbnail_url,
    streamUrl: media.stream_url ?? '',
    externalUrl: media.external_url ?? null,
    mediaType: media.media_type === 'video' ? 'video_podcast' : media.media_type,
  });
  if (!result.item.id) throw new Error('The item was saved, but its library ID was not returned.');
  return result.item.id;
}

export function MediaCard({
  media,
  onPlay,
  onSave,
  ensureMediaSaved,
  saved = false,
  saving = false,
  showTypeBadge = true,
}: {
  media: DiscoveryMedia;
  onPlay?: (media: DiscoveryMedia) => void;
  onSave?: () => void;
  ensureMediaSaved?: (media: DiscoveryMedia) => Promise<string>;
  saved?: boolean;
  saving?: boolean;
  showTypeBadge?: boolean;
}) {
  const player = useOptionalWorkspacePlayer();
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movieHref = media.media_type === 'movie' ? `/movies/${encodeURIComponent(media.id)}` : undefined;

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
    const item = playerMedia(media);
    if (!item.streamUrl) return;
    player?.playExternalMedia(item);
  }

  const subtitle = media.release_year ?? media.artist ?? media.channel ?? '';
  return (
    <article
      className={`media-card${media.media_type === 'music' ? ' media-card--square' : ''}`}
      onMouseEnter={prefetch}
      onMouseLeave={clearPrefetch}
      onFocus={prefetch}
      onBlur={clearPrefetch}
    >
      <div className="media-card__art">
        {media.thumbnail_url
          ? <img src={media.thumbnail_url} alt="" loading="lazy" />
          : <span className="media-card__fallback" aria-hidden="true" />}
        {showTypeBadge ? <span className="media-card__badge">{mediaTypeLabel(media.media_type)}</span> : null}
        <div className="media-card__actions">
          <button
            className="media-card__play"
            type="button"
            aria-label={`Play ${media.title}`}
            onClick={play}
            disabled={!onPlay && !media.stream_url && !media.external_url && !movieHref}
          ><Icon name="play" size={17} /></button>
        </div>
      </div>
      <div className="media-card__copy">
        {movieHref
          ? <Link to={movieHref} className="media-card__title">{media.title}</Link>
          : <strong className="media-card__title">{media.title}</strong>}
        {subtitle ? <span>{subtitle}</span> : null}
        <div className="media-card__copy-actions">
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
