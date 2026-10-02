const CURATED_AUDIOBOOKS = [
  {
    id: 'librivox-1',
    title: 'Sherlock Holmes - A Study in Scarlet',
    subtitle: 'Arthur Conan Doyle',
    thumbnail_url: null,
    media_type: 'audiobook',
    source: 'librivox',
    stream_url: 'https://archive.org/download/study_in_scarlet_1202_librivox/study_in_scarlet_doyle_64kb.mp3',
    external_url: 'https://librivox.org/a-study-in-scarlet-by-arthur-conan-doyle/',
    duration_seconds: 22500,
    release_year: 1887,
    rating: 4.8,
    description: 'A Study in Scarlet is an 1887 detective novel by Scottish writer Arthur Conan Doyle.',
  },
  {
    id: 'librivox-2',
    title: 'Pride and Prejudice',
    subtitle: 'Jane Austen',
    thumbnail_url: null,
    media_type: 'audiobook',
    source: 'librivox',
    stream_url: 'https://archive.org/download/pride_and_prejudice_librivox/pride_and_prejudice_austen_64kb.mp3',
    external_url: 'https://librivox.org/pride-and-prejudice-by-jane-austen/',
    duration_seconds: 35000,
    release_year: 1813,
    rating: 4.9,
    description: 'Pride and Prejudice is an 1813 romantic novel of manners written by Jane Austen.',
  }
];

export async function searchAudiobooks(query, fetchImpl = fetch) {
  try {
    const url = new URL('https://librivox.org/api/feed/audiobooks');
    url.search = new URLSearchParams({ title: query, format: 'json' });
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`LibriVox returned status ${response.status}`);
    const data = await response.json();
    const books = data?.books ?? [];
    if (!Array.isArray(books) || books.length === 0) {
      return CURATED_AUDIOBOOKS;
    }
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
  } catch (error) {
    console.warn('LibriVox search failed/timed out, using curated fallback:', error.message);
    return CURATED_AUDIOBOOKS;
  }
}
