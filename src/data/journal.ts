import type { JournalEntry, Mood } from './types';

export const MOOD_FACES: Record<Mood, { label: string; icon: 'coffee' | 'moon' | 'headphones' | 'sun' | 'smile-plus'; note: string }> = {
  hopeful: { label: 'hopeful', icon: 'sun', note: 'kept the window open' },
  quiet: { label: 'quiet', icon: 'moon', note: 'said almost nothing all day' },
  tender: { label: 'tender', icon: 'coffee', note: 'soft about everyone' },
  restless: { label: 'restless', icon: 'headphones', note: 'could not sit still' },
  wrecked: { label: 'wrecked', icon: 'smile-plus', note: 'laughed until it hurt' },
};

export const ENTRIES: JournalEntry[] = [
  {
    id: 'j1',
    date: 'Tonight, 1:40am',
    mood: 'tender',
    song: 'Fairy Lights Left On',
    artist: 'Ivy Lorne',
    note:
      'Played it twice on the walk home with one earbud in, which is the correct way. The bit at 2:10 where the room noise comes up is the whole song for me.',
    rating: 5,
  },
  {
    id: 'j2',
    date: 'Yesterday, 11:15pm',
    mood: 'restless',
    song: 'Ceiling Fan',
    artist: 'Marlow',
    note: 'Too wired to sleep, so I put this on and stared at the ceiling with the lamp still on. It did not help but it was company.',
    photo: 'polaroid-wall',
    rating: 4,
  },
  {
    id: 'j3',
    date: 'Tuesday, 2:05am',
    mood: 'quiet',
    song: 'Room Tone',
    artist: 'Halden',
    note: 'Three minutes of a room doing nothing. I have never felt so seen by a track with no melody in it.',
    rating: 5,
  },
  {
    id: 'j4',
    date: 'Monday, 9:30pm',
    mood: 'hopeful',
    song: 'Toast and Light',
    artist: 'Marlow',
    note: 'Made actual dinner instead of cereal. Put this on while the pan heated. Small, but I am writing it down.',
    photo: 'moonlit-sill',
    rating: 4,
  },
  {
    id: 'j5',
    date: 'Sunday, 3:12am',
    mood: 'wrecked',
    song: 'One Sock',
    artist: 'Marlow',
    note: 'Laughed so hard at the title I had to pause it. Then it turned out to be genuinely sad, which is unfair and also very good.',
    rating: 5,
  },
  {
    id: 'j6',
    date: 'Last Friday, 12:50am',
    mood: 'quiet',
    song: 'Wet Pavement',
    artist: 'Juno Fair',
    note: 'Walked the long way home in the rain on purpose. No regrets, one wet pair of shoes.',
    rating: 3,
  },
];

export const STREAK_DAYS = 12;

export const WEEK_PATTERN: Mood[] = [
  'hopeful',
  'quiet',
  'restless',
  'tender',
  'quiet',
  'wrecked',
  'tender',
];

export const SONG_OF_THE_WEEK = {
  title: 'Fairy Lights Left On',
  artist: 'Ivy Lorne',
  cover: 'polaroid-wall',
  plays: 23,
  note: 'You came back to this one four nights in a row.',
};

export function entriesForMood(mood: Mood | 'all'): JournalEntry[] {
  return mood === 'all' ? ENTRIES : ENTRIES.filter((entry) => entry.mood === mood);
}
