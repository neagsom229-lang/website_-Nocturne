export async function searchYouTubeVideos(query, fetchImpl = fetch, apiKey = process.env.YOUTUBE_API_KEY) {
  if (!apiKey) {
    throw new Error('youtube_not_configured');
  }
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '20',
    q: query,
    key: apiKey,
  });
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (!response.ok) {
    throw new Error(`YouTube API returned status ${response.status}`);
  }
  const data = await response.json();
  if (!Array.isArray(data?.items)) return [];
  return data.items.map((item) => {
    const videoId = item.id?.videoId ?? item.id;
    const snippet = item.snippet;
    return {
      id: String(videoId),
      title: snippet?.title ?? 'YouTube Video',
      subtitle: snippet?.channelTitle ?? 'YouTube',
      thumbnail_url: snippet?.thumbnails?.high?.url ?? snippet?.thumbnails?.medium?.url ?? null,
      media_type: 'video',
      source: 'youtube',
      stream_url: `https://www.youtube.com/watch?v=${videoId}`,
      external_url: `https://www.youtube.com/watch?v=${videoId}`,
      duration_seconds: null,
      release_year: snippet?.publishedAt ? new Date(snippet.publishedAt).getFullYear() : null,
      rating: null,
      description: snippet?.description ?? null,
    };
  });
}
