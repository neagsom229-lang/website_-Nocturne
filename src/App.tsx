import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

const Home = lazy(() => import('./routes/Home').then((module) => ({ default: module.Home })));
const SignIn = lazy(() => import('./routes/SignIn').then((module) => ({ default: module.SignIn })));
const SignUp = lazy(() => import('./routes/SignUp').then((module) => ({ default: module.SignUp })));
const AuthCallback = lazy(() => import('./routes/AuthCallback').then((module) => ({ default: module.AuthCallback })));
const VerifyEmail = lazy(() => import('./routes/VerifyEmail').then((module) => ({ default: module.VerifyEmail })));
const ForgotPassword = lazy(() => import('./routes/ForgotPassword').then((module) => ({ default: module.ForgotPassword })));
const ResetPassword = lazy(() => import('./routes/ResetPassword').then((module) => ({ default: module.ResetPassword })));
const SettingsSecurity = lazy(() => import('./routes/SettingsSecurity').then((module) => ({ default: module.SettingsSecurity })));
const ProtectedRoutes = lazy(() => import('./auth/AuthRoutes').then((module) => ({ default: module.ProtectedRoutes })));

const LandingPage = lazy(() => import('./routes/LandingPage').then((module) => ({ default: module.LandingPage })));
const MusicHome = lazy(() => import('./routes/tapes/MusicApp').then((module) => ({ default: module.MusicHome })));
const MusicDiscover = lazy(() => import('./routes/tapes/MusicApp').then((module) => ({ default: module.MusicDiscover })));
const MusicNowPlaying = lazy(() => import('./routes/tapes/MusicApp').then((module) => ({ default: module.MusicNowPlaying })));
const PodcastHome = lazy(() => import('./routes/static/PodcastApp').then((module) => ({ default: module.PodcastHome })));
const PodcastShows = lazy(() => import('./routes/static/PodcastApp').then((module) => ({ default: module.PodcastShows })));
const PodcastShowPage = lazy(() => import('./routes/static/PodcastApp').then((module) => ({ default: module.PodcastShowPage })));
const PodcastEpisodePage = lazy(() => import('./routes/static/PodcastApp').then((module) => ({ default: module.PodcastEpisodePage })));
const PodcastSaved = lazy(() => import('./routes/static/PodcastApp').then((module) => ({ default: module.PodcastSaved })));
const PodcastPlayer = lazy(() => import('./routes/static/PodcastApp').then((module) => ({ default: module.PodcastPlayer })));
const DiaryHome = lazy(() => import('./routes/diary/DiaryApp').then((module) => ({ default: module.DiaryHome })));
const DiaryStats = lazy(() => import('./routes/diary/DiaryApp').then((module) => ({ default: module.DiaryStats })));
const DatingHome = lazy(() => import('./routes/lowlight/DatingApp').then((module) => ({ default: module.DatingHome })));
const DatingMatches = lazy(() => import('./routes/lowlight/DatingApp').then((module) => ({ default: module.DatingMatches })));
const DatingChat = lazy(() => import('./routes/lowlight/DatingApp').then((module) => ({ default: module.DatingChat })));
const DatingMyProfile = lazy(() => import('./routes/lowlight/DatingApp').then((module) => ({ default: module.DatingMyProfile })));
const DatingPersonPage = lazy(() => import('./routes/lowlight/DatingApp').then((module) => ({ default: module.DatingPersonPage })));
const SearchResultsPage = lazy(() => import('./routes/SearchResults').then((module) => ({ default: module.SearchResultsPage })));
const MusicLibraryPage = lazy(() => import('./routes/MediaHub').then((module) => ({ default: module.MusicLibraryPage })));
const MoviesPage = lazy(() => import('./routes/Movies').then((module) => ({ default: module.MoviesPage })));
const MovieDetailPage = lazy(() => import('./routes/Movies').then((module) => ({ default: module.MovieDetailPage })));
const TvDetail = lazy(() => import('./routes/TvDetail').then((module) => ({ default: module.TvDetail })));
const MusicDetail = lazy(() => import('./routes/MusicDetail').then((module) => ({ default: module.MusicDetail })));
const AudiobookDetail = lazy(() => import('./routes/AudiobookDetail').then((module) => ({ default: module.AudiobookDetail })));
const VideoPodcastDetail = lazy(() => import('./routes/VideoPodcastDetail').then((module) => ({ default: module.VideoPodcastDetail })));
const PodcastDetail = lazy(() => import('./routes/PodcastDetail').then((module) => ({ default: module.PodcastDetail })));
const PlaylistsPage = lazy(() => import('./routes/Playlists').then((module) => ({ default: module.PlaylistsPage })));
const PlaylistDetailRoute = lazy(() => import('./routes/PlaylistDetail').then((module) => ({ default: module.PlaylistDetailRoute })));
const ProfilePage = lazy(() => import('./routes/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const Settings = lazy(() => import('./routes/Settings').then((module) => ({ default: module.Settings })));
const WorkspacePlaceholder = lazy(() => import('./routes/MediaHub').then((module) => ({ default: module.WorkspacePlaceholder })));

function RouteLoading() {
  return (
    <main className="route-loading" role="status">
      <span className="route-loading__spinner" aria-hidden="true" />
      <span>Making a little room…</span>
    </main>
  );
}

export function App() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/auth/login" element={<SignIn />} />
        <Route path="/auth/register" element={<SignUp />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/verify" element={<VerifyEmail />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/playlists/:id" element={<PlaylistDetailRoute />} />
        <Route path="/u/:id" element={<ProfilePage />} />
        <Route element={<ProtectedRoutes />}>
          <Route path="/tapes" element={<MusicHome />} />
          <Route path="/tapes/discover" element={<MusicDiscover />} />
          <Route path="/tapes/now-playing" element={<MusicNowPlaying />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/library" element={<MusicLibraryPage />} />
          <Route path="/movies" element={<MoviesPage />} />
          <Route path="/movies/:id" element={<MovieDetailPage />} />
          <Route path="/tv/:id" element={<TvDetail />} />
          <Route path="/music/:id" element={<MusicDetail />} />
          <Route path="/audiobooks/:id" element={<AudiobookDetail />} />
          <Route path="/video-podcasts/:id" element={<VideoPodcastDetail />} />
          <Route path="/podcasts/:id" element={<PodcastDetail />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/security" element={<SettingsSecurity />} />
          <Route path="/notifications" element={<WorkspacePlaceholder title="Notifications" icon="bell" body="All your notifications and updates will live here." />} />
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
    </Suspense>
  );
}
