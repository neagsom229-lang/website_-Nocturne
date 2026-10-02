export async function searchDeezerMusic(query, fetchImpl = fetch) {
  const url = new URL('https://api.deezer.com/search');
  url.search = new URLSearchParams({ q: query, limit: '20' });
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Deezer returned status ${response.status}`);
  const data = await response.json();
  const tracks = data?.data ?? [];
  if (!Array.isArray(tracks)) return [];
  return tracks.map((track) => {
    const id = track.id;
    const title = track.title ?? 'Music';
    const artist = track.artist?.name ?? 'Unknown artist';
    return {
      id: String(id),
      title,
      subtitle: artist,
      thumbnail_url: track.album?.cover_medium ?? track.album?.cover_small ?? null,
      media_type: 'music',
      source: 'deezer',
      stream_url: track.preview ?? null,
      external_url: track.link ?? null,
      duration_seconds: track.duration ?? null,
      release_year: null,
      rating: track.rank ?? null,
      description: null,
    };
  });
}
