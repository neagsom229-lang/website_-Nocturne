export type PlaybackTarget =
  | { kind: 'youtube'; videoId: string; title: string }
  | { kind: 'audio'; streamUrl: string; title: string }
  | { kind: 'video'; streamUrl: string; title: string }
  | { kind: 'external'; url: string; title: string; source: string }
  | { kind: 'unsupported'; reason: string };

export function extractYouTubeVideoId(urlOrId?: string | null): string | null {
  if (!urlOrId) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
  try {
    const parsed = new URL(urlOrId);
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      if (parsed.pathname.startsWith('/embed/') || parsed.pathname.startsWith('/v/')) {
        const parts = parsed.pathname.split('/');
        if (parts[2] && /^[a-zA-Z0-9_-]{11}$/.test(parts[2])) return parts[2];
      }
    } else if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.slice(1);
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    const match = urlOrId.match(/(?:v=|\/embed\/|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }
  return null;
}

export function getPlaybackTarget(item: {
  media_type?: string | null;
  source?: string | null;
  stream_url?: string | null;
  external_url?: string | null;
  trailer_url?: string | null;
  title?: string | null;
  id?: string | null;
}): PlaybackTarget {
  const title = item.title ?? 'Untitled';

  const trailerUrl = item.trailer_url;
  const ytCandidate = trailerUrl || (item.source === 'youtube' ? (item.external_url || item.stream_url || item.id) : null);
  const videoId = extractYouTubeVideoId(ytCandidate);
  if (videoId && (
    item.source === 'youtube'
    || trailerUrl
    || item.media_type === 'video_podcast'
    || item.media_type === 'movie'
    || item.media_type === 'tv'
  )) {
    return { kind: 'youtube', videoId, title };
  }

  if (item.source === 'youtube') {
    const id = extractYouTubeVideoId(item.external_url || item.stream_url || item.id);
    if (id) return { kind: 'youtube', videoId: id, title };
  }

  const streamUrl = item.stream_url;
  if (streamUrl && (streamUrl.endsWith('.xml') || streamUrl.includes('/rss') || streamUrl.includes('feed'))) {
    return { kind: 'unsupported', reason: 'RSS feed URL is not directly playable as audio or video' };
  }

  if (item.media_type === 'music') {
    if (item.source === 'audius' || item.source === 'deezer') {
      if (!streamUrl) return { kind: 'unsupported', reason: 'Missing stream URL for music track' };
      return { kind: 'audio', streamUrl, title };
    }
  }

  if (item.media_type === 'podcast') {
    if (!streamUrl) return { kind: 'unsupported', reason: 'Missing podcast audio stream URL' };
    const lower = streamUrl.toLowerCase();
    if (lower.endsWith('.mp3') || lower.endsWith('.m4a') || lower.includes('audio') || lower.includes('stream') || lower.includes('download')) {
      return { kind: 'audio', streamUrl, title };
    }
    return { kind: 'unsupported', reason: 'Podcast URL does not point to a supported audio format (.mp3, .m4a)' };
  }

  if (item.media_type === 'video_podcast' || (item.media_type === 'video' && item.source === 'youtube')) {
    if (videoId) return { kind: 'youtube', videoId, title };
    if (!streamUrl) return { kind: 'unsupported', reason: 'Missing video stream URL' };
    const lower = streamUrl.toLowerCase();
    if (lower.endsWith('.mp4') || lower.endsWith('.m4v') || lower.includes('video')) {
      return { kind: 'video', streamUrl, title };
    }
    return { kind: 'unsupported', reason: 'Video URL does not point to a supported video format (.mp4, .m4v)' };
  }

  if (item.media_type === 'audiobook' || item.source === 'librivox') {
    if (!streamUrl) return { kind: 'unsupported', reason: 'Missing audiobook stream URL' };
    const lower = streamUrl.toLowerCase();
    if (lower.endsWith('.xml') || lower.includes('/rss') || lower.includes('feed')) {
      return { kind: 'unsupported', reason: 'Audiobook URL is a feed, not a playable chapter' };
    }
    return { kind: 'audio', streamUrl, title };
  }

  if (item.media_type === 'movie' || item.media_type === 'tv') {
    if (videoId) return { kind: 'youtube', videoId, title };
    const extUrl = item.external_url;
    if (extUrl) {
      return { kind: 'external', url: extUrl, title, source: item.source ?? 'tmdb' };
    }
    return { kind: 'unsupported', reason: 'No watch page or trailer available for movie/TV show' };
  }

  if (streamUrl) {
    const lower = streamUrl.toLowerCase();
    if (lower.endsWith('.mp3') || lower.endsWith('.m4a')) {
      return { kind: 'audio', streamUrl, title };
    }
    if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) {
      return { kind: 'video', streamUrl, title };
    }
  }

  const ext = item.external_url;
  if (ext) {
    return { kind: 'external', url: ext, title, source: item.source ?? 'external' };
  }

  return { kind: 'unsupported', reason: 'No playable stream or external link found for this media item' };
}
