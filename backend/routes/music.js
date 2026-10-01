import { Router } from 'express';
import { getRandomTrack } from '../services/audiusSearch.js';

const router = Router();

router.get('/random-audius', async (_request, response) => {
  try {
    const track = await getRandomTrack();
    return response.json({ track });
  } catch (error) {
    console.error('Audius random track request failed:', error);
    return response.status(502).json({ error: 'Audius could not provide a streamable track right now.' });
  }
});

export default router;
