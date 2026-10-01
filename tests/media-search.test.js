import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MediaSearchError,
  normalizeVideoPodcastResults,
  searchExternalMedia,
} from '../backend/mediaSearch.js';

test('YouTube search results are normalized as embeddable video metadata', async () => {
  let requestedUrl;
  const results = await searchExternalMedia('late night', 'video', {
    apiKey: 'test-key',
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return {
        ok: true,
        json: async () => ({
          items: [{
            id: { videoId: 'video-123' },
            snippet: {
              title: 'A late-night song',
              channelTitle: 'Artist',
              thumbnails: { high: { url: 'https://img.example/video.jpg' } },
            },
          }],
        }),
      };
    },
  });

  assert.equal(requestedUrl.searchParams.get('key'), 'test-key');
  assert.equal(requestedUrl.searchParams.get('q'), 'late night');
  assert.deepEqual(results, [{
    type: 'video',
    provider: 'youtube',
    externalId: 'video-123',
    title: 'A late-night song',
    artist: 'Artist',
    thumbnailUrl: 'https://img.example/video.jpg',
    streamUrl: 'https://www.youtube.com/embed/video-123',
    externalUrl: 'https://www.youtube.com/watch?v=video-123',
  }]);
});

test('iTunes podcast episode results only include secure playable media URLs', async () => {
  let requestedUrl;
  const results = await searchExternalMedia('quiet stories', 'podcast', {
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              trackId: 44,
              trackName: 'The quiet room',
              artistName: 'A. Host',
              episodeUrl: 'https://audio.example/episode.mp3',
              artworkUrl100: 'https://img.example/podcast.jpg',
              trackViewUrl: 'https://podcasts.example/episode',
            },
            { trackId: 45, trackName: 'No playable episode URL' },
          ],
        }),
      };
    },
  });

  assert.equal(requestedUrl.searchParams.get('entity'), 'podcastEpisode');
  assert.equal(requestedUrl.searchParams.get('media'), 'podcast');
  assert.deepEqual(results, [{
    type: 'podcast',
    provider: 'itunes',
    externalId: '44',
    title: 'The quiet room',
    artist: 'A. Host',
    thumbnailUrl: 'https://img.example/podcast.jpg',
    streamUrl: 'https://audio.example/episode.mp3',
    externalUrl: 'https://podcasts.example/episode',
  }]);
});

test('iTunes audio results use preview URLs and omit unplayable or insecure results', async () => {
  const results = await searchExternalMedia('soft songs', 'audio', {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        results: [
          { trackId: 11, trackName: 'Preview', previewUrl: 'https://audio.example/preview.mp3' },
          { trackId: 12, trackName: 'No preview' },
          { trackId: 13, trackName: 'Insecure', previewUrl: 'http://audio.example/track.mp3' },
        ],
      }),
    }),
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].type, 'audio');
  assert.equal(results[0].streamUrl, 'https://audio.example/preview.mp3');
});

test('iTunes video podcast search requests episode results and filters audio-only episodes', async () => {
  let requestedUrl;
  const results = await searchExternalMedia('night stories', 'video_podcast', {
    fetchImpl: async (url) => {
      requestedUrl = new URL(url);
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              trackId: 71,
              trackName: 'The filmed episode',
              artistName: 'Night Stories',
              previewUrl: 'https://media.example/episode-71.M4V?token=abc',
              artworkUrl100: 'https://images.example/show.jpg',
              trackTimeMillis: 123456,
              trackViewUrl: 'https://podcasts.example/episode/71',
            },
            {
              trackId: 72,
              trackName: 'Audio-only episode',
              previewUrl: 'https://media.example/episode-72.mp3',
            },
            {
              trackId: 73,
              trackName: 'Video URL episode',
              previewUrl: 'https://media.example/audio-73.mp3',
              videoUrl: 'https://media.example/video-73.mp4',
            },
            {
              trackId: 74,
              trackName: 'Insecure video',
              videoUrl: 'http://media.example/video-74.mp4',
            },
            {
              trackId: 75,
              trackName: 'Malformed preview',
              previewUrl: 'not a valid url',
            },
            {
              trackId: 76,
              trackName: 'Empty video URL',
              videoUrl: '   ',
            },
            {
              trackId: 77,
              trackName: 'MP4 preview with query',
              previewUrl: 'https://media.example/episode-77.mp4?token=abc',
            },
            {
              trackId: 78,
              trackName: 'MP3 preview only',
              previewUrl: 'https://media.example/episode-78.mp3',
            },
          ],
        }),
      };
    },
  });

  assert.equal(requestedUrl.origin + requestedUrl.pathname, 'https://itunes.apple.com/search');
  assert.equal(requestedUrl.searchParams.get('term'), 'night stories');
  assert.equal(requestedUrl.searchParams.get('media'), 'podcast');
  assert.equal(requestedUrl.searchParams.get('entity'), 'podcastEpisode');
  assert.deepEqual(results, [
    {
      id: '71',
      title: 'The filmed episode',
      channel: 'Night Stories',
      thumbnail_url: 'https://images.example/show.jpg',
      stream_url: 'https://media.example/episode-71.M4V?token=abc',
      duration_seconds: 123,
      media_type: 'video_podcast',
      source: 'itunes',
      external_url: 'https://podcasts.example/episode/71',
    },
    {
      id: '73',
      title: 'Video URL episode',
      channel: 'Unknown channel',
      thumbnail_url: null,
      stream_url: 'https://media.example/video-73.mp4',
      duration_seconds: null,
      media_type: 'video_podcast',
      source: 'itunes',
      external_url: null,
    },
    {
      id: '77',
      title: 'MP4 preview with query',
      channel: 'Unknown channel',
      thumbnail_url: null,
      stream_url: 'https://media.example/episode-77.mp4?token=abc',
      duration_seconds: null,
      media_type: 'video_podcast',
      source: 'itunes',
      external_url: null,
    },
  ]);
});

test('video podcast normalizer rejects audio-only and malformed URLs without failing the batch', () => {
  assert.deepEqual(normalizeVideoPodcastResults([
    { trackId: 81, trackName: 'Audio only', previewUrl: 'https://media.example/audio.m4a' },
    { trackName: 'No ID', videoUrl: 'https://media.example/video.mp4' },
    { trackId: 82, trackName: 'Malformed preview', previewUrl: 'not a valid url' },
    { trackId: 83, trackName: 'Empty video URL', videoUrl: '' },
    { trackId: 84, trackName: 'MP3 preview only', previewUrl: 'https://media.example/audio.mp3' },
  ]), []);

  assert.throws(
    () => normalizeVideoPodcastResults({ results: [] }),
    (error) => error instanceof MediaSearchError && error.code === 'itunes_invalid_response',
  );
});

test('YouTube search reports missing server configuration without making a request', async () => {
  await assert.rejects(
    searchExternalMedia('music', 'video', {
      apiKey: '',
      fetchImpl: () => assert.fail('must not call the provider without an API key'),
    }),
    (error) => error instanceof MediaSearchError && error.status === 503,
  );
});
