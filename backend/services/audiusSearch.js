const AUDIUS_API = 'https://discoveryprovider.audius.co/v1';
const APP_NAME = 'Nocturne';
const SEARCH_TERMS = ['lofi', 'chill', 'ambient', 'indie', 'jazz', 'electronic'];

export async function getRandomTrack({ fetchImpl = fetch, random = Math.random } = {}) {
  const termIndex = Math.min(Math.floor(random() * SEARCH_TERMS.length), SEARCH_TERMS.length - 1);
  const query = new URLSearchParams({
    query: SEARCH_TERMS[termIndex],
    limit: '25',
    app_name: APP_NAME,
  });
  const response = await fetchImpl(`${AUDIUS_API}/tracks/search?${query}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Audius track search failed with status ${response.status}`);
  }

  const payload = await response.json();
  const tracks = Array.isArray(payload?.data)
    ? payload.data.filter((track) => (
      track &&
      typeof track.id === 'string' &&
      typeof track.title === 'string' &&
      track.is_streamable === true &&
      track.access?.stream === true
    ))
    : [];
  if (tracks.length === 0) throw new Error('Audius returned no streamable tracks');

  const trackIndex = Math.min(Math.floor(random() * tracks.length), tracks.length - 1);
  const track = tracks[trackIndex];
  return {
    id: track.id,
    title: track.title,
    artist: track.user?.name ?? 'Unknown artist',
    artwork: track.artwork?.['480x480'] ?? track.artwork?.['150x150'] ?? null,
    durationSeconds: Number.isFinite(track.duration) ? track.duration : null,
    streamUrl: `${AUDIUS_API}/tracks/${encodeURIComponent(track.id)}/stream?app_name=${APP_NAME}`,
    externalUrl: `https://audius.co${track.permalink ?? ''}`,
  };
}
