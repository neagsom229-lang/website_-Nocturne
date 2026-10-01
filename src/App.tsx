import { Route, Routes } from 'react-router-dom';
import { MusicDiscover, MusicHome, MusicNowPlaying } from './routes/tapes/MusicApp';
import {
  PodcastEpisodePage,
  PodcastHome,
  PodcastPlayer,
  PodcastSaved,
  PodcastShowPage,
  PodcastShows,
} from './routes/static/PodcastApp';
import { Home } from './routes/Home';
import { DiaryHome, DiaryStats } from './routes/diary/DiaryApp';
import { DatingChat, DatingHome, DatingMatches, DatingMyProfile, DatingPersonPage } from './routes/lowlight/DatingApp';
import { LandingPage } from './routes/LandingPage';
import { AuthPage, ProtectedRoutes } from './auth/AuthRoutes';
import { MusicLibraryPage, SearchResultsPage, WorkspacePlaceholder } from './routes/MediaHub';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/auth/login" element={<AuthPage mode="login" />} />
      <Route path="/auth/register" element={<AuthPage mode="register" />} />
      <Route element={<ProtectedRoutes />}>
        <Route path="/tapes" element={<MusicHome />} />
        <Route path="/tapes/discover" element={<MusicDiscover />} />
        <Route path="/tapes/now-playing" element={<MusicNowPlaying />} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/library" element={<MusicLibraryPage />} />
        <Route path="/mood" element={<DiaryHome />} />
        <Route path="/trending" element={<WorkspacePlaceholder title="Trending, softly." icon="trend-up" body="A calmer corner for the songs and stories people are finding tonight." />} />
        <Route path="/chat" element={<WorkspacePlaceholder title="A little room to talk." icon="message" body="Your conversations will find a home here. For now, start with the people you’ve matched with." />} />
        <Route path="/community" element={<WorkspacePlaceholder title="A room full of listeners." icon="users" body="The community feed is taking shape. Keep a song close while we get it ready." />} />
        <Route path="/settings/appearance" element={<WorkspacePlaceholder title="Make the room yours." eyebrow="YOUR SPACE, YOUR LIGHT" icon="settings" body="Appearance choices will be gathered here. For now, the room stays in its warm plum and amber light." />} />
        <Route path="/about" element={<WorkspacePlaceholder title="A place for what stays with you." eyebrow="ABOUT BEDROOM POP" icon="moon" body="Nocturne is a quiet little home for music, stories, reflection, and people who understand the late hours." />} />
        <Route path="/static" element={<PodcastHome />} />
        <Route path="/static/shows" element={<PodcastShows />} />
        <Route path="/static/shows/:showId" element={<PodcastShowPage />} />
        <Route path="/static/episode/:episodeId" element={<PodcastEpisodePage />} />
        <Route path="/static/saved" element={<PodcastSaved />} />
        <Route path="/static/player" element={<PodcastPlayer />} />
        <Route path="/diary" element={<DiaryHome />} />
        <Route path="/diary/stats" element={<DiaryStats />} />
        <Route path="/lowlight" element={<DatingHome />} />
        <Route path="/lowlight/matches" element={<DatingMatches />} />
        <Route path="/lowlight/chat/:profileId" element={<DatingChat />} />
        <Route path="/lowlight/profile" element={<DatingMyProfile />} />
        <Route path="/lowlight/profiles/:profileId" element={<DatingPersonPage />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
