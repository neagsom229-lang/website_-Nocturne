import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { db } from '../db.js';
import { MediaSearchError, searchExternalMedia } from '../mediaSearch.js';

const router = Router();

router.get('/video-search', async (request, response) => {
  const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
  if (!query || query.length > 200) {
    return response.status(400).json({ error: 'A video podcast search query of 1 to 200 characters is required.' });
  }
  try {
    const results = await searchExternalMedia(query, 'video_podcast');
    return response.json({
      query,
      results,
      ...(results.length === 0 ? {
        hint: "iTunes rarely exposes video URLs for podcast episodes. Try searching YouTube for video content, or check the podcast's official site.",
      } : {}),
    });
  } catch (error) {
    if (error instanceof MediaSearchError) {
      if (error.status >= 500) console.error(`Video podcast provider error: ${error.code}`);
      return response.status(error.status).json({ error: 'The iTunes podcast provider could not complete the request.' });
    }
    console.error('Video podcast search failed:', error);
    return response.status(502).json({ error: 'The iTunes podcast provider could not complete the request.' });
  }
});

router.post('/save-video', async (request, response) => {
  const {
    id,
    title,
    channel = null,
    thumbnail_url: thumbnailUrl = null,
    stream_url: streamUrl,
    duration_seconds: durationSeconds = null,
    external_url: externalUrl = null,
  } = request.body ?? {};
  const validHttpsUrl = (value, required = false) => {
    if (value === null || value === undefined) return !required;
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  };
  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    !String(id).trim() || String(id).length > 200 ||
    typeof title !== 'string' || !title.trim() || title.length > 300 ||
    (channel !== null && (typeof channel !== 'string' || channel.length > 300)) ||
    (durationSeconds !== null && (!Number.isInteger(durationSeconds) || durationSeconds < 0)) ||
    !validHttpsUrl(thumbnailUrl) || !validHttpsUrl(streamUrl, true) || !validHttpsUrl(externalUrl)
  ) {
    return response.status(400).json({ error: 'Provide valid video podcast metadata and secure HTTPS URLs.' });
  }

  const externalId = String(id).trim();
  const saved = await db.prepare(`
    INSERT INTO media_library
      (id, user_id, type, provider, external_id, media_type, external_source,
       title, artist, thumbnail_url, stream_url, external_url, duration_seconds)
    VALUES ($1, $2, 'video', 'itunes', $3, 'video_podcast', 'itunes',
       $4, $5, $6, $7, $8, $9)
    ON CONFLICT (user_id, provider, external_id) DO NOTHING
  `).run(
    randomUUID(),
    request.user.id,
    externalId,
    title.trim(),
    channel?.trim() || null,
    thumbnailUrl,
    streamUrl,
    externalUrl,
    durationSeconds,
  );
  const item = await db.prepare(`
    SELECT id, type, provider, external_id AS "externalId", media_type AS "mediaType",
      title, artist, thumbnail_url AS "thumbnailUrl", stream_url AS "streamUrl",
      external_url AS "externalUrl", duration_seconds AS "durationSeconds",
      created_at AS "createdAt"
    FROM media_library
    WHERE user_id = $1 AND provider = 'itunes' AND external_id = $2
  `).get(request.user.id, externalId);
  return response.status(saved.changes ? 201 : 200).json({ item, alreadySaved: !saved.changes });
});

export default router;
