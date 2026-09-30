import { CoverArt } from '../../components/CoverArt';
import { Icon } from '../../components/Icon';
import { formatClock } from '../../lib/hooks';
import type { Track } from '../../data/types';

type TrackRowProps = {
  track: Track;
  onPlay: () => void;
  liked: boolean;
  onToggleLike: () => void;
  active?: boolean;
  playing?: boolean;
};

export function TrackRow({ track, onPlay, liked, onToggleLike, active = false, playing = false }: TrackRowProps) {
  return (
    <div className={`list-row${active ? ' list-row--on' : ''}`}>
      <button type="button" className="list-row__main" onClick={onPlay}>
        <span className="list-row__art">
          <CoverArt seed={track.cover} ratio="fill" />
          {active && playing ? (
            <span className="list-row__eq" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          ) : null}
        </span>
        <span className="list-row__body">
          <span className="list-row__title t-clamp-1">{track.title}</span>
          <span className="list-row__meta t-clamp-1">{track.artist}</span>
        </span>
      </button>

      <span className="t-mono t-mute">{formatClock(track.seconds)}</span>

      <button
        type="button"
        className="iconbtn"
        onClick={onToggleLike}
        aria-pressed={liked}
        aria-label={liked ? `Remove ${track.title} from liked` : `Like ${track.title}`}
        style={{ width: 40, height: 40, color: liked ? 'var(--tp-acc)' : undefined }}
      >
        <Icon name={liked ? 'heart-filled' : 'heart'} size={17} />
      </button>
    </div>
  );
}
