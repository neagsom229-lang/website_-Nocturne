import assert from 'node:assert/strict';
import test from 'node:test';
import { MediaSearchError, searchExternalMedia } from '../backend/mediaSearch.js';

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

test('YouTube search reports missing server configuration without making a request', async () => {
  await assert.rejects(
    searchExternalMedia('music', 'video', {
      apiKey: '',
      fetchImpl: () => assert.fail('must not call the provider without an API key'),
    }),
    (error) => error instanceof MediaSearchError && error.status === 503,
  );
});
