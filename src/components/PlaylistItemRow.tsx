import { Icon } from './Icon';
import type { PlaylistItem } from '../types';

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  const hours = Math.floor(minutes / 60);
  const leftoverMinutes = minutes % 60;
  return hours
    ? `${hours}:${String(leftoverMinutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    : `${leftoverMinutes}:${String(remaining).padStart(2, '0')}`;
}

function mediaLabel(item: PlaylistItem) {
  if (item.mediaType === 'video_podcast') return 'VIDEO';
  if (item.mediaType === 'movie' || item.mediaType === 'tv') return item.mediaType.toUpperCase();
  if (item.mediaType) return item.mediaType.toUpperCase();
  return item.type.toUpperCase();
}

export function PlaylistItemRow({
  item,
  owner,
  onPlay,
  onRemove,
  dragHandle,
}: {
  item: PlaylistItem;
  owner: boolean;
  onPlay: () => void;
  onRemove: () => void;
  dragHandle?: React.ReactNode;
}) {
  return (
    <article className="playlist-item">
      {owner ? dragHandle : null}
      <span className="playlist-item__thumb">
        {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" /> : <Icon name="headphones" size={20} />}
      </span>
      <span className="playlist-item__info">
        <strong>{item.title}</strong>
        <small>{item.artist ?? 'Nocturne'} <span className="playlist-item__badge">{mediaLabel(item)}</span></small>
      </span>
      <span className="playlist-item__duration">{item.durationSeconds ? formatDuration(item.durationSeconds) : '—'}</span>
      <button className="iconbtn" type="button" aria-label={`Play ${item.title}`} onClick={onPlay}>
        <Icon name="play" size={16} />
      </button>
      {owner ? (
        <button className="iconbtn playlist-item__remove" type="button" aria-label={`Remove ${item.title}`} onClick={onRemove}>
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </article>
  );
}
