/** Domain types shared by the five demo apps. */

export type Track = {
  id: string;
  title: string;
  artist: string;
  seconds: number;
  cover: string;
};

export type Mix = {
  id: string;
  title: string;
  note: string;
  cover: string;
  tags: string[];
  tracks: Track[];
};

export type Show = {
  id: string;
  title: string;
  host: string;
  blurb: string;
  art: string;
  cadence: string;
};

export type Episode = {
  id: string;
  showId: string;
  title: string;
  summary: string;
  seconds: number;
  published: string;
  season: number;
  number: number;
};

export type Mood = 'tender' | 'restless' | 'quiet' | 'hopeful' | 'wrecked';

export type JournalEntry = {
  id: string;
  date: string;
  mood: Mood;
  song: string;
  artist: string;
  note: string;
  photo?: string;
  rating: number;
};

export type Profile = {
  id: string;
  name: string;
  age: number;
  distanceKm: number;
  headline: string;
  bio: string;
  interests: string[];
  song: string;
  prompt: { question: string; answer: string };
  photo: string;
  lastActive: string;
};

export type Message = {
  id: string;
  from: 'me' | 'them';
  text: string;
  at: string;
};

export type Thread = {
  profileId: string;
  unread: number;
  messages: Message[];
};
