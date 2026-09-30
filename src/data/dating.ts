import type { Profile, Thread } from './types';

/**
 * The dating demo leans on the same art direction as the pack: grainy flash portraits,
 * fairy lights, a bedroom that has not been tidied. Profiles carry a cover seed rather
 * than a stock photo.
 */
export const PROFILES: Profile[] = [
  {
    id: 'p1',
    name: 'Marlow',
    age: 26,
    distanceKm: 2,
    headline: 'Writes songs nobody asked for, plays them once',
    bio: 'I have a four-track that hisses and I refuse to fix it. Looking for someone who will sit on the floor while I figure out a chorus.',
    interests: ['cassette tapes', 'rain sounds', 'late walks', 'cheap coffee'],
    song: 'Ceiling Fan — Marlow',
    prompt: {
      question: 'The way to my heart is',
      answer: 'Being quiet in the same room as me for an hour and not calling it awkward.',
    },
    photo: 'marlow',
    lastActive: 'online now',
  },
  {
    id: 'p2',
    name: 'Juno',
    age: 29,
    distanceKm: 5,
    headline: 'Reads out loud to strangers at night',
    bio: 'I host a sleep podcast, which means my job is talking very slowly. In real life I talk too fast. Sorry in advance.',
    interests: ['ghost stories', 'warm milk', 'thrift shops', 'long drives'],
    song: 'Open Curtain — Juno Fair',
    prompt: {
      question: 'Two truths and a lie',
      answer: 'I own fourteen lamps. I have never owned a kettle. I once slept through a fire alarm.',
    },
    photo: 'juno',
    lastActive: 'online 12m ago',
  },
  {
    id: 'p3',
    name: 'Halden',
    age: 31,
    distanceKm: 9,
    headline: 'Bad at small talk, good at long talks',
    bio: 'I will remember your coffee order and forget your birthday. I am working on exactly one of those.',
    interests: ['field recordings', 'buses', 'card games', 'sad films'],
    song: 'Room Tone — Halden',
    prompt: {
      question: 'My most controversial opinion',
      answer: 'The demo is almost always better than the record and that is not nostalgia, it is compression.',
    },
    photo: 'halden',
    lastActive: 'online 1h ago',
  },
  {
    id: 'p4',
    name: 'Ivy',
    age: 27,
    distanceKm: 3,
    headline: 'Interviews people in their bedrooms',
    bio: 'I am the one with the microphone. If we match I will probably ask you about the last song that made you cry.',
    interests: ['one earbud in', 'polaroids', 'fairy lights', '2am'],
    song: 'Hallway Hum — Ivy Lorne',
    prompt: {
      question: 'You should message me if',
      answer: 'You have a favourite sound that is not music. Mine is a fridge in another room.',
    },
    photo: 'ivy',
    lastActive: 'online now',
  },
];

export const THREADS: Thread[] = [
  {
    profileId: 'p1',
    unread: 2,
    messages: [
      { id: 'm1', from: 'them', text: 'your profile says four-track. which one?', at: '11:48pm' },
      { id: 'm2', from: 'me', text: 'a tascam that cost less than dinner', at: '11:52pm' },
      { id: 'm3', from: 'them', text: 'correct answer. do you keep the hiss?', at: '11:53pm' },
      { id: 'm4', from: 'them', text: 'be honest', at: '11:53pm' },
    ],
  },
  {
    profileId: 'p2',
    unread: 0,
    messages: [
      { id: 'm5', from: 'them', text: 'ok but fourteen lamps is not a personality', at: 'Yesterday' },
      { id: 'm6', from: 'me', text: 'it is the only personality I have', at: 'Yesterday' },
      { id: 'm7', from: 'them', text: 'respect. what is the fourteenth one for', at: 'Yesterday' },
    ],
  },
  {
    profileId: 'p3',
    unread: 0,
    messages: [
      { id: 'm8', from: 'me', text: 'field recordings — do you mean you carry a recorder around', at: 'Monday' },
      { id: 'm9', from: 'them', text: 'yes and it has made me unbearable at parties', at: 'Monday' },
    ],
  },
  {
    profileId: 'p4',
    unread: 1,
    messages: [
      { id: 'm10', from: 'them', text: 'so. last song that made you cry.', at: '2h ago' },
    ],
  },
];

export const SWIPE_PROMPTS = [
  {
    id: 'late',
    question: 'What are you doing at 2am?',
    options: ['still working', 'awake in bed', 'walking home', 'asleep, responsibly'],
  },
  {
    id: 'sound',
    question: 'Pick your noise',
    options: ['rain on a window', 'tape hiss', 'a fan', 'traffic outside'],
  },
  {
    id: 'room',
    question: 'Your room looks like',
    options: ['fairy lights everywhere', 'one good lamp', 'books and cables', 'permanently unmade'],
  },
];

export function profileById(id: string): Profile | undefined {
  return PROFILES.find((profile) => profile.id === id);
}
