import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { AppShell } from '../../components/AppShell';
import { CoverArt } from '../../components/CoverArt';
import { Icon } from '../../components/Icon';
import { PageBar } from '../../components/PageBar';
import { TabBar } from '../../components/TabBar';
import { SWIPE_PROMPTS } from '../../data/dating';
import type { Message, Profile } from '../../data/types';
import {
  fetchDatingMessages,
  fetchDatingPreferences,
  fetchDatingProfile,
  fetchDatingProfiles,
  fetchDatingMatches,
  fetchMyDatingProfile,
  saveDatingPreferences,
  sendDatingMessage,
  submitDatingSwipe,
  updateMyDatingProfile,
  type DatingMatch,
  type PersonalDatingProfile,
} from '../../lib/datingApi';

const DATING_TABS = [
  { to: '/lowlight', label: 'Tonight', icon: 'heart' as const, end: true },
  { to: '/lowlight/matches', label: 'Matches', icon: 'users' as const },
  { to: '/lowlight/profile', label: 'You', icon: 'user' as const },
];

function DatingFrame({ children }: { children: ReactNode }) {
  return (
    <AppShell
      bar={<PageBar title="lowlight" eyebrow="BEDROOM POP · SOMEONE ELSE IS AWAKE" />}
      nav={<TabBar items={DATING_TABS} />}
    >
      <div className="dating-content">{children}</div>
    </AppShell>
  );
}

function DatingError({ message }: { message: string }) {
  return <div className="music-error" role="alert">{message}</div>;
}

function MatchDialog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  return (
    <div className="dating-match-scrim" role="presentation">
      <section className="dating-match-dialog" role="dialog" aria-modal="true" aria-labelledby="match-title">
        <span className="dating-match-dialog__spark" aria-hidden="true">✳</span>
        <div className="dating-match-dialog__art"><CoverArt seed={profile.photo} ratio="square" /></div>
        <p className="t-eyebrow">THE SAME SONG FOUND ITS WAY TO YOU</p>
        <h2 id="match-title">You and {profile.name} are a match.</h2>
        <p className="t-small t-mute">No rush. Say hello when the words find you.</p>
        <div className="dating-match-dialog__actions">
          <Link to={`/lowlight/chat/${profile.id}`} className="btn btn--primary">Say a small hello</Link>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Keep listening</button>
        </div>
      </section>
    </div>
  );
}

export function DatingHome() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [preferences, loadedProfiles] = await Promise.all([fetchDatingPreferences(), fetchDatingProfiles()]);
      setAnswers(preferences.answers);
      setCompleted(preferences.completed);
      setProfiles(loadedProfiles);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not open the Lowlight room.');
    }
  }
  useEffect(() => { void load(); }, []);

  async function finishCheckIn() {
    setError('');
    try {
      await saveDatingPreferences(answers);
      setCompleted(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your check-in.');
    }
  }

  async function swipe(action: 'like' | 'pass') {
    const profile = profiles[0];
    if (!profile || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await submitDatingSwipe(profile.id, action);
      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      if (result.matched) setMatchedProfile(profile);
    } catch (swipeError) {
      setError(swipeError instanceof Error ? swipeError.message : 'Could not save that choice.');
    } finally {
      setSaving(false);
    }
  }

  const profile = profiles[0];

  return (
    <DatingFrame>
      {error ? <DatingError message={error} /> : null}
      <header className="dating-intro">
        <p className="t-eyebrow">2:17am · THERE’S A LIGHT ON SOMEWHERE</p>
        <h1 className="t-h1">A little less<br /><em>alone tonight.</em></h1>
        <p className="t-body">Meet people who know how the quiet parts of a song feel.</p>
      </header>
      {!completed ? (
        <section className="dating-checkin">
          <div className="dating-checkin__step t-mono">BEFORE THE HELLOS · A SMALL CHECK-IN</div>
          <h2 className="t-h2">A little about your kind of night.</h2>
          <p className="t-small t-mute">Nothing public yet. This just helps us find the right room.</p>
          {SWIPE_PROMPTS.map((prompt) => (
            <fieldset className="dating-prompt" key={prompt.id}>
              <legend>{prompt.question}</legend>
              <div>
                {prompt.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={answers[prompt.id] === option ? 'is-active' : ''}
                    aria-pressed={answers[prompt.id] === option}
                    onClick={() => setAnswers((current) => ({ ...current, [prompt.id]: option }))}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <button type="button" className="btn btn--primary dating-checkin__submit" disabled={SWIPE_PROMPTS.some((prompt) => !answers[prompt.id])} onClick={() => void finishCheckIn()}>
            Find my people <Icon name="arrow-right" size={16} />
          </button>
        </section>
      ) : profile ? (
        <section className="dating-deck" aria-label="People to meet">
          <div className="dating-deck__meta"><span className="t-mono">A FEW PEOPLE UP LATE</span><span className="t-small t-mute">{profiles.length} nearby</span></div>
          <article className="dating-profile-card">
            <Link to={`/lowlight/profiles/${profile.id}`} className="dating-profile-card__photo" aria-label={`View ${profile.name}'s profile`}>
              <CoverArt seed={profile.photo} ratio="fill" />
              <span className="dating-profile-card__active"><span className="dot dot--live" /> {profile.lastActive}</span>
              <span className="dating-profile-card__distance">{profile.distanceKm} km away</span>
            </Link>
            <div className="dating-profile-card__body">
              <div>
                <p className="t-eyebrow">A SONG THEY BROUGHT WITH THEM</p>
                <h2>{profile.name}, {profile.age}</h2>
                <p className="dating-profile-card__headline">{profile.headline}</p>
              </div>
              <p className="dating-profile-card__song"><Icon name="play" size={14} /> {profile.song}</p>
              <p className="dating-profile-card__bio">{profile.bio}</p>
              <p className="dating-profile-card__prompt"><span>{profile.prompt.question}</span>{profile.prompt.answer}</p>
              <div className="dating-interests">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
            </div>
          </article>
          <div className="dating-deck__actions">
            <button type="button" className="dating-action dating-action--pass" disabled={saving} onClick={() => void swipe('pass')} aria-label={`Pass on ${profile.name}`}>
              <Icon name="close" size={23} /><span>Not tonight</span>
            </button>
            <button type="button" className="dating-action dating-action--like" disabled={saving} onClick={() => void swipe('like')} aria-label={`Like ${profile.name}`}>
              <Icon name="heart" size={23} /><span>Say hello</span>
            </button>
          </div>
          <p className="dating-deck__hint t-small t-mute">Only the people you like will know.</p>
        </section>
      ) : completed ? (
        <section className="dating-empty">
          <span aria-hidden="true">☾</span>
          <p className="t-serif-italic">That’s everyone for tonight. There’s no need to rush the night along.</p>
          <Link className="btn btn--ghost btn--sm" to="/lowlight/matches">Sit with your matches</Link>
        </section>
      ) : null}
      <aside className="dating-footer-note"><span>✳</span><p className="t-serif-italic">The right person won’t ask you to be louder than you are.</p></aside>
      {matchedProfile ? <MatchDialog profile={matchedProfile} onClose={() => setMatchedProfile(null)} /> : null}
    </DatingFrame>
  );
}

export function DatingMatches() {
  const [matches, setMatches] = useState<DatingMatch[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    void fetchDatingMatches().then(setMatches).catch((loadError: unknown) =>
      setError(loadError instanceof Error ? loadError.message : 'Could not load matches.'));
  }, []);
  return (
    <DatingFrame>
      {error ? <DatingError message={error} /> : null}
      <header className="dating-intro">
        <p className="t-eyebrow">People who stayed a little</p>
        <h1 className="t-h1">Your small<br /><em>constellation.</em></h1>
        <p className="t-body">No read receipts, no timers. Just the people you might want to talk to.</p>
      </header>
      <section className="dating-match-list">
        {matches.map((match) => (
          <Link to={`/lowlight/chat/${match.id}`} className="dating-match-row" key={match.id}>
            <span className="dating-match-row__art"><CoverArt seed={match.photo} ratio="fill" /></span>
            <span className="dating-match-row__body">
              <strong>{match.name}, {match.age}</strong>
              <small>{match.lastMessage ?? match.headline}</small>
              <span className="t-mono">{match.lastActive}</span>
            </span>
            {match.unread ? <span className="dating-match-row__unread" aria-label={`${match.unread} recent messages`}>{Math.min(match.unread, 9)}</span> : <Icon name="chevron-right" size={18} />}
          </Link>
        ))}
        {!matches.length && !error ? <div className="dating-empty"><p className="t-serif-italic">No matches yet. Someone is still writing their hello.</p><Link to="/lowlight" className="btn btn--primary btn--sm">Meet someone</Link></div> : null}
      </section>
      <section className="dating-match-note"><Icon name="heart" size={18} /><p className="t-small">Connection moves at your own speed. You can always come back to a conversation later.</p></section>
    </DatingFrame>
  );
}

export function DatingChat() {
  const { profileId = '' } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const [loadedProfile, loadedMessages] = await Promise.all([fetchDatingProfile(profileId), fetchDatingMessages(profileId)]);
      setProfile(loadedProfile);
      setMessages(loadedMessages);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not open this conversation.');
    }
  }
  useEffect(() => { void load(); }, [profileId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const message = await sendDatingMessage(profileId, text);
      setMessages((current) => [...current, message]);
      setText('');
      setError('');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send your message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <DatingFrame>
      {error ? <DatingError message={error} /> : null}
      <div className="dating-chat">
        <header className="dating-chat__header">
          <Link to="/lowlight/matches" className="iconbtn" aria-label="Back to matches"><Icon name="chevron-left" size={20} /></Link>
          {profile ? <span className="dating-chat__avatar"><CoverArt seed={profile.photo} ratio="fill" /></span> : null}
          <span className="dating-chat__person"><strong>{profile ? `${profile.name}, ${profile.age}` : 'A quiet conversation'}</strong><small>{profile?.lastActive ?? 'just you and the words'}</small></span>
          {profile ? <Link to={`/lowlight/profiles/${profile.id}`} className="iconbtn" aria-label={`View ${profile.name}'s profile`}><Icon name="more" size={19} /></Link> : null}
        </header>
        {profile ? (
          <div className="dating-chat__messages" aria-label="Conversation">
            <div className="dating-chat__intro">
              <span className="dating-chat__intro-art"><CoverArt seed={profile.photo} ratio="square" /></span>
              <p className="t-eyebrow">YOU AND {profile.name.toUpperCase()} FOUND EACH OTHER AT THE SAME HOUR</p>
              <p className="t-serif-italic">Start anywhere. A song, maybe.</p>
            </div>
            {messages.map((message) => (
              <div key={message.id} className={`dating-bubble${message.from === 'me' ? ' dating-bubble--me' : ' dating-bubble--them'}`}>
                <p>{message.text}</p><time>{message.at}</time>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        ) : null}
        <form className="dating-chat__composer" onSubmit={(event) => void onSubmit(event)}>
          <label className="sr-only" htmlFor="chat-message">Write a message</label>
          <input id="chat-message" value={text} maxLength={1000} onChange={(event) => setText(event.target.value)} placeholder="Say the thing, however small…" />
          <button type="submit" disabled={!text.trim() || sending} aria-label="Send message"><Icon name="arrow-right" size={19} /></button>
        </form>
      </div>
    </DatingFrame>
  );
}

export function DatingMyProfile() {
  const [profile, setProfile] = useState<PersonalDatingProfile | null>(null);
  const [interestText, setInterestText] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetchMyDatingProfile().then((loaded) => {
      setProfile(loaded);
      setInterestText(loaded.interests.join(', '));
    }).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load your profile.'));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaved(false);
    try {
      const updated = await updateMyDatingProfile({
        ...profile,
        interests: interestText.split(',').map((item) => item.trim()).filter(Boolean),
      });
      setProfile(updated);
      setInterestText(updated.interests.join(', '));
      setSaved(true);
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    }
  }

  return (
    <DatingFrame>
      {error ? <DatingError message={error} /> : null}
      <header className="dating-intro"><p className="t-eyebrow">A little self portrait</p><h1 className="t-h1">This is<br /><em>how you show up.</em></h1></header>
      {profile ? (
        <form className="dating-edit-profile" onSubmit={(event) => void onSubmit(event)}>
          <span className="dating-edit-profile__art"><CoverArt seed="polaroid-wall" ratio="square" /></span>
          <div className="diary-form__pair">
            <label className="diary-field"><span>Name</span><input required maxLength={80} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
            <label className="diary-field"><span>Age</span><input required type="number" min={18} max={99} value={profile.age} onChange={(event) => setProfile({ ...profile, age: Number(event.target.value) })} /></label>
          </div>
          <label className="diary-field"><span>A line about you</span><input required maxLength={160} value={profile.headline} onChange={(event) => setProfile({ ...profile, headline: event.target.value })} /></label>
          <label className="diary-field"><span>Bio</span><textarea rows={4} maxLength={800} value={profile.bio} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} /></label>
          <label className="diary-field"><span>The song you brought</span><input maxLength={160} value={profile.song} onChange={(event) => setProfile({ ...profile, song: event.target.value })} /></label>
          <label className="diary-field"><span>Your things, separated by commas</span><input value={interestText} onChange={(event) => setInterestText(event.target.value)} placeholder="late walks, tea, one good lamp" /></label>
          <button className="btn btn--primary" type="submit">Save my little profile</button>
          {saved ? <p className="diary-saved-message" role="status"><Icon name="check-circle" size={16} /> It looks like you.</p> : null}
        </form>
      ) : !error ? <p className="t-small t-mute">Finding your reflection…</p> : null}
    </DatingFrame>
  );
}

export function DatingPersonPage() {
  const { profileId = '' } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void fetchDatingProfile(profileId).then(setProfile).catch((loadError: unknown) =>
      setError(loadError instanceof Error ? loadError.message : 'Could not find this profile.'));
  }, [profileId]);
  return (
    <DatingFrame>
      {error ? <DatingError message={error} /> : null}
      {profile ? (
        <article className="dating-person-page">
          <Link to="/lowlight" className="music-player__back"><Icon name="chevron-left" size={18} /> Back to the room</Link>
          <div className="dating-person-page__art"><CoverArt seed={profile.photo} ratio="portrait" /></div>
          <p className="t-eyebrow">{profile.distanceKm} KM AWAY · {profile.lastActive}</p>
          <h1 className="t-h1">{profile.name}, {profile.age}</h1>
          <p className="dating-person-page__headline">{profile.headline}</p>
          <p className="t-body">{profile.bio}</p>
          <div className="dating-interests">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
          <blockquote><span className="t-eyebrow">{profile.prompt.question}</span><p className="t-serif-italic">{profile.prompt.answer}</p></blockquote>
          <p className="dating-profile-card__song"><Icon name="play" size={15} /> {profile.song}</p>
          <Link className="btn btn--primary" to={`/lowlight/chat/${profile.id}`}>Open your conversation</Link>
        </article>
      ) : !error ? <p className="t-small t-mute">Reading the note they left behind…</p> : null}
    </DatingFrame>
  );
}
