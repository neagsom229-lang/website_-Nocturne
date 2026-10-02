import 'dotenv/config';
import { db } from '../db.js';
import { getTrendingMovies, normalizeMovie } from '../services/movieSearch.js';
import { getRandomTrack } from '../services/audiusSearch.js';

async function diagnose() {
  console.log('--- DIAGNOSTIC: DISCOVER & DATABASE ---');

  // 1. TMDB check
  try {
    const tmdbRes = await getTrendingMovies('week');
    const first = tmdbRes.results?.[0];
    const normalized = first ? normalizeMovie(first) : null;
    console.log('TMDB Trending:', {
      count: tmdbRes.results?.length ?? 0,
      firstTitle: normalized?.title ?? null,
    });
  } catch (error) {
    console.error('TMDB Check Failed:', error.message);
  }

  // 2. Audius check
  try {
    const audiusTrack = await getRandomTrack();
    console.log('Audius Search (lofi):', {
      count: audiusTrack ? 1 : 0,
      firstTitle: audiusTrack?.title ?? null,
      firstStreamUrl: audiusTrack?.streamUrl ?? null,
    });
  } catch (error) {
    console.error('Audius Search Check Failed:', error.message);
  }

  try {
    const trendingUrl = 'https://discoveryprovider.audius.co/v1/tracks/trending?app_name=Nocturne';
    const res = await fetch(trendingUrl, { headers: { Accept: 'application/json' } });
    const text = await res.text();
    console.log('Audius Raw Trending Endpoint:', {
      status: res.status,
      responseLength: text.length,
      ok: res.ok,
    });
  } catch (error) {
    console.error('Audius Raw Trending Fetch Failed:', error.message);
  }

  // 3. iTunes podcast check
  try {
    const itunesUrl = new URL('https://itunes.apple.com/search');
    itunesUrl.search = new URLSearchParams({ term: 'tech', entity: 'podcast', media: 'podcast', limit: '5' });
    const res = await fetch(itunesUrl);
    const data = await res.json();
    const first = data.results?.[0];
    console.log('iTunes Podcast Search (tech):', {
      count: data.resultCount ?? data.results?.length ?? 0,
      firstTitle: first?.collectionName ?? first?.trackName ?? null,
      firstStreamUrl: first?.feedUrl ?? first?.collectionViewUrl ?? null,
    });
  } catch (error) {
    console.error('iTunes Podcast Search Check Failed:', error.message);
  }

  // 4. search_cache check constraint check
  try {
    const constraint = await db.prepare(`
      SELECT pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'search_cache'::regclass AND conname = 'search_cache_type_check'
    `).get();
    console.log('search_cache_type_check constraint:', constraint?.def ?? 'NOT FOUND');
  } catch (error) {
    console.error('Constraint Check Failed (Local SQLite or missing DB?):', error.message);
  }

  console.log('--- DIAGNOSTIC COMPLETE ---');
  process.exit(0);
}

diagnose().catch((err) => {
  console.error('Diagnostic crashed:', err);
  process.exit(1);
});
