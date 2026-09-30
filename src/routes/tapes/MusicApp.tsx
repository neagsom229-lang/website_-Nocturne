import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AppShell } from '../../components/AppShell';
import { CoverArt } from '../../components/CoverArt';
import { Icon } from '../../components/Icon';
import { PageBar } from '../../components/PageBar';
import { TabBar } from '../../components/TabBar';
import type { Mix, Track } from '../../data/types';
import { formatClock } from '../../lib/hooks';
import {
  fetchMixes,
  fetchNowPlaying,
  fetchSwipes,
  saveSwipe,
  updateNowPlaying,
  type MixSwipe,
  type NowPlaying,
} from '../../lib/musicApi';

const MUSIC_TABS = [
  { to: '/tapes', label: 'Home', icon: 'home' as const, end: true },
  { to: '/tapes/discover', label: 'Discover', icon: 'dial' as const },
];

const MOOD_CHOICES = ['Need to focus', 'Winding down', 'A little lonely', 'Out for a late drive'];

function MusicFrame({ children }: { children: ReactNode }) {
  return (
    <AppShell
      bar={
        <PageBar
          title="tapes"
          eyebrow="BEDROOM POP · LISTENING ROOM"
          actions={
            <span className="music-live" aria-label="Demo listening room">
              <span className="dot dot--live" aria-hidden="true" />
              2:17 am
            </span>
          }
        />
      }
      nav={<TabBar items={MUSIC_TABS} fab={{ to: '/tapes/now-playing', label: 'Now playing', icon: 'play' }} />}
    >
      <div className="music-content">{children}</div>
    </AppShell>
  );
}

function MusicError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="music-error" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

function SectionTitle({ label, title, link }: { label: string; title: string; link?: string }) {
  return (
    <div className="music-section-title">
      <div>
        <p className="t-eyebrow">{label}</p>
        <h2 className="t-h2">{title}</h2>
      </div>
      {link ? (
        <Link className="music-text-link" to={link}>
          See all <Icon name="arrow-right" size={15} />
        </Link>
      ) : null}
    </div>
  );
}

export function MusicHome() {
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function loadHome() {
    setError('');
    try {
      const [loadedMixes, loadedNowPlaying] = await Promise.all([fetchMixes(), fetchNowPlaying()]);
      setMixes(loadedMixes);
      setNowPlaying(loadedNowPlaying);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your music.');
    }
  }

  useEffect(() => {
    void loadHome();
  }, []);

  async function play(mix: Mix, track: Track) {
    try {
      setNowPlaying(await updateNowPlaying(mix, track, true));
      navigate('/tapes/now-playing');
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : 'Could not start this mix.');
    }
  }

  const featured = mixes[0];

  return (
    <MusicFrame>
      {error ? <MusicError message={error} onRetry={() => void loadHome()} /> : null}
      <header className="music-greeting">
        <p className="t-eyebrow">Wednesday, September 30</p>
        <h1 className="t-h1">A softer place<br />to land tonight.</h1>
        <p className="t-body">No skips, no rush. Just a little room to breathe.</p>
      </header>

      {featured ? (
        <section className="music-featured" aria-labelledby="featured-title">
          <div className="music-featured__art">
            <CoverArt seed={featured.cover} ratio="fill" />
            <span className="music-featured__glow" aria-hidden="true" />
          </div>
          <div className="music-featured__copy">
            <p className="t-eyebrow">A mix for this hour</p>
            <h2 id="featured-title" className="music-featured__title">{featured.title}</h2>
            <p className="t-small t-mute">{featured.note}</p>
            <button
              type="button"
              className="btn btn--primary music-featured__play"
              onClick={() => void play(featured, featured.tracks[0])}
              disabled={!featured.tracks[0]}
            >
              <Icon name="play" size={16} /> Let it play
            </button>
          </div>
          <span className="music-featured__time t-mono">SIDE A · 03:14</span>
        </section>
      ) : !error ? <p className="t-small t-mute">Finding the right tape for tonight…</p> : null}

      <section className="music-section" aria-labelledby="mixes-title">
        <SectionTitle label="Made for the in-between" title="Stay a little" link="/tapes/discover" />
        <div className="music-mix-grid">
          {mixes.slice(0, 4).map((mix, index) => (
            <article className="music-mix-card" key={mix.id}>
              <button
                type="button"
                className="music-mix-card__art"
                aria-label={`Play ${mix.title}`}
                onClick={() => void play(mix, mix.tracks[0])}
                disabled={!mix.tracks[0]}
              >
                <CoverArt seed={mix.cover} ratio="square" />
                <span className="music-mix-card__play"><Icon name="play" size={19} /></span>
                <span className="music-mix-card__index t-mono">0{index + 1}</span>
              </button>
              <h3 className="music-mix-card__title">{mix.title}</h3>
              <p className="t-small t-mute">{mix.note}</p>
            </article>
          ))}
        </div>
      </section>

      {nowPlaying ? (
        <Link to="/tapes/now-playing" className="music-now-strip" aria-label={`Open now playing: ${nowPlaying.track.title}`}>
          <span className="music-now-strip__art"><CoverArt seed={nowPlaying.track.cover} ratio="fill" /></span>
          <span className="music-now-strip__copy">
            <span className="music-now-strip__caption t-eyebrow">ON THE TURNTABLE</span>
            <strong>{nowPlaying.track.title}</strong>
            <span className="t-small t-mute">{nowPlaying.track.artist}</span>
          </span>
          <span className="music-now-strip__state" aria-label={nowPlaying.isPlaying ? 'Playing' : 'Paused'}>
            {nowPlaying.isPlaying ? <span className="music-equalizer" aria-hidden="true"><i /><i /><i /></span> : <Icon name="pause" size={18} />}
          </span>
        </Link>
      ) : null}

      <section className="music-section music-note" aria-label="A note from the listening room">
        <span className="music-note__star" aria-hidden="true">✳</span>
        <p className="t-serif-italic">“You don’t have to make something of every quiet moment.”</p>
        <span className="t-eyebrow">A small note for tonight</span>
      </section>
    </MusicFrame>
  );
}

export function MusicDiscover() {
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [swipes, setSwipes] = useState<MixSwipe[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const touchStart = useRef<number | null>(null);
  const navigate = useNavigate();

  async function loadDiscover() {
    setError('');
    try {
      const [loadedMixes, loadedSwipes] = await Promise.all([fetchMixes(), fetchSwipes()]);
      setMixes(loadedMixes);
      setSwipes(loadedSwipes);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your discovery deck.');
    }
  }

  useEffect(() => {
    void loadDiscover();
  }, []);

  const swipedIds = new Set(swipes.map((swipe) => swipe.mixId));
  const currentMix = mixes.find((mix) => !swipedIds.has(mix.id));

  function toggleMood(mood: string) {
    setSelectedMoods((selected) => (
      selected.includes(mood) ? selected.filter((item) => item !== mood) : [...selected, mood]
    ));
  }

  async function swipe(action: MixSwipe['action']) {
    if (!currentMix || saving) return;
    setSaving(true);
    setError('');
    try {
      await saveSwipe(currentMix.id, action);
      setSwipes((current) => [...current.filter((item) => item.mixId !== currentMix.id), {
        mixId: currentMix.id,
        action,
        createdAt: new Date().toISOString(),
      }]);
    } catch (swipeError) {
      setError(swipeError instanceof Error ? swipeError.message : 'Could not save that choice.');
    } finally {
      setSaving(false);
    }
  }

  function finishPointerSwipe(event: PointerEvent<HTMLElement>) {
    if (touchStart.current === null) return;
    const delta = event.clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) > 72) void swipe(delta > 0 ? 'like' : 'pass');
  }

  const likedCount = swipes.filter((swipeItem) => swipeItem.action === 'like').length;

  return (
    <MusicFrame>
      <div className="music-discover-head">
        <p className="t-eyebrow">A little listening-room introduction</p>
        <h1 className="t-h1">Find your<br /><em>tonight sound.</em></h1>
        <p className="t-body">Tell us what kind of night it is, then keep the mixes that feel like you.</p>
      </div>

      {error ? <MusicError message={error} onRetry={() => void loadDiscover()} /> : null}

      {!started ? (
        <section className="music-onboarding" aria-labelledby="mood-title">
          <div className="music-onboarding__step t-mono">01 / 02 · THE CHECK-IN</div>
          <h2 id="mood-title" className="t-h2">What’s the room feeling like?</h2>
          <p className="t-small t-mute">Pick as many as you need. There isn’t a wrong answer.</p>
          <div className="music-mood-options">
            {MOOD_CHOICES.map((mood) => {
              const selected = selectedMoods.includes(mood);
              return (
                <button
                  type="button"
                  className={`music-mood-chip${selected ? ' is-selected' : ''}`}
                  key={mood}
                  aria-pressed={selected}
                  onClick={() => toggleMood(mood)}
                >
                  <span aria-hidden="true">{selected ? '✳' : '＋'}</span> {mood}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="btn btn--primary music-onboarding__continue"
            disabled={!selectedMoods.length || !mixes.length}
            onClick={() => setStarted(true)}
          >
            Find my mix <Icon name="arrow-right" size={16} />
          </button>
        </section>
      ) : currentMix ? (
        <section className="music-deck" aria-label="Mix discovery cards">
          <div className="music-deck__meta">
            <span className="t-mono">02 / 02 · KEEP WHAT RESONATES</span>
            <span className="t-small t-mute">{swipes.length} of {mixes.length} checked in</span>
          </div>
          <article
            className="music-deck-card"
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest('button')) return;
              touchStart.current = event.clientX;
            }}
            onPointerUp={finishPointerSwipe}
            onPointerCancel={() => { touchStart.current = null; }}
          >
            <div className="music-deck-card__art">
              <CoverArt seed={currentMix.cover} ratio="fill" />
              <span className="music-deck-card__sticker">a tape for you</span>
              <span className="music-deck-card__song-count">{currentMix.tracks.length} songs · side A</span>
            </div>
            <div className="music-deck-card__copy">
              <div>
                <p className="t-eyebrow">{currentMix.tags.join(' · ')}</p>
                <h2 className="music-deck-card__title">{currentMix.title}</h2>
                <p className="t-small t-mute">{currentMix.note}</p>
              </div>
              <button
                type="button"
                className="music-deck-card__listen"
                onClick={() => void updateNowPlaying(currentMix, currentMix.tracks[0], true)
                  .then(() => navigate('/tapes/now-playing'))
                  .catch((playError: unknown) => setError(playError instanceof Error ? playError.message : 'Could not start this mix.'))}
              >
                <Icon name="play" size={16} /> Hear a little
              </button>
            </div>
          </article>
          <div className="music-deck-actions">
            <button type="button" className="music-swipe-btn music-swipe-btn--pass" onClick={() => void swipe('pass')} disabled={saving}>
              <Icon name="close" size={22} /><span>Not tonight</span>
            </button>
            <button type="button" className="music-swipe-btn music-swipe-btn--like" onClick={() => void swipe('like')} disabled={saving}>
              <Icon name="heart" size={22} /><span>Keep this one</span>
            </button>
          </div>
          <p className="music-deck-hint t-small t-mute">Or swipe left to pass, right to keep.</p>
        </section>
      ) : started ? (
        <section className="music-discover-done">
          <span className="music-discover-done__spark" aria-hidden="true">✳</span>
          <p className="t-eyebrow">THAT’S YOUR NIGHT, HELD GENTLY</p>
          <h2 className="t-h1">A little more you.</h2>
          <p className="t-body">You kept {likedCount} {likedCount === 1 ? 'mix' : 'mixes'} for this kind of night.</p>
          <Link className="btn btn--primary" to="/tapes">Back to your room</Link>
        </section>
      ) : null}
    </MusicFrame>
  );
}

export function MusicNowPlaying() {
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const seekValue = useRef(0);

  async function loadPlayer() {
    setError('');
    try {
      const [loadedMixes, loadedNowPlaying] = await Promise.all([fetchMixes(), fetchNowPlaying()]);
      setMixes(loadedMixes);
      setNowPlaying(loadedNowPlaying);
      setProgress(loadedNowPlaying.progressSeconds);
      seekValue.current = loadedNowPlaying.progressSeconds;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the player.');
    }
  }

  useEffect(() => {
    void loadPlayer();
  }, []);

  async function setPlayerState(mix: Mix, track: Track, playing: boolean, progressSeconds = 0) {
    setError('');
    try {
      const updated = await updateNowPlaying(mix, track, playing, progressSeconds);
      setNowPlaying(updated);
      setProgress(updated.progressSeconds);
      seekValue.current = updated.progressSeconds;
    } catch (playError) {
      setError(playError instanceof Error ? playError.message : 'Could not update the player.');
    }
  }

  async function skipTrack(direction: -1 | 1) {
    if (!nowPlaying || !mixes.length) return;
    const queue = mixes.flatMap((mix) => mix.tracks.map((track) => ({ mix, track })));
    const currentIndex = queue.findIndex(({ track }) => track.id === nowPlaying.track.id);
    const next = queue[(currentIndex + direction + queue.length) % queue.length];
    if (next) await setPlayerState(next.mix, next.track, nowPlaying.isPlaying);
  }

  async function persistSeek() {
    if (nowPlaying && currentMix) {
      await setPlayerState(currentMix, nowPlaying.track, nowPlaying.isPlaying, seekValue.current);
    }
  }

  const currentMix = nowPlaying ? mixes.find((mix) => mix.id === nowPlaying.mix.id) : undefined;

  return (
    <MusicFrame>
      {error ? <MusicError message={error} onRetry={() => void loadPlayer()} /> : null}
      {nowPlaying && currentMix ? (
        <section className="music-player">
          <div className="music-player__top">
            <Link to="/tapes" className="music-player__back"><Icon name="chevron-left" size={19} /> Back to room</Link>
            <span className="t-eyebrow">NOW PLAYING · SIDE A</span>
          </div>
          <div className="music-player__body">
            <div className="music-player__art">
              <CoverArt seed={nowPlaying.track.cover} ratio="square" />
              <span className="music-player__art-glow" aria-hidden="true" />
            </div>
            <div className="music-player__details">
              <p className="t-eyebrow">{nowPlaying.mix.title}</p>
              <h1 className="music-player__title">{nowPlaying.track.title}</h1>
              <p className="music-player__artist">{nowPlaying.track.artist}</p>
              <div className="music-player__wave" aria-hidden="true">
                {Array.from({ length: 39 }, (_, index) => (
                  <span key={index} style={{ '--wave-height': `${18 + ((index * 17 + 13) % 58)}%` } as CSSProperties} />
                ))}
              </div>
              <label className="sr-only" htmlFor="music-progress">Track progress</label>
              <input
                id="music-progress"
                className="music-player__seek"
                type="range"
                min="0"
                max={nowPlaying.track.seconds}
                value={progress}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  seekValue.current = next;
                  setProgress(next);
                }}
                onPointerUp={() => void persistSeek()}
                onKeyUp={() => void persistSeek()}
                style={{ '--seek-progress': `${(progress / nowPlaying.track.seconds) * 100}%` } as CSSProperties}
              />
              <div className="music-player__times t-mono">
                <span>{formatClock(progress)}</span><span>{formatClock(nowPlaying.track.seconds)}</span>
              </div>
              <div className="music-player__controls">
                <button type="button" className="iconbtn" aria-label="Previous track" onClick={() => void skipTrack(-1)}>
                  <Icon name="skip-back" size={23} />
                </button>
                <button
                  type="button"
                  className="music-player__toggle"
                  aria-label={nowPlaying.isPlaying ? 'Pause' : 'Play'}
                  onClick={() => void setPlayerState(currentMix, nowPlaying.track, !nowPlaying.isPlaying, progress)}
                >
                  <Icon name={nowPlaying.isPlaying ? 'pause' : 'play'} size={23} />
                </button>
                <button type="button" className="iconbtn" aria-label="Next track" onClick={() => void skipTrack(1)}>
                  <Icon name="skip-forward" size={23} />
                </button>
              </div>
              <div className="music-player__footer">
                <span className="music-player__note">Made for the hours that don’t ask you to explain.</span>
                <Link to="/tapes/discover" className="iconbtn" aria-label="Open mix discovery">
                  <Icon name="dial" size={19} />
                </Link>
              </div>
            </div>
          </div>
          <p className="music-player__disclaimer t-small t-mute">A quiet player preview — your listening state is saved on this device’s demo account.</p>
        </section>
      ) : !error ? <div className="music-loading" role="status">Warming up the turntable…</div> : null}
    </MusicFrame>
  );
}
