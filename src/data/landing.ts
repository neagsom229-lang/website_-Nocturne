/** Copy for the landing page, written in the pack's register: recorded on a laptop at
 *  2am. Tender, lo-fi, honest. */

export const NAV_LINKS = [
  { label: 'How it works', href: '#how' },
  { label: 'Mixes', href: '#mixes' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Questions', href: '#faq' },
] as const;

export const HERO = {
  eyebrow: 'For the hours after midnight',
  headline: 'Find the song that matches tonight',
  mechanism:
    'Bedroom Pop builds quiet mixes out of small artists, then learns which one got you to sleep and plays it again tomorrow.',
  primaryCta: 'Start listening',
  secondaryCta: 'Hear a mix',
  rating: { value: 4.8, count: 1204 },
  heroLabel: 'fairy lights left on',
} as const;

export const PROOF = {
  count: '412,000 nights listened through',
  logos: ['NIGHT BUS FM', 'THE QUIET HOUR', 'TAPE DECK', 'PLAIN PRESS'],
} as const;

export const BENTO = {
  image: { title: 'One room, one lamp', body: 'Artists record in bedrooms, not studios. We leave the room noise in.' },
  number: { value: '1,840', label: 'tracks added this month' },
  typed: [
    {
      title: 'Mixes that end when you fall asleep',
      body: 'Every mix fades over its last three minutes instead of stopping dead.',
    },
    {
      title: 'No autoplay into something loud',
      body: 'We will never follow a quiet song with a bright one. It is a rule, not a setting.',
    },
  ],
} as const;

export const TESTIMONIAL = {
  quote:
    'I put it on at half eleven and woke up at seven with the same mix still going, quietly, like it had been keeping an eye on me.',
  name: 'Marlow',
  detail: 'listening since last winter',
  bandLabel: 'the room it was recorded in',
} as const;

export const PRICING = {
  eyebrow: 'Bedroom Pop+',
  title: 'Seven nights, then decide',
  timeline: [
    'Free for 7 days — from today.',
    'No payment due now.',
    'We email you on day 5 so it is never a surprise.',
    'Cancel any time in two taps, keep your library.',
  ],
  cta: 'Start listening',
  price: '£3.50',
  period: 'a month after the trial',
  features: [
    'Offline mixes for the tunnel',
    'Lossless room noise',
    'Save every mix you fell asleep to',
    'One share card a week, no watermark',
  ],
} as const;

export const FAQ = [
  {
    question: 'Is this just a playlist app?',
    answer:
      'No. Every mix is built for one hour of one night, and it fades rather than stopping. Playlists do not do that.',
  },
  {
    question: 'What happens after the trial?',
    answer:
      'You get an email on day 5. If you do nothing, the trial simply ends and your saved mixes stay saved.',
  },
  {
    question: 'Why so many small artists?',
    answer:
      'Because the quiet ones record at home, and home recordings have the room in them. That is the whole sound.',
  },
] as const;

export const CLOSING = {
  headline: 'Find the song that matches tonight',
  body: 'Same words as the top of the page, on purpose.',
  cta: 'Start listening',
  label: 'still up?',
} as const;

export const FOOTER = {
  legal: ['Privacy', 'Terms', 'Artist submissions'],
  socials: ['Instagram', 'Bandcamp', 'RSS'],
  copyright: '© 2026 Bedroom Pop — a BEDROOM POP theme demo. Nothing here is for sale.',
} as const;
