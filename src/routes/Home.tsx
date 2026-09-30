import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { CoverArt } from '../components/CoverArt';
import { Icon, type IconName } from '../components/Icon';
import { Rating } from '../components/Rating';
import { initReveals } from '../lib/reveal';
import { HERO } from '../data/landing';

type Demo = {
  to: string;
  name: string;
  kind: string;
  tagline: string;
  bullets: string[];
  seed: string;
  icon: IconName;
}

const DEMOS: Demo[] = [
  {
    to: '/tapes',
    name: 'Tapes',
    kind: 'Lo-fi listening app',
    tagline: 'A dashboard, a swipe onboarding and a now-playing screen for people who listen with one earbud in.',
    bullets: ['Dashboard feed', 'Swipe onboarding', 'Now playing'],
    seed: 'lamp',
    icon: 'headphones',
  },
  {
    to: '/static',
    name: 'Sleep Static',
    kind: 'Podcast app',
    tagline: 'Episode feed, show pages, a listen-later list and a player that remembers where you stopped.',
    bullets: ['Episode feed', 'Show pages', 'Listen later'],
    seed: 'static-sincerity',
    icon: 'mic',
  },
  {
    to: '/diary',
    name: 'Song Diary',
    kind: 'Journal',
    tagline: 'Log the song you had on tonight, how it went, and how many nights in a row you have shown up.',
    bullets: ['Daily check-in', 'Entries feed', 'Stats'],
    seed: 'polaroid-wall',
    icon: 'book',
  },
  {
    to: '/lowlight',
    name: 'Lowlight',
    kind: 'Dating app',
    tagline: 'A swipe deck, matches list, chat and profile — for people who are awake at the same hour as you.',
    bullets: ['Swipe deck', 'Matches', 'Chat'],
    seed: 'marlow',
    icon: 'heart',
  },
  {
    to: '/landing',
    name: 'Bedroom Pop+',
    kind: 'Landing page',
    tagline: 'The nine-block marketing page for the same music app, in the same tokens.',
    bullets: ['Nav, hero, bento', 'Pricing, FAQ', 'Closing CTA'],
    seed: 'fairy-light-hours',
    icon: 'sparkle',
  },
];

const SWATCHES = [
  { name: 'canvas', value: '--tp-canvas', background: 'var(--tp-canvas)' },
  { name: 'surface', value: '--tp-surf', background: 'var(--tp-surf)' },
  { name: 'sunken', value: '--tp-surf-2', background: 'var(--tp-surf-2)' },
  { name: 'accent', value: '--tp-acc', background: 'var(--tp-acc)' },
  { name: 'accent 2', value: '--tp-acc-2', background: 'var(--tp-acc-2)' },
  { name: 'ink', value: '--tp-ink', background: 'var(--tp-ink)' },
  { name: 'mute', value: '--tp-mute', background: 'var(--tp-mute)' },
  { name: 'line', value: '--tp-line', background: 'var(--tp-line)' },
];

export function Home() {
  useEffect(() => {
    const stop = initReveals();
    return stop;
  }, []);

  return (
    <div className="site tp-web-stage" data-reveal-root>
      <div className="tp-fx" aria-hidden="true" />

      <nav className="site__nav">
        <span className="nav__logo">
          <span className="dot dot--live" aria-hidden="true" />
          BEDROOM POP
        </span>
        <div className="nav__links">
          <a className="nav__link" href="#demos">
            The demos
          </a>
          <a className="nav__link" href="#tokens">
            Tokens
          </a>
          <Link className="btn btn--primary btn--sm" to="/landing">
            See the landing page
          </Link>
          <Link className="btn btn--ghost btn--sm" to="/auth/login">
            Log in
          </Link>
        </div>
      </nav>

      <header className="hero shell">
        <div className="media hero__media" aria-hidden="true">
          <img src="/images/cover-lamp.png" alt="" />
          <span className="media__overlay" />
        </div>

        <div className="plate hero__plate" data-reveal="theme" data-reveal-index="0">
          <p className="t-eyebrow">Design Studio theme pack · bedroom-pop</p>
          <h1 className="t-h1" style={{ marginTop: 8 }}>
            Five working apps, one set of tokens
          </h1>
          <p className="t-lead" style={{ marginTop: 10 }}>
            Fairy lights, polaroids, guitars on unmade beds. Everything below is styled only with
            <span className="t-mono"> var(--tp-*) </span>
            — change <span className="t-mono">--tp-h</span> on the root element and the whole pack re-skins.
          </p>

          <div className="hero__actions" style={{ marginTop: 16 }}>
            <a className="btn btn--primary" href="#demos">
              Open a demo
              <Icon name="arrow-right" size={17} />
            </a>
            <Link className="btn btn--ghost" to="/tapes">
              <Icon name="play" size={15} />
              Start with Tapes
            </Link>
          </div>

          <div className="hero__stats" style={{ marginTop: 14 }}>
            <Rating value={HERO.rating.value} count={HERO.rating.count} />
            <span className="t-small t-mute">Restrained intensity · instrumental serif + outfit</span>
          </div>
        </div>
      </header>

      <div className="strip">
        <span className="t-eyebrow">Built from</span>
        <div className="strip__logos">
          <span className="strip__logo">INSTRUMENT SERIF</span>
          <span className="strip__logo">OUTFIT</span>
          <span className="strip__logo">JETBRAINS MONO</span>
          <span className="strip__logo">OKLCH HUE 20</span>
          <span className="strip__logo">22PX RADIUS</span>
        </div>
      </div>

      <section className="site__section shell" id="demos">
        <div className="screen-head">
          <div>
            <p className="t-eyebrow">The pack</p>
            <h2 className="screen-title">Pick something to break</h2>
          </div>
          <p className="t-small t-mute hide-sm" style={{ maxWidth: 280 }}>
            Each demo is a separate product with its own routes, data and interactions. All five share
            the same components and tokens.
          </p>
        </div>

        <div className="hub__grid">
          {DEMOS.map((demo, index) => (
            <article
              key={demo.to}
              className={`card demo-card${index === 4 ? ' demo-card--wide' : ''}`}
              data-reveal="theme"
              data-reveal-index={index % 3}
            >
              <div className="demo-card__art">
                <CoverArt
                  seed={demo.seed}
                  ratio="banner"
                  sticker={demo.kind}
                  label={demo.name}
                  sublabel={demo.bullets.join(' · ')}
                />
              </div>

              <div className="demo-card__head">
                <div>
                  <h3 className="demo-card__title">{demo.name}</h3>
                  <p className="t-small t-mute">{demo.tagline}</p>
                </div>
                <span className="iconbtn" aria-hidden="true">
                  <Icon name={demo.icon} size={20} />
                </span>
              </div>

              <ul className="hub__list">
                {demo.bullets.map((bullet) => (
                  <li key={bullet} className="row t-small t-mute">
                    <Icon name="check" size={14} />
                    {bullet}
                  </li>
                ))}
              </ul>

              <div className="demo-card__foot">
                <span className="t-mono t-mute">{demo.to}</span>
                <Link className="btn btn--ghost btn--sm" to={demo.to}>
                  Open
                  <Icon name="arrow-up-right" size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="site__section shell" id="tokens" data-reveal="theme">
        <p className="t-eyebrow">Tokens</p>
        <h2 className="screen-title" style={{ marginBottom: 10 }}>
          Nothing here is a raw value
        </h2>
        <p className="t-lead" style={{ maxWidth: 640, marginBottom: 18 }}>
          Every colour, radius, shadow, font and duration in the pack resolves to a custom property on the
          themed root element.
        </p>

        <div className="tokens">
          {SWATCHES.map((swatch) => (
            <div className="swatch" key={swatch.name}>
              <span className="swatch__chip" style={{ background: swatch.background }} />
              <span className="swatch__name">{swatch.name}</span>
              <span className="swatch__value">{swatch.value}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="shell">
        <footer className="footer">
          <span>BEDROOM POP — a Design Studio theme demo.</span>
          <span className="footer__links">
            <a href="#demos">Demos</a>
            <a href="#tokens">Tokens</a>
            <Link to="/landing">Landing page</Link>
          </span>
          <span className="t-mono">data-theme="bedroom-pop"</span>
        </footer>
      </div>
    </div>
  );
}
