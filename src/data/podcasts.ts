import type { Episode, Show } from './types';

export const SHOWS: Show[] = [
  {
    id: 'bedroom-tapes',
    title: 'Bedroom Tapes',
    host: 'Ivy Lorne',
    blurb: 'Interviews recorded in the corner of somebody’s room, one lamp, no edit.',
    art: 'bedroom-tapes',
    cadence: 'Every second Thursday',
  },
  {
    id: 'static-sincerity',
    title: 'Static & Sincerity',
    host: 'Halden',
    blurb: 'Two friends work out why a song keeps coming back. Sometimes they cry about it.',
    art: 'static-sincerity',
    cadence: 'Weekly, late',
  },
  {
    id: 'fairy-light-hours',
    title: 'Fairy Light Hours',
    host: 'Juno Fair',
    blurb: 'A sleep show. One story, read slowly, for people who are not tired.',
    art: 'fairy-light-hours',
    cadence: 'Nightly',
  },
];

export const EPISODES: Episode[] = [
  {
    id: 'e1',
    showId: 'bedroom-tapes',
    title: 'Everything I own fits in this room',
    summary:
      'Marlow moved four times in two years and kept one guitar. We talk about what a song sounds like when you are the only one in the flat.',
    seconds: 2_412,
    published: '2 days ago',
    season: 3,
    number: 14,
  },
  {
    id: 'e2',
    showId: 'bedroom-tapes',
    title: 'The demo was better than the record',
    summary:
      'Norr & Bell bring the original four-track take and explain, calmly, why the label version lost the noise.',
    seconds: 2_940,
    published: '2 weeks ago',
    season: 3,
    number: 13,
  },
  {
    id: 'e3',
    showId: 'static-sincerity',
    title: 'Song you hate from the first second',
    summary:
      'We play three songs we cannot stand and try to be fair about them. We are not fair about them.',
    seconds: 1_866,
    published: '4 days ago',
    season: 1,
    number: 8,
  },
  {
    id: 'e4',
    showId: 'static-sincerity',
    title: 'Crying in the car, a study',
    summary:
      'A listener asked why certain songs only work while driving. We have theories. One of them is good.',
    seconds: 2_088,
    published: '11 days ago',
    season: 1,
    number: 7,
  },
  {
    id: 'e5',
    showId: 'fairy-light-hours',
    title: 'The house that hummed',
    summary:
      'A slow reading about a rented house near the coast, a broken fridge, and the noise that made it bearable.',
    seconds: 3_360,
    published: 'Last night',
    season: 2,
    number: 41,
  },
  {
    id: 'e6',
    showId: 'fairy-light-hours',
    title: 'Six hours of nothing in particular',
    summary: 'No story tonight. Rain, a fan, and somebody turning pages two rooms away.',
    seconds: 5_040,
    published: '3 nights ago',
    season: 2,
    number: 40,
  },
  {
    id: 'e7',
    showId: 'bedroom-tapes',
    title: 'Stop apologising for the take',
    summary:
      'Ivy sits with Juno Fair about recording alone, and the very specific shame of hearing your own voice back.',
    seconds: 2_604,
    published: '1 month ago',
    season: 3,
    number: 12,
  },
  {
    id: 'e8',
    showId: 'fairy-light-hours',
    title: 'Flat above the laundrette',
    summary: 'A short one. Warm machines, a thin wall, and the sound that got a whole building to sleep.',
    seconds: 2_220,
    published: 'Last week',
    season: 2,
    number: 39,
  },
];

export const SAVED_EPISODE_IDS = ['e3', 'e5'];

export function showById(id: string): Show | undefined {
  return SHOWS.find((show) => show.id === id);
}

export function episodesForShow(showId: string): Episode[] {
  return EPISODES.filter((episode) => episode.showId === showId);
}
