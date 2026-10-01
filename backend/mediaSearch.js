export class MediaSearchError extends Error {
  constructor(code, status = 502) {
    super(code);
    this.name = 'MediaSearchError';
    this.code = code;
    this.status = status;
  }
}

async function fetchJson(url, provider, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new MediaSearchError(`${provider}_unavailable`);
  }

  if (!response.ok) throw new MediaSearchError(`${provider}_rejected`);
  try {
    return await response.json();
  } catch {
    throw new MediaSearchError(`${provider}_invalid_response`);
  }
}

function secureUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function searchYouTube(query, apiKey, fetchImpl) {
  if (!apiKey) {
    throw new MediaSearchError('youtube_not_configured', 503);
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '20',
    q: query,
    key: apiKey,
  });

  return fetchJson(url, 'youtube', fetchImpl).then((data) => {
    if (!Array.isArray(data.items)) throw new MediaSearchError('youtube_invalid_response');
    return data.items.flatMap((item) => {
      const videoId = item.id?.videoId;
      const title = item.snippet?.title;
      if (typeof videoId !== 'string' || typeof title !== 'string') return [];

      const thumbnails = item.snippet.thumbnails ?? {};
      const thumbnailUrl = secureUrl(
        thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url,
      );
      return [{
        type: 'video',
        provider: 'youtube',
        externalId: videoId,
        title,
        artist: item.snippet.channelTitle ?? null,
        thumbnailUrl,
        streamUrl: `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`,
        externalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      }];
    });
  });
}

async function searchITunes(query, type, fetchImpl) {
  const podcast = type === 'podcast';
  const url = new URL('https://itunes.apple.com/search');
  url.search = new URLSearchParams({
    term: query,
    entity: podcast ? 'podcastEpisode' : 'song',
    media: podcast ? 'podcast' : 'music',
    limit: '20',
  });
  const data = await fetchJson(url, 'itunes', fetchImpl);
  if (!Array.isArray(data.results)) throw new MediaSearchError('itunes_invalid_response');

  return data.results.flatMap((item) => {
    const externalId = item.trackId;
    const title = item.trackName;
    if (externalId === undefined || typeof title !== 'string') return [];

    const streamUrl = secureUrl(podcast ? item.episodeUrl ?? item.previewUrl : item.previewUrl);
    if (!streamUrl) return [];

    return [{
      type,
      provider: 'itunes',
      externalId: String(externalId),
      title,
      artist: item.artistName ?? null,
      thumbnailUrl: secureUrl(item.artworkUrl600 ?? item.artworkUrl100),
      streamUrl,
      externalUrl: secureUrl(item.trackViewUrl ?? item.collectionViewUrl),
    }];
  });
}

export async function searchExternalMedia(query, type, {
  apiKey = process.env.YOUTUBE_API_KEY,
  fetchImpl = fetch,
} = {}) {
  if (type === 'video') return searchYouTube(query, apiKey, fetchImpl);
  return searchITunes(query, type, fetchImpl);
}
