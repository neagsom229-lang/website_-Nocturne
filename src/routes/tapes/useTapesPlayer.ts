import { useOutletContext } from 'react-router-dom';
import type { Track } from '../../data/types';

export type TapesPlayerState = {
  track: Track | null;
  queue: Track[];
  playing: boolean;
  likedTrackIds: string[];
  play: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  toggleLiked: (trackId: string) => void;
  isLiked: (trackId: string) => boolean;
};

export function useTapesPlayer(): TapesPlayerState {
  return useOutletContext<TapesPlayerState>();
}
