export async function searchAudiobooks(query, fetchImpl = fetch) {
  const url = new URL('https://librivox.org/api/feed/audiobooks');
  url.search = new URLSearchParams({ title: query, format: 'json' });
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`LibriVox returned status ${response.status}`);
  const data = await response.json();
  const books = data?.books ?? [];
  if (!Array.isArray(books)) return [];
  return books.map((book) => {
    const id = book.id;
    const title = book.title ?? 'Audiobook';
    const author = Array.isArray(book.authors) && book.authors[0] ? `${book.authors[0].first_name ?? ''} ${book.authors[0].last_name ?? ''}`.trim() : 'Unknown author';
    return {
      id: String(id),
      title,
      subtitle: author,
      thumbnail_url: null,
      media_type: 'audiobook',
      source: 'librivox',
      stream_url: book.url_zip ?? book.url_rss ?? null,
      external_url: book.url_text_source ?? `https://librivox.org/book/${id}`,
      duration_seconds: Number(book.total_time_secs) || null,
      release_year: book.copyright_year ? Number(book.copyright_year) : null,
      rating: null,
      description: book.description ?? null,
    };
  });
}
