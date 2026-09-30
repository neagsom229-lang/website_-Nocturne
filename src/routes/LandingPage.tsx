import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { CoverArt } from '../components/CoverArt';
import { Icon } from '../components/Icon';
import { initReveals } from '../lib/reveal';
import { BENTO, CLOSING, FAQ, FOOTER, HERO, NAV_LINKS, PRICING, PROOF, TESTIMONIAL } from '../data/landing';

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  useEffect(() => initReveals(), []);

  return (
    <div className="site tp-web-stage landing-page" data-reveal-root>
      <div className="tp-fx" aria-hidden="true" />
      <nav className="site__nav landing-nav" aria-label="Main navigation">
        <Link to="/" className="nav__logo"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
        <div className="nav__links">
          {NAV_LINKS.map((link) => <a className="nav__link" href={link.href} key={link.href}>{link.label}</a>)}
          <Link className="btn btn--primary btn--sm" to="/tapes">{HERO.primaryCta}</Link>
          <Link className="btn btn--ghost btn--sm" to="/auth/register">Make an account</Link>
        </div>
      </nav>

      <header className="hero shell landing-hero">
        <div className="media hero__media landing-hero__media" aria-hidden="true">
          <CoverArt seed="lamp" ratio="fill" />
          <span className="media__overlay" />
          <span className="landing-hero__stamp">REC · 02:17 AM</span>
        </div>
        <div className="plate hero__plate landing-hero__plate" data-reveal="theme">
          <p className="t-eyebrow">{HERO.eyebrow} · BEDROOM POP+</p>
          <h1 className="t-hero">{HERO.headline}</h1>
          <p className="t-lead">{HERO.mechanism}</p>
          <div className="hero__actions landing-actions">
            <Link to="/tapes" className="btn btn--primary">{HERO.primaryCta}<Icon name="arrow-right" size={17} /></Link>
            <a href="#mixes" className="btn btn--ghost"><Icon name="play" size={15} />{HERO.secondaryCta}</a>
          </div>
          <div className="hero__stats">
            <span className="landing-stars" aria-label={`${HERO.rating.value} stars`} aria-hidden="true">★★★★★</span>
            <span className="t-small t-mute">{HERO.rating.value} from {HERO.rating.count.toLocaleString()} tired people</span>
          </div>
        </div>
      </header>

      <div className="strip landing-proof" aria-label="Listening community">
        <span className="t-eyebrow">{PROOF.count}</span>
        <div className="strip__logos">{PROOF.logos.map((logo) => <span className="strip__logo" key={logo}>{logo}</span>)}</div>
      </div>

      <section className="site__section shell" id="how">
        <div className="screen-head landing-section-head">
          <div><p className="t-eyebrow">Not another endless playlist</p><h2 className="screen-title">Built for the hour<br />you’re actually in.</h2></div>
          <p className="t-small t-mute hide-sm">Small songs, soft edges, and enough quiet to hear yourself think.</p>
        </div>
        <div className="bento landing-bento">
          <article className="plate bento__cell bento__cell--wide landing-bento__room" data-reveal="theme">
            <span className="landing-bento__art"><CoverArt seed="polaroid-wall" ratio="fill" /></span>
            <p className="t-eyebrow">THE ROOM STAYS IN THE RECORDING</p>
            <h3 className="t-h2">{BENTO.image.title}</h3>
            <p className="t-small t-mute">{BENTO.image.body}</p>
          </article>
          <article className="card bento__cell landing-bento__number" data-reveal="theme">
            <span className="t-eyebrow">FROM BEDROOMS, THIS MONTH</span>
            <strong className="bento__number">{BENTO.number.value}</strong>
            <p className="t-small t-mute">{BENTO.number.label}. Still a little rough around the edges.</p>
          </article>
          {BENTO.typed.map((item, index) => (
            <article className="card bento__cell landing-bento__rule" key={item.title} data-reveal="theme" data-reveal-index={index}>
              <span className="landing-bento__number">0{index + 1}</span>
              <h3 className="t-h3">{item.title}</h3>
              <p className="t-small t-mute">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site__section shell landing-mixes" id="mixes">
        <div className="screen-head landing-section-head">
          <div><p className="t-eyebrow">A few rooms you can borrow</p><h2 className="screen-title">Tonight sounds like…</h2></div>
          <Link to="/tapes" className="music-text-link">Meet the mixes <Icon name="arrow-right" size={15} /></Link>
        </div>
        <div className="landing-mix-grid">
          {[
            { seed: 'rain-on-window', title: 'rain on the window', detail: 'soft guitar, slower thoughts' },
            { seed: 'cassette-desk', title: 'tape hiss & traffic', detail: 'for the long way home' },
            { seed: 'moonlit-sill', title: 'songs for a slow morning', detail: 'you can get up later' },
          ].map((mix) => (
            <Link to="/tapes" className="landing-mix" key={mix.title}>
              <span className="landing-mix__art"><CoverArt seed={mix.seed} ratio="square" /></span>
              <strong>{mix.title}</strong><small>{mix.detail}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="band landing-testimonial" data-reveal="theme">
        <div className="media band__media" aria-hidden="true"><CoverArt seed="fairy-light-hours" ratio="fill" /><span className="media__overlay" /></div>
        <div className="plate band__plate">
          <p className="t-eyebrow">{TESTIMONIAL.bandLabel} · A LISTENER NOTE</p>
          <blockquote className="band__quote">“{TESTIMONIAL.quote}”</blockquote>
          <div className="landing-testimonial__byline"><span className="landing-testimonial__avatar">M</span><span><strong>{TESTIMONIAL.name}</strong><small>{TESTIMONIAL.detail}</small></span></div>
        </div>
      </section>

      <section className="site__section shell" id="pricing">
        <div className="screen-head landing-section-head">
          <div><p className="t-eyebrow">{PRICING.eyebrow}</p><h2 className="screen-title">{PRICING.title}</h2></div>
          <p className="t-small t-mute">No card required to hear the first song.</p>
        </div>
        <div className="tier landing-tier">
          <article className="plate landing-price-card">
            <p className="t-eyebrow">THE WHOLE LISTENING ROOM</p>
            <div className="tier__price"><span className="tier__amount">{PRICING.price}</span><span className="t-small t-mute">{PRICING.period}</span></div>
            <Link to="/tapes" className="btn btn--primary landing-price-cta">{PRICING.cta}<Icon name="arrow-right" size={16} /></Link>
            <ul className="tier__list">
              {PRICING.features.map((feature) => <li className="tier__item" key={feature}><Icon name="check-circle" size={17} />{feature}</li>)}
            </ul>
          </article>
          <div className="landing-trial">
            <p className="t-eyebrow">NO SURPRISES, EVER</p>
            {PRICING.timeline.map((line, index) => (
              <div className="landing-trial__step" key={line}>
                <span>{String(index + 1).padStart(2, '0')}</span><p>{line}</p>
              </div>
            ))}
            <p className="t-small t-mute">This is a theme demo; the checkout is not connected.</p>
          </div>
        </div>
      </section>

      <section className="site__section shell" id="faq">
        <div className="screen-head landing-section-head">
          <div><p className="t-eyebrow">The honest answers</p><h2 className="screen-title">A few things<br />you might be wondering.</h2></div>
        </div>
        <div className="faq landing-faq">
          {FAQ.map((item, index) => (
            <article className="card faq__item" data-open={openFaq === index} key={item.question}>
              <button className="faq__q" type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                {item.question}<Icon name="chevron-down" size={17} />
              </button>
              {openFaq === index ? <p className="faq__a">{item.answer}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="closing landing-closing" data-reveal="theme">
        <div className="media closing__media" aria-hidden="true"><CoverArt seed="lamp" ratio="fill" /><span className="media__overlay" /></div>
        <div className="closing__inner shell">
          <div className="plate landing-closing__plate">
            <p className="t-eyebrow">{CLOSING.label} · THE LIGHT’S STILL ON</p>
            <h2 className="t-hero">{CLOSING.headline}</h2>
            <p className="t-lead">{CLOSING.body}</p>
            <Link to="/tapes" className="btn btn--primary">{CLOSING.cta}<Icon name="arrow-right" size={17} /></Link>
          </div>
        </div>
      </section>

      <footer className="shell landing-footer">
        <Link to="/" className="nav__logo"><span className="dot dot--live" aria-hidden="true" /> BEDROOM POP</Link>
        <span className="t-small t-mute">{FOOTER.copyright}</span>
        <nav className="landing-footer__links" aria-label="Footer links">
          {FOOTER.legal.map((item) => <span key={item}>{item}</span>)}
        </nav>
        <div className="landing-footer__links">{FOOTER.socials.map((social) => <span key={social}>{social}</span>)}</div>
      </footer>
    </div>
  );
}
