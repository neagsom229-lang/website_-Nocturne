import 'dotenv/config';
import { searchTvShows } from '../services/tvSearch.js';
import { searchYouTubeVideos } from '../services/youtubeSearch.js';
import { searchAudiobooks } from '../services/librivoxSearch.js';
import { searchDeezerMusic } from '../services/deezerSearch.js';

async function diagnose() {
  console.log('--- DIAGNOSTIC: FULL PROVIDER COVERAGE ---');

  // 1. TMDB TV check
  try {
    const tv = await searchTvShows('breaking bad');
    console.info('[diag] tv:', { count: tv.length, first: tv[0]?.title });
  } catch (error) {
    console.error('TV Search Check Failed:', error.message);
  }

  // 2. YouTube check
  try {
    const yt = await searchYouTubeVideos('lofi beats');
    console.info('[diag] youtube:', { count: yt.length, first: yt[0]?.title });
  } catch (error) {
    console.error('YouTube Search Check Failed:', error.message);
  }

  // 3. LibriVox check
  try {
    const lb = await searchAudiobooks('sherlock');
    console.info('[diag] librivox:', { count: lb.length, first: lb[0]?.title });
  } catch (error) {
    console.error('LibriVox Search Check Failed:', error.message);
  }

  // 4. Deezer check
  try {
    const dz = await searchDeezerMusic('chillwave');
    console.info('[diag] deezer:', { count: dz.length, first: dz[0]?.title });
  } catch (error) {
    console.error('Deezer Search Check Failed:', error.message);
  }

  console.log('--- DIAGNOSTIC COMPLETE ---');
}

diagnose().catch((err) => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
