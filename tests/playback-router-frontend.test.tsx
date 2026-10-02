import { describe, it, expect } from 'vitest';
import { getPlaybackTarget } from '../src/lib/playbackRouter';

describe('playbackRouter', () => {
  it('handles YouTube URL variations', () => {
    const t1 = getPlaybackTarget({ source: 'youtube', external_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Test 1' });
    expect(t1).toEqual({ kind: 'youtube', videoId: 'dQw4w9WgXcQ', title: 'Test 1' });

    const t2 = getPlaybackTarget({ source: 'youtube', external_url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Test 2' });
    expect(t2).toEqual({ kind: 'youtube', videoId: 'dQw4w9WgXcQ', title: 'Test 2' });

    const t3 = getPlaybackTarget({ source: 'youtube', external_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', title: 'Test 3' });
    expect(t3).toEqual({ kind: 'youtube', videoId: 'dQw4w9WgXcQ', title: 'Test 3' });
  });

  it('handles Audius URLs with query strings', () => {
    const t = getPlaybackTarget({
      media_type: 'music',
      source: 'audius',
      stream_url: 'https://discoveryprovider.audius.co/v1/tracks/tr123/stream?app_name=Nocturne',
      title: 'Audius Song',
    });
    expect(t).toEqual({
      kind: 'audio',
      streamUrl: 'https://discoveryprovider.audius.co/v1/tracks/tr123/stream?app_name=Nocturne',
      title: 'Audius Song',
    });
  });

  it('handles Deezer preview URLs', () => {
    const t = getPlaybackTarget({
      media_type: 'music',
      source: 'deezer',
      stream_url: 'https://cdns-preview-d.dzcdn.net/stream/c-d12345.mp3',
      title: 'Deezer Preview',
    });
    expect(t).toEqual({
      kind: 'audio',
      streamUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-d12345.mp3',
      title: 'Deezer Preview',
    });
  });

  it('rejects RSS feed URLs as unsupported', () => {
    const t = getPlaybackTarget({
      media_type: 'podcast',
      source: 'itunes',
      stream_url: 'https://example.com/podcast/feed.xml',
      title: 'RSS Podcast',
    });
    expect(t.kind).toBe('unsupported');
  });

  it('rejects missing stream_url as unsupported', () => {
    const t = getPlaybackTarget({
      media_type: 'podcast',
      source: 'itunes',
      stream_url: null,
      title: 'No Stream',
    });
    expect(t.kind).toBe('unsupported');
  });

  it('handles Audiobook (LibriVox) as playable audio or rejects xml feeds', () => {
    const t = getPlaybackTarget({
      media_type: 'audiobook',
      source: 'librivox',
      stream_url: 'https://archive.org/download/audio/chapter1.mp3',
      title: 'Audiobook Chapter 1',
    });
    expect(t.kind).toBe('audio');

    const tXml = getPlaybackTarget({
      media_type: 'audiobook',
      source: 'librivox',
      stream_url: 'https://archive.org/download/audio/feed.xml',
      title: 'Audiobook Feed',
    });
    expect(tXml.kind).toBe('unsupported');
  });

  it('handles Movie and TV branches', () => {
    const tTrailer = getPlaybackTarget({
      media_type: 'movie',
      source: 'tmdb',
      trailer_url: 'https://www.youtube.com/watch?v=abcdefghijk',
      title: 'Inception',
    });
    expect(tTrailer.kind).toBe('youtube');

    const tExternal = getPlaybackTarget({
      media_type: 'tv',
      source: 'tmdb',
      external_url: 'https://www.themoviedb.org/tv/12345',
      title: 'Breaking Bad',
    });
    expect(tExternal).toEqual({
      kind: 'external',
      url: 'https://www.themoviedb.org/tv/12345',
      title: 'Breaking Bad',
      source: 'tmdb',
    });

    const tNoTrailerOrExt = getPlaybackTarget({
      media_type: 'movie',
      source: 'tmdb',
      title: 'Unknown Movie',
    });
    expect(tNoTrailerOrExt.kind).toBe('unsupported');
  });

  it('handles Video podcast branches', () => {
    const tVideo = getPlaybackTarget({
      media_type: 'video_podcast',
      source: 'itunes',
      stream_url: 'https://example.com/podcast/episode.mp4',
      title: 'Video Pod',
    });
    expect(tVideo).toEqual({
      kind: 'video',
      streamUrl: 'https://example.com/podcast/episode.mp4',
      title: 'Video Pod',
    });

    const tYtVideo = getPlaybackTarget({
      media_type: 'video_podcast',
      source: 'youtube',
      external_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'YT Video Pod',
    });
    expect(tYtVideo.kind).toBe('youtube');
  });
});
