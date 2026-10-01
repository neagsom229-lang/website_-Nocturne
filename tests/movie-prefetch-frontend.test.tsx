import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefetchMovieDetails } from '../src/lib/moviesApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('movie detail prefetch queue', () => {
  it('limits concurrent prefetches to three and deduplicates completed results', async () => {
    const pending: Array<(response: Response) => void> = [];
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve)));
    vi.stubGlobal('fetch', fetchMock);

    const ids = ['prefetch-a', 'prefetch-b', 'prefetch-c', 'prefetch-d'];
    const requests = ids.map((id) => prefetchMovieDetails(id));
    expect(fetchMock).toHaveBeenCalledTimes(3);

    for (let index = 0; index < ids.length; index += 1) {
      await vi.waitFor(() => expect(pending.length).toBeGreaterThan(index));
      const resolve = pending[index];
      resolve(new Response(JSON.stringify({ movie: { title: ids[index] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }

    await Promise.all(requests);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    await prefetchMovieDetails(ids[0]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
