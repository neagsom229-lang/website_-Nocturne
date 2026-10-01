import assert from 'node:assert/strict';
import test from 'node:test';
import { getRandomTrack } from '../backend/services/audiusSearch.js';

test('random Audius lookup returns a random streamable track and its stream URL', async () => {
  const randomValues = [0, 0.99];
  let requestUrl;
  const track = await getRandomTrack({
    fetchImpl: async (url) => {
      requestUrl = new URL(url);
      return {
        ok: true,
        json: async () => ({
          data: [
            { id: 'blocked', title: 'Not streamable', is_streamable: false, access: { stream: true } },
            {
              id: 'track-42',
              title: 'Quiet Hours',
              duration: 180,
              permalink: '/artist/quiet-hours',
              artwork: { '480x480': 'https://images.example/cover.jpg' },
              user: { name: 'Night Listener' },
              is_streamable: true,
              access: { stream: true },
            },
          ],
        }),
      };
    },
    random: () => randomValues.shift(),
  });

  assert.equal(requestUrl.pathname, '/v1/tracks/search');
  assert.equal(requestUrl.searchParams.get('app_name'), 'Nocturne');
  assert.equal(requestUrl.searchParams.get('query'), 'lofi');
  assert.equal(track.id, 'track-42');
  assert.equal(track.title, 'Quiet Hours');
  assert.equal(track.artist, 'Night Listener');
  assert.equal(track.artwork, 'https://images.example/cover.jpg');
  assert.equal(track.durationSeconds, 180);
  assert.equal(
    track.streamUrl,
    'https://discoveryprovider.audius.co/v1/tracks/track-42/stream?app_name=Nocturne',
  );
  assert.equal(track.externalUrl, 'https://audius.co/artist/quiet-hours');
});

test('random Audius lookup reports when no tracks are streamable', async () => {
  await assert.rejects(
    getRandomTrack({
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ data: [{ id: 'blocked', title: 'Not streamable', is_streamable: false }] }),
      }),
      random: () => 0,
    }),
    /no streamable tracks/,
  );
});
