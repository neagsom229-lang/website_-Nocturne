import type { ReactNode } from 'react';

/**
 * Every glyph is drawn on a 24x24 grid and inherits `currentColor`, so an icon
 * always picks up the theme token of whatever it sits in.
 */
export const ICON_GLYPHS = {
  home: (
    <>
      <path d="M3.6 10.6 12 3.5l8.4 7.1" />
      <path d="M5.9 9.4V20a.6.6 0 0 0 .6.6h11a.6.6 0 0 0 .6-.6V9.4" />
    </>
  ),
  dial: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M15.4 8.6 13 13l-4.4 2.4L11 11z" />
    </>
  ),
  library: (
    <>
      <path d="M4.4 5.2h3.9v13.6H4.4z" />
      <path d="M10.6 5.2h3.9v13.6h-3.9z" />
      <path d="M17.6 5.8l3.4 13.2" />
    </>
  ),
  heart: (
    <path d="M12 20.4 4.9 13.5a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6a4.6 4.6 0 0 1 6.5 6.5z" />
  ),
  'heart-filled': (
    <path
      d="M12 20.4 4.9 13.5a4.6 4.6 0 0 1 6.5-6.5l.6.6.6-.6a4.6 4.6 0 0 1 6.5 6.5z"
      fill="currentColor"
    />
  ),
  user: (
    <>
      <circle cx="12" cy="8.6" r="3.9" />
      <path d="M4.6 20.4c1.5-3.7 4.1-5.4 7.4-5.4s5.9 1.7 7.4 5.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9.4" cy="9" r="3.4" />
      <path d="M3.4 19.8c1.3-3.2 3.4-4.7 6-4.7s4.7 1.5 6 4.7" />
      <path d="M16.4 6.2a3.2 3.2 0 0 1 0 6.2" />
      <path d="M17.4 15.6c2 .5 3.2 2 3.9 4.2" />
    </>
  ),
  play: <path d="M8.4 5.3v13.4L19 12z" fill="currentColor" />,
  pause: (
    <>
      <path d="M9.2 5.4v13.2" />
      <path d="M14.8 5.4v13.2" />
    </>
  ),
  'skip-back': (
    <>
      <path d="M18.4 5.6v12.8L9.2 12z" fill="currentColor" />
      <path d="M6 5.6v12.8" />
    </>
  ),
  'skip-forward': (
    <>
      <path d="M5.6 5.6v12.8L14.8 12z" fill="currentColor" />
      <path d="M18 5.6v12.8" />
    </>
  ),
  rewind: (
    <>
      <path d="M11.6 6.4v11.2L4.8 12z" fill="currentColor" />
      <path d="M19.6 6.4v11.2L12.8 12z" fill="currentColor" />
    </>
  ),
  forward: (
    <>
      <path d="M12.4 6.4v11.2L19.2 12z" fill="currentColor" />
      <path d="M4.4 6.4v11.2L11.2 12z" fill="currentColor" />
    </>
  ),
  shuffle: (
    <>
      <path d="M3.8 7.2h3.1c4.8 0 5.4 9.6 10.2 9.6h3.1" />
      <path d="M3.8 16.8h3.1c1.7 0 2.9-1.2 4-2.7" />
      <path d="M17.3 4.4l2.9 2.8-2.9 2.8" />
      <path d="M17.3 14l2.9 2.8-2.9 2.8" />
    </>
  ),
  repeat: (
    <>
      <path d="M4.8 9.2V8.4a3.2 3.2 0 0 1 3.2-3.2h8.4" />
      <path d="M19.2 14.8v.8a3.2 3.2 0 0 1-3.2 3.2H7.6" />
      <path d="M14.2 2.8 17 5.2l-2.8 2.4" />
      <path d="M9.8 21.2 7 18.8l2.8-2.4" />
    </>
  ),
  volume: (
    <>
      <path d="M4.6 9.8h3.1l4.2-3.6v11.6L7.7 14.2H4.6z" />
      <path d="M15.2 9.6a3.4 3.4 0 0 1 0 4.8" />
      <path d="M17.8 7a7 7 0 0 1 0 10" />
    </>
  ),
  'volume-off': (
    <>
      <path d="M4.6 9.8h3.1l4.2-3.6v11.6L7.7 14.2H4.6z" />
      <path d="M15.4 10.4 19.8 14.8" />
      <path d="M19.8 10.4 15.4 14.8" />
    </>
  ),
  search: (
    <>
      <circle cx="10.6" cy="10.6" r="6.4" />
      <path d="M15.4 15.4 20 20" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  bookmark: <path d="M7.2 4.6h9.6a1 1 0 0 1 1 1V20l-5.8-3.5L6.2 20V5.6a1 1 0 0 1 1-1Z" />,
  'bookmark-filled': (
    <path
      d="M7.2 4.6h9.6a1 1 0 0 1 1 1V20l-5.8-3.5L6.2 20V5.6a1 1 0 0 1 1-1Z"
      fill="currentColor"
    />
  ),
  plus: (
    <>
      <path d="M12 5.6v12.8" />
      <path d="M5.6 12h12.8" />
    </>
  ),
  minus: <path d="M5.6 12h12.8" />,
  'chevron-left': <path d="M14.4 5.8 8.4 12l6 6.2" />,
  'chevron-right': <path d="M9.6 5.8l6 6.2-6 6.2" />,
  'chevron-down': <path d="M5.8 9.4 12 15.6l6.2-6.2" />,
  'chevron-up': <path d="M5.8 14.6 12 8.4l6.2 6.2" />,
  close: (
    <>
      <path d="M6.2 6.2 17.8 17.8" />
      <path d="M17.8 6.2 6.2 17.8" />
    </>
  ),
  check: <path d="M5.2 12.6l4.4 4.4L18.8 7.2" />,
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M8.4 12.2l2.5 2.5 4.8-5" />
    </>
  ),
  star: <path d="M12 4.2l2.5 5 5.4.8-3.9 3.8.9 5.4-4.9-2.6-4.9 2.6.9-5.4L4.1 10l5.4-.8z" />,
  'star-filled': (
    <path
      d="M12 4.2l2.5 5 5.4.8-3.9 3.8.9 5.4-4.9-2.6-4.9 2.6.9-5.4L4.1 10l5.4-.8z"
      fill="currentColor"
    />
  ),
  share: (
    <>
      <path d="M12 4v10" />
      <path d="M8.4 7.4 12 3.8l3.6 3.6" />
      <path d="M5.6 13.4V18.6a1.2 1.2 0 0 0 1.2 1.2h10.4a1.2 1.2 0 0 0 1.2-1.2v-5.2" />
    </>
  ),
  more: (
    <>
      <circle cx="5.6" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18.4" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  bell: (
    <>
      <path d="M6.4 10.4a5.6 5.6 0 0 1 11.2 0v4l1.4 2.6H5l1.4-2.6z" />
      <path d="M10 19.4a2.1 2.1 0 0 0 4 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="2.9" />
      <path d="M12 3.4v2.2M12 18.4v2.2M4.4 12h2.2M17.4 12h2.2M6.6 6.6l1.6 1.6M15.8 15.8l1.6 1.6M17.4 6.6l-1.6 1.6M8.2 15.8l-1.6 1.6" />
    </>
  ),
  calendar: (
    <>
      <path d="M4.8 6.6h14.4a1 1 0 0 1 1 1v11.2a1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1V7.6a1 1 0 0 1 1-1Z" />
      <path d="M3.8 10.4h16.4" />
      <path d="M8.4 3.8v4.2M15.6 3.8v4.2" />
    </>
  ),
  edit: (
    <>
      <path d="M4.6 19.4l.9-4L16 4.9a1.6 1.6 0 0 1 2.3 0l.8.8a1.6 1.6 0 0 1 0 2.3L8.6 18.5z" />
      <path d="M14.8 6.2l3 3" />
    </>
  ),
  mic: (
    <>
      <path d="M12 3.8a2.9 2.9 0 0 0-2.9 2.9v5a2.9 2.9 0 0 0 5.8 0v-5A2.9 2.9 0 0 0 12 3.8Z" />
      <path d="M6.4 11.4a5.6 5.6 0 0 0 11.2 0" />
      <path d="M12 17v3.2" />
    </>
  ),
  message: (
    <path d="M4.6 6.6a1.6 1.6 0 0 1 1.6-1.6h11.6a1.6 1.6 0 0 1 1.6 1.6v8a1.6 1.6 0 0 1-1.6 1.6H9.4L5.6 20v-2.8a1 1 0 0 1-1-1z" />
  ),
  send: (
    <>
      <path d="M20 4.6 3.8 11l6.4 2.2L12.4 20z" />
      <path d="M10.2 13.2 20 4.6" />
    </>
  ),
  flame: (
    <path d="M12 3.6c3 3.2 5.6 5.6 5.6 9.4a5.6 5.6 0 0 1-11.2 0c0-1.9.8-3.3 1.9-4.6.4 1.2 1.2 2 2.1 2.2.5-2.6.6-4.8 1.6-7Z" />
  ),
  sparkle: (
    <>
      <path d="M12 3.6l1.8 5 5 1.8-5 1.8L12 17.2l-1.8-5-5-1.8 5-1.8z" />
      <path d="M18.4 15.6l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" />
    </>
  ),
  headphones: (
    <>
      <path d="M4.6 15.4v-3.2a7.4 7.4 0 0 1 14.8 0v3.2" />
      <path d="M4.6 14.4h2.6a1 1 0 0 1 1 1v3.2a1 1 0 0 1-1 1H5.6a1 1 0 0 1-1-1z" />
      <path d="M19.4 14.4h-2.6a1 1 0 0 0-1 1v3.2a1 1 0 0 0 1 1h1.6a1 1 0 0 0 1-1z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.4V12l3.2 2" />
    </>
  ),
  trash: (
    <>
      <path d="M4.8 7.2h14.4" />
      <path d="M9.4 7.2V5.4a1 1 0 0 1 1-1h3.2a1 1 0 0 1 1 1v1.8" />
      <path d="M6.6 7.2l.8 12a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l.8-12" />
    </>
  ),
  lock: (
    <>
      <path d="M6.6 10.6h10.8a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6.6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z" />
      <path d="M8.8 10.6V8.2a3.2 3.2 0 0 1 6.4 0v2.4" />
    </>
  ),
  book: (
    <>
      <path d="M4.6 5.4A1.4 1.4 0 0 1 6 4h5.4v15.4H6a1.4 1.4 0 0 0-1.4 1.4z" />
      <path d="M19.4 5.4A1.4 1.4 0 0 0 18 4h-5.4v15.4H18a1.4 1.4 0 0 1 1.4 1.4z" />
    </>
  ),
  moon: <path d="M19.4 15.6A8 8 0 0 1 8.4 4.6a8.4 8.4 0 1 0 11 11Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
  list: (
    <>
      <path d="M8.4 7h11" />
      <path d="M8.4 12h11" />
      <path d="M8.4 17h11" />
      <circle cx="4.8" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.8" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.8" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  filter: (
    <>
      <path d="M4.4 6.4h15.2" />
      <path d="M6.8 12h10.4" />
      <path d="M9.6 17.6h5.8" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M4.6 12h14.8" />
      <path d="M13.4 6l6 6-6 6" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="M19.4 12H4.6" />
      <path d="M10.6 6l-6 6 6 6" />
    </>
  ),
  'arrow-up-right': (
    <>
      <path d="M6.4 17.6 17.6 6.4" />
      <path d="M9.4 6.4h8.2v8.2" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M7.6 10.8 12 15.2l4.4-4.4" />
      <path d="M4.8 19.4h14.4" />
    </>
  ),
  mail: (
    <>
      <path d="M4.4 6.6h15.2a1 1 0 0 1 1 1v9.4a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1V7.6a1 1 0 0 1 1-1Z" />
      <path d="m3.8 7.4 8.2 6 8.2-6" />
    </>
  ),
  camera: (
    <>
      <path d="M4.4 8.6h3l1.4-2.2h6.4l1.4 2.2h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4.4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.2" r="3.2" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M12 20.6s6.4-5.6 6.4-10.4a6.4 6.4 0 0 0-12.8 0C5.6 15 12 20.6 12 20.6Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  coffee: (
    <>
      <path d="M5.4 8.4h11.2v6.2a4 4 0 0 1-4 4H9.4a4 4 0 0 1-4-4z" />
      <path d="M16.6 9.8h1.6a2.4 2.4 0 0 1 0 4.8h-1.6" />
      <path d="M8.4 4.6v1.4M12 4v2" />
    </>
  ),
  vinyl: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  tape: (
    <>
      <path d="M4.6 5.6h14.8a1 1 0 0 1 1 1v10.8a1 1 0 0 1-1 1H4.6a1 1 0 0 1-1-1V6.6a1 1 0 0 1 1-1Z" />
      <circle cx="9" cy="12" r="2.6" />
      <circle cx="15" cy="12" r="2.6" />
    </>
  ),
  gauge: (
    <>
      <path d="M4.4 16.6a8 8 0 1 1 15.2 0" />
      <path d="M12 12.6 15.6 9" />
    </>
  ),
  'trend-up': (
    <>
      <path d="M4.4 16.4 10 10.8l3.4 3.4 6.2-6.2" />
      <path d="M14.6 8h5v5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.8 5.4 6.4v5.2c0 4 2.7 7 6.6 8.6 3.9-1.6 6.6-4.6 6.6-8.6V6.4z" />
      <path d="M9.4 12.2l1.9 1.9 3.4-3.6" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.6 12a7.6 7.6 0 1 1-2.6-5.7" />
      <path d="M19.8 4.6v3.8h-3.8" />
    </>
  ),
  'wifi-off': (
    <>
      <path d="M4 9.4a12 12 0 0 1 16 0" />
      <path d="M7 12.6a7.6 7.6 0 0 1 10 0" />
      <path d="M9.8 15.8a3.4 3.4 0 0 1 4.4 0" />
      <path d="M4.6 4.6 19.4 19.4" />
    </>
  ),
  quote: (
    <>
      <path d="M9.4 6.4c-3 1.2-4.6 3.4-4.6 6.6 0 2.4 1.3 4 3.3 4 1.8 0 3.1-1.3 3.1-3.1 0-1.7-1.2-2.9-2.8-2.9-.3 0-.6 0-.8.1.4-1.6 1.5-2.9 3.2-3.7z" />
      <path d="M19 6.4c-3 1.2-4.6 3.4-4.6 6.6 0 2.4 1.3 4 3.3 4 1.8 0 3.1-1.3 3.1-3.1 0-1.7-1.2-2.9-2.8-2.9-.3 0-.6 0-.8.1.4-1.6 1.5-2.9 3.2-3.7z" />
    </>
  ),
  flag: (
    <>
      <path d="M6.4 20.4V4.6" />
      <path d="M6.4 5.4h10.4l-2 3.6 2 3.6H6.4" />
    </>
  ),
  'smile-plus': (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M8.6 14.4a4.4 4.4 0 0 0 6.8 0" />
      <circle cx="9.4" cy="10.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="10.2" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  'play-circle': (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M10.4 8.8 15.6 12l-5.2 3.2z" fill="currentColor" />
    </>
  ),
  'pause-circle': (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M10.4 8.8v6.4" />
      <path d="M13.6 8.8v6.4" />
    </>
  ),
  'picture-in-picture': (
    <>
      <rect x="3.8" y="5" width="16.4" height="14" rx="1.6" />
      <path d="M12.6 12.2h5.2v4.2h-5.2z" />
    </>
  ),
  fullscreen: (
    <>
      <path d="M8.4 4.4H4.8v3.8M15.6 4.4h3.6v3.8M4.8 15.8v3.8h3.6M19.2 15.8v3.8h-3.6" />
    </>
  ),
  grid: (
    <>
      <rect x="4.4" y="4.4" width="6" height="6" rx="1" />
      <rect x="13.6" y="4.4" width="6" height="6" rx="1" />
      <rect x="4.4" y="13.6" width="6" height="6" rx="1" />
      <rect x="13.6" y="13.6" width="6" height="6" rx="1" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICON_GLYPHS;
