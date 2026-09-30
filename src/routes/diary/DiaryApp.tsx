import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { AppShell } from '../../components/AppShell';
import { CoverArt } from '../../components/CoverArt';
import { Icon } from '../../components/Icon';
import { PageBar } from '../../components/PageBar';
import { TabBar } from '../../components/TabBar';
import { MOOD_FACES } from '../../data/journal';
import type { Mood } from '../../data/types';
import { createJournalEntry, fetchJournalEntries, fetchJournalStats, type JournalStats, type SavedJournalEntry } from '../../lib/journalApi';

const MOODS: Mood[] = ['tender', 'restless', 'quiet', 'hopeful', 'wrecked'];
const DIARY_TABS = [
  { to: '/diary', label: 'Tonight', icon: 'home' as const, end: true },
  { to: '/diary/stats', label: 'My year', icon: 'dial' as const },
];

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function DiaryFrame({ children }: { children: ReactNode }) {
  return (
    <AppShell
      bar={<PageBar title="song diary" eyebrow="BEDROOM POP · A PLACE TO KEEP IT" />}
      nav={<TabBar items={DIARY_TABS} fab={{ to: '/diary#check-in', label: 'Write tonight’s entry', icon: 'edit' }} />}
    >
      <div className="diary-content">{children}</div>
    </AppShell>
  );
}

function DiaryError({ message }: { message: string }) {
  return <div className="music-error" role="alert">{message}</div>;
}

function EntryCard({ entry }: { entry: SavedJournalEntry }) {
  const mood = MOOD_FACES[entry.mood];
  return (
    <article className="diary-entry">
      <div className="diary-entry__top">
        <span className="diary-mood"><Icon name={mood.icon} size={14} /> {mood.label}</span>
        <time className="t-mono" dateTime={entry.entryDate}>{entry.date}</time>
      </div>
      <div className="diary-entry__song">
        <span className="diary-entry__art"><CoverArt seed={entry.photo ?? `${entry.song}-${entry.artist}`} ratio="fill" /></span>
        <span><strong>{entry.song}</strong><small>{entry.artist}</small></span>
        <span className="diary-entry__rating" aria-label={`${entry.rating} out of 5 stars`}>{'✳'.repeat(entry.rating)}</span>
      </div>
      <p className="diary-entry__note">{entry.note}</p>
    </article>
  );
}

export function DiaryHome() {
  const [entries, setEntries] = useState<SavedJournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [filter, setFilter] = useState<Mood | 'all'>('all');
  const [mood, setMood] = useState<Mood>('tender');
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(5);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function load() {
    try {
      const [loadedEntries, loadedStats] = await Promise.all([
        fetchJournalEntries(filter),
        fetchJournalStats(),
      ]);
      setEntries(loadedEntries);
      setStats(loadedStats);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your song diary.');
    }
  }
  useEffect(() => { void load(); }, [filter]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaved(false);
    try {
      await createJournalEntry({
        entryDate: localDate(),
        mood,
        song,
        artist,
        note,
        rating,
      });
      setSong('');
      setArtist('');
      setNote('');
      setSaved(true);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save tonight’s entry.');
    }
  }

  return (
    <DiaryFrame>
      {error ? <DiaryError message={error} /> : null}
      <header className="diary-intro">
        <p className="t-eyebrow">Wednesday, September 30 · 2:17am</p>
        <h1 className="t-h1">Some nights deserve<br /><em>a little record.</em></h1>
        <p className="t-body">No need to make sense of the whole day. Just leave a song and a small truth.</p>
      </header>

      {stats ? (
        <section className="diary-stats-ribbon" aria-label="Your listening journal stats">
          <div><strong>{stats.streakDays}</strong><span>night streak</span></div>
          <span className="diary-stats-ribbon__line" aria-hidden="true" />
          <div><strong>{stats.entries}</strong><span>little entries</span></div>
          <span className="diary-stats-ribbon__line" aria-hidden="true" />
          <Link to="/diary/stats">See your year <Icon name="arrow-right" size={14} /></Link>
        </section>
      ) : null}

      <section className="diary-checkin" id="check-in">
        <div className="diary-section-head">
          <div><p className="t-eyebrow">A daily check-in</p><h2 className="t-h2">What stayed with you?</h2></div>
          <span className="diary-checkin__date t-mono">{localDate()}</span>
        </div>
        <form className="diary-form" onSubmit={(event) => void onSubmit(event)}>
          <fieldset className="diary-mood-field">
            <legend className="t-small">How did tonight feel?</legend>
            <div className="diary-mood-options">
              {MOODS.map((option) => {
                const item = MOOD_FACES[option];
                return (
                  <button
                    key={option}
                    type="button"
                    className={`diary-mood-option${mood === option ? ' is-active' : ''}`}
                    aria-pressed={mood === option}
                    onClick={() => setMood(option)}
                  >
                    <Icon name={item.icon} size={18} /><span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="diary-form__pair">
            <label className="diary-field"><span>Song</span><input required maxLength={140} value={song} onChange={(event) => setSong(event.target.value)} placeholder="the one on repeat" /></label>
            <label className="diary-field"><span>Artist</span><input required maxLength={140} value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="who made it" /></label>
          </div>
          <label className="diary-field">
            <span>A note to yourself <small>(optional)</small></span>
            <textarea maxLength={800} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Where were you? What do you want to remember?" />
          </label>
          <div className="diary-form__bottom">
            <label className="diary-rating-field"><span>How much did it mean?</span>
              <select value={rating} onChange={(event) => setRating(Number(event.target.value))}>
                {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{'✳'.repeat(value)} · {value} of 5</option>)}
              </select>
            </label>
            <button className="btn btn--primary" type="submit" disabled={!song.trim() || !artist.trim()}>
              <Icon name="edit" size={16} /> Save this night
            </button>
          </div>
          {saved ? <p className="diary-saved-message" role="status"><Icon name="check-circle" size={16} /> It’s here whenever you need it.</p> : null}
        </form>
      </section>

      <section className="diary-entries">
        <div className="diary-section-head">
          <div><p className="t-eyebrow">Nothing has to be forgotten</p><h2 className="t-h2">Your song diary</h2></div>
        </div>
        <div className="diary-filter" role="group" aria-label="Filter entries by mood">
          {(['all', ...MOODS] as const).map((item) => (
            <button type="button" key={item} className={filter === item ? 'is-active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
              {item === 'all' ? 'All' : MOOD_FACES[item].label}
            </button>
          ))}
        </div>
        <div className="diary-entry-list">
          {entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
          {!entries.length && !error ? <p className="t-small t-mute">No entries for this mood just yet.</p> : null}
        </div>
      </section>
      <aside className="diary-quote">
        <span aria-hidden="true">“</span>
        <p className="t-serif-italic">You’re allowed to keep a record of the things that kept you here.</p>
        <small>From the listening room</small>
      </aside>
    </DiaryFrame>
  );
}

export function DiaryStats() {
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void fetchJournalStats().then(setStats).catch((loadError: unknown) =>
      setError(loadError instanceof Error ? loadError.message : 'Could not load your journal stats.'));
  }, []);
  return (
    <DiaryFrame>
      {error ? <DiaryError message={error} /> : null}
      <header className="diary-intro">
        <p className="t-eyebrow">Your little listening year</p>
        <h1 className="t-h1">A soft kind<br /><em>of showing up.</em></h1>
        <p className="t-body">Not a score. Just proof that you were here for the songs.</p>
      </header>
      {stats ? (
        <>
          <section className="diary-stats-grid">
            <article><span>nights in a row</span><strong>{stats.streakDays}</strong><small>you kept coming back</small></article>
            <article><span>songs remembered</span><strong>{stats.songs}</strong><small>all the ones that held on</small></article>
            <article><span>little entries</span><strong>{stats.entries}</strong><small>small truths, kept safe</small></article>
            <article><span>feeling for the songs</span><strong>{stats.averageRating.toFixed(1)}<small>/ 5</small></strong><small>you loved them on average</small></article>
          </section>
          <section className="diary-mood-stats">
            <div><p className="t-eyebrow">A weather report of sorts</p><h2 className="t-h2">How it’s been feeling</h2></div>
            {stats.moodCounts.map(({ mood, count }) => (
              <div className="diary-mood-stat" key={mood}>
                <span>{MOOD_FACES[mood].label}</span>
                <span className="diary-mood-stat__track"><i style={{ width: `${stats.entries ? (count / stats.entries) * 100 : 0}%` }} /></span>
                <span className="t-mono">{count}</span>
              </div>
            ))}
          </section>
          <Link to="/diary" className="btn btn--ghost diary-stats-back"><Icon name="chevron-left" size={16} /> Back to the diary</Link>
        </>
      ) : !error ? <p className="t-small t-mute">Counting the songs you kept…</p> : null}
    </DiaryFrame>
  );
}
