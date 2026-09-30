import type { Mix, Track } from './types';

/** Cover seeds. A seed maps to a photograph when one exists; otherwise CoverArt
 *  composes the plate from theme tokens, so there is never an empty box. */
export const COVERS = {
  lamp: 'lamp',
  rain: 'rain-on-window',
  tape: 'cassette-desk',
  window: 'moonlit-sill',
  guitar: 'guitar-on-bed',
  polaroid: 'polaroid-wall',
} as const;

function track(id: string, title: string, artist: string, seconds: number, cover: string): Track {
  return { id, title, artist, seconds, cover };
}

export const MIXES: Mix[] = [
  {
    id: 'three-am',
    title: '3am study tape',
    note: 'nine songs, no words, one desk lamp',
    cover: COVERS.lamp,
    tags: ['instrumental', 'no drums'],
    tracks: [
      track('t1', 'Hallway Hum', 'Ivy Lorne', 214, COVERS.lamp),
      track('t2', 'Paper Thin', 'Norr & Bell', 187, COVERS.tape),
      track('t3', 'Ceiling Fan', 'Marlow', 241, COVERS.window),
      track('t4', 'Second Coffee', 'Ivy Lorne', 168, COVERS.rain),
    ],
  },
  {
    id: 'rain-window',
    title: 'rain on the window',
    note: 'field recording under everything',
    cover: COVERS.rain,
    tags: ['rainy', 'soft'],
    tracks: [
      track('t5', 'Gutter Song', 'Halden', 232, COVERS.rain),
      track('t6', 'Wet Pavement', 'Juno Fair', 198, COVERS.window),
      track('t7', 'Umbrella Weather', 'Norr & Bell', 264, COVERS.lamp),
    ],
  },
  {
    id: 'slow-morning',
    title: 'songs for a slow morning',
    note: 'for the hour you refuse to get up',
    cover: COVERS.window,
    tags: ['acoustic', 'warm'],
    tracks: [
      track('t8', 'Toast and Light', 'Marlow', 205, COVERS.window),
      track('t9', 'Open Curtain', 'Juno Fair', 176, COVERS.polaroid),
      track('t10', 'Sunday Felt Like This', 'Halden', 289, COVERS.guitar),
    ],
  },
  {
    id: 'unmade-bed',
    title: 'unmade bed sessions',
    note: 'recorded on a laptop, two feet from the mic',
    cover: COVERS.guitar,
    tags: ['lo-fi', 'guitar'],
    tracks: [
      track('t11', 'Bedframe', 'Ivy Lorne', 221, COVERS.guitar),
      track('t12', 'One Sock', 'Marlow', 154, COVERS.tape),
      track('t13', 'Room Tone', 'Halden', 302, COVERS.lamp),
    ],
  },
  {
    id: 'tape-hiss',
    title: 'tape hiss & traffic',
    note: 'cassette dub of a bus ride home',
    cover: COVERS.tape,
    tags: ['cassette', 'grainy'],
    tracks: [
      track('t14', 'Route 12', 'Norr & Bell', 246, COVERS.tape),
      track('t15', 'Last Stop', 'Juno Fair', 191, COVERS.rain),
      track('t16', 'Slow Headlights', 'Halden', 258, COVERS.window),
    ],
  },
  {
    id: 'cant-sleep',
    title: 'for when you cannot sleep',
    note: 'put it on, close the laptop, lie down',
    cover: COVERS.polaroid,
    tags: ['ambient', 'fairy lights'],
    tracks: [
      track('t17', 'Fairy Lights Left On', 'Ivy Lorne', 274, COVERS.polaroid),
      track('t18', 'Somewhere Past Two', 'Marlow', 233, COVERS.lamp),
      track('t19', 'Sleep in Fours', 'Halden', 318, COVERS.window),
    ],
  },
];

export const DISCOVER_DECK = MIXES.map((mix) => ({
  id: mix.id,
  title: mix.title,
  note: mix.note,
  cover: mix.cover,
  tags: mix.tags,
  songs: mix.tracks.length,
}));

export const ALL_TRACKS: Track[] = MIXES.flatMap((mix) => mix.tracks);

export const LIKED_IDS = ['three-am', 'unmade-bed'];

export const MOODS = [
  { id: 'study', label: 'focus', icon: 'book' },
  { id: 'sleep', label: 'wind down', icon: 'moon' },
  { id: 'sad', label: 'sad but fine', icon: 'headphones' },
  { id: 'drive', label: 'late drive', icon: 'vinyl' },
] as const;

export function mixById(id: string): Mix | undefined {
  return MIXES.find((mix) => mix.id === id);
}
