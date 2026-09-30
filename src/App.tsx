import { Route, Routes } from 'react-router-dom';
import { MusicDiscover, MusicHome, MusicNowPlaying } from './routes/tapes/MusicApp';
import { Home } from './routes/Home';
import { FeaturePlaceholder } from './routes/FeaturePlaceholder';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tapes" element={<MusicHome />} />
      <Route path="/tapes/discover" element={<MusicDiscover />} />
      <Route path="/tapes/now-playing" element={<MusicNowPlaying />} />
      <Route path="/static/*" element={<FeaturePlaceholder name="Sleep Static" feature="Podcasts" />} />
      <Route path="/diary/*" element={<FeaturePlaceholder name="Song Diary" feature="Music journal" />} />
      <Route path="/lowlight/*" element={<FeaturePlaceholder name="Lowlight" feature="Dating" />} />
      <Route path="/landing" element={<FeaturePlaceholder name="Bedroom Pop+" feature="Music landing page" />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
