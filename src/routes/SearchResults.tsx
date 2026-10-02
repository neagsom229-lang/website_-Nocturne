import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MediaCard } from '../components/MediaCard';
import { Icon } from '../components/Icon';
import { searchUnified, type UnifiedSearchResultItem } from '../lib/mediaApi';
import type { DiscoveryMedia } from '../types';

export function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const [, startTransition] = useTransition();

  const query = params.get('q') ?? '';
  const type = params.get('type') ?? 'all';
  const sort = params.get('sort') ?? 'relevance';
  const selectedYear = params.get('year') ?? '';
  const selectedRating = params.get('rating') ?? '';
  const selectedDuration = params.get('duration') ?? '';

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return localStorage.getItem('nocturne_search_view') === 'list' ? 'list' : 'grid';
  });

  const [results, setResults] = useState<UnifiedSearchResultItem[]>([]);
  const [sources, setSources] = useState<Record<string, { count: number; error: string | null }>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    localStorage.setItem('nocturne_search_view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      setSources({});
      return;
    }
    let active = true;
    setLoading(true);
    setError('');

    searchUnified({ q: query, type, sort, limit, offset: 0 })
      .then((res) => {
        if (!active) return;
        setResults(res.results);
        setTotal(res.total);
        setSources(res.sources);
        setOffset(0);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Search could not be completed.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, type, sort]);

  function loadMore() {
    const nextOffset = offset + limit;
    if (nextOffset >= total || loading) return;
    setLoading(true);
    searchUnified({ q: query, type, sort, limit, offset: nextOffset })
      .then((res) => {
        setResults((prev) => [...prev, ...res.results]);
        setOffset(nextOffset);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load more results.'))
      .finally(() => setLoading(false));
  }

  function handleQueryChange(newQuery: string) {
    const next = new URLSearchParams(params);
    if (newQuery) next.set('q', newQuery);
    else next.delete('q');
    startTransition(() => {
      setParams(next);
    });
  }

  function handleTypeChange(newType: string) {
    const next = new URLSearchParams(params);
    if (newType === 'all') next.delete('type');
    else next.set('type', newType);
    startTransition(() => {
      setParams(next);
    });
  }

  function handleSortChange(newSort: string) {
    const next = new URLSearchParams(params);
    if (newSort === 'relevance') next.delete('sort');
    else next.set('sort', newSort);
    startTransition(() => {
      setParams(next);
    });
  }

  function handleFilterChange(key: string, val: string) {
    const next = new URLSearchParams(params);
    if (!val) next.delete(key);
    else next.set(key, val);
    startTransition(() => {
      setParams(next);
    });
  }

  // Filter client-side by optional chips (Year, Rating, Duration)
  const filteredResults = results.filter((item) => {
    if (selectedYear) {
      const yr = Number(selectedYear);
      if (item.release_year !== yr) return false;
    }
    if (selectedRating) {
      const minRat = Number(selectedRating);
      if (item.rating === null || item.rating < minRat) return false;
    }
    if (selectedDuration) {
      const secs = item.duration_seconds ?? 0;
      if (selectedDuration === 'short' && secs >= 900) return false; // < 15min
      if (selectedDuration === 'medium' && (secs < 900 || secs > 3600)) return false; // 15-60min
      if (selectedDuration === 'long' && secs <= 3600) return false; // > 60min
    }
    return true;
  });

  function toDiscoveryMedia(item: UnifiedSearchResultItem): DiscoveryMedia {
    return {
      id: item.id,
      title: item.title,
      artist: item.media_type === 'music' ? item.subtitle : null,
      channel: item.media_type !== 'music' ? item.subtitle : null,
      thumbnail_url: item.thumbnail_url,
      stream_url: item.stream_url,
      external_url: item.external_url,
      media_type: item.media_type === 'video_podcast' ? 'video' : item.media_type,
      source: item.source as any,
      duration_seconds: item.duration_seconds,
      release_year: item.release_year,
      rating: item.rating,
      description: item.description,
    };
  }

  // Source summary text
  const sourceSummaryEntries = Object.entries(sources).flatMap(([src, info]) => {
    if (info.error) return [`${src.toUpperCase()} unavailable`];
    if (info.count > 0) return [`${info.count} from ${src.toUpperCase()}`];
    return [];
  });
  const sourceErrors = Object.entries(sources).filter(([_, info]) => info.error);

  return (
    <main className="workspace-main" role="main">
      <div className="search-results-page">
        <header className="search-results__header">
          <div className="search-results__input-row">
            <Icon name="search" size={20} />
            <input
              type="search"
              aria-label="Search across all sources"
              placeholder="Search songs, podcasts, movies, videos..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
            />
          </div>

          <div className="search-results__controls">
            <div className="media-tabs" role="tablist" aria-label="Search type tabs">
              {[
                { key: 'all', label: 'All' },
                { key: 'music', label: 'Music' },
                { key: 'podcast', label: 'Podcasts' },
                { key: 'movie', label: 'Movies' },
                { key: 'video_podcast', label: 'Video' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={type === tab.key}
                  className={`media-tab ${type === tab.key ? 'media-tab--active' : ''}`}
                  onClick={() => handleTypeChange(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="search-results__dropdowns">
              <select
                aria-label="Sort results"
                value={sort}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="relevance">Relevance</option>
                <option value="recent">Recent</option>
                <option value="popular">Popular</option>
              </select>

              <div className="search-results__view-toggle">
                <button
                  type="button"
                  aria-label="Grid view"
                  className={viewMode === 'grid' ? 'active' : ''}
                  onClick={() => setViewMode('grid')}
                >
                  <Icon name="grid" size={16} />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  className={viewMode === 'list' ? 'active' : ''}
                  onClick={() => setViewMode('list')}
                >
                  <Icon name="list" size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Optional Filter Chips */}
          <div className="search-results__filter-chips">
            {type === 'movie' || type === 'all' ? (
              <>
                <select
                  aria-label="Filter by year"
                  value={selectedYear}
                  onChange={(e) => handleFilterChange('year', e.target.value)}
                >
                  <option value="">All Years</option>
                  {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter by minimum rating"
                  value={selectedRating}
                  onChange={(e) => handleFilterChange('rating', e.target.value)}
                >
                  <option value="">Any Rating</option>
                  <option value="7">Rating ≥ 7</option>
                  <option value="8">Rating ≥ 8</option>
                </select>
              </>
            ) : null}
            {type === 'podcast' || type === 'video_podcast' || type === 'all' ? (
              <select
                aria-label="Filter by duration"
                value={selectedDuration}
                onChange={(e) => handleFilterChange('duration', e.target.value)}
              >
                <option value="">Any Duration</option>
                <option value="short">&lt; 15 mins</option>
                <option value="medium">15 – 60 mins</option>
                <option value="long">&gt; 60 mins</option>
              </select>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className="search-results__notice" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => handleQueryChange(query)}>Retry?</button>
          </div>
        ) : null}

        {sourceErrors.map(([src, info]) => (
          <div key={src} className="search-results__notice" role="alert">
            <span>Couldn't reach {src.toUpperCase()}. {info.error}</span>
            <button type="button" onClick={() => handleQueryChange(query)}>Retry?</button>
          </div>
        ))}

        {!query.trim() ? (
          <div className="empty-state">
            <Icon name="search" size={48} />
            <h2>Search everything in Nocturne</h2>
            <p>Explore songs, podcasts, movies, and video podcasts from all your favorite sources.</p>
          </div>
        ) : loading && results.length === 0 ? (
          <div className="search-results__loading" role="status">
            <span className="route-loading__spinner" aria-hidden="true" />
            <p>Gathering results from across sources…</p>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="empty-state">
            <Icon name="search" size={48} />
            <h2>No results for '{query}'</h2>
            <p>{type === 'video_podcast' ? 'No video podcasts found. Try music, movies, or audio podcasts.' : 'Try a different keyword or check one of our trending searches:'}</p>
            {type !== 'video_podcast' ? (
              <div className="search-results__suggestions">
                {['ambient lofi', 'late night podcast', 'indie cinema'].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => handleQueryChange(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className={`search-results__grid search-results__grid--${viewMode}`}>
              {filteredResults.map((item) => (
                <div key={`${item.source}-${item.id}`} className="search-result-item-wrap">
                  <MediaCard media={toDiscoveryMedia(item)} />
                </div>
              ))}
            </div>

            {results.length < total ? (
              <div className="search-results__load-more">
                <button type="button" className="btn btn--secondary" onClick={loadMore} disabled={loading}>
                  {loading ? 'Loading more…' : 'Load more results'}
                </button>
              </div>
            ) : null}
          </>
        )}

        <footer className="search-results__footer">
          {sourceSummaryEntries.length > 0 ? (
            <p>{sourceSummaryEntries.join(', ')}.</p>
          ) : (
            <p>Unified search across Audius, iTunes, and TMDB.</p>
          )}
        </footer>
      </div>
    </main>
  );
}
