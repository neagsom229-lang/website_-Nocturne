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

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tapes" element={<MusicHome />} />
      <Route path="/tapes/discover" element={<MusicDiscover />} />
      <Route path="/tapes/now-playing" element={<MusicNowPlaying />} />
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
      <Route path="/landing" element={<LandingPage />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
