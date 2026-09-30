/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        canvas: 'var(--tp-bg)',
        surface: 'var(--tp-surf)',
        sunken: 'var(--tp-surf-2)',
        ink: 'var(--tp-ink)',
        muted: 'var(--tp-mute)',
        accent: 'var(--tp-acc)',
        'accent-secondary': 'var(--tp-acc-2)',
        'accent-ink': 'var(--tp-acc-ink)',
        line: 'var(--tp-line)',
      },
      fontFamily: {
        display: ['var(--tp-font-display)'],
        sans: ['var(--tp-font-body)'],
        mono: ['var(--tp-font-mono)'],
      },
      borderRadius: {
        card: 'var(--tp-r)',
        control: 'var(--tp-r-sm)',
        pill: 'var(--tp-r-btn)',
      },
      boxShadow: {
        soft: 'var(--tp-sh)',
        subtle: 'var(--tp-sh-sm)',
      },
    },
  },
  plugins: [],
};
