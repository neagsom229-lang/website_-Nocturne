import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../Icon';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { useRecentSearches } from '../../lib/useRecentSearches';
import { searchSuggest, type SuggestionItem } from '../../lib/mediaApi';
import { useWorkspacePlayer } from '../../lib/workspaceHooks';
import { QuickActions } from './QuickActions';
import { RecentSearches } from './RecentSearches';
import { CommandPaletteRow } from './CommandPaletteRow';
import { useFocusTrap } from '../../lib/useFocusTrap';
import '../../styles/command-palette.css';

export default function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { playExternalMedia } = useWorkspacePlayer();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 200);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { recents, addRecent, removeRecent, clearRecents } = useRecentSearches();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const controller = new AbortController();

    searchSuggest(q, { signal: controller.signal })
      .then((items) => {
        if (!active) return;
        setSuggestions(items);
      })
      .catch((err) => {
        if (active && err?.name !== 'AbortError') setSuggestions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [debouncedQuery]);

  const hasQuery = query.trim().length >= 2;
  const totalItems = hasQuery ? suggestions.length : recents.length + 4;

  const handleSelect = useCallback(async (type: 'action' | 'recent' | 'suggestion', value: any) => {
    if (type === 'action') {
      if (value === 'movies') navigate('/movies');
      else if (value === 'library') navigate('/library');
      else if (value === 'playlists') navigate('/playlists');
      else if (value === 'random') {
        try {
          const res = await fetch('/api/music/random-audius');
          const data = await res.json();
          const track = data?.track || data;
          if (track?.stream_url || track?.streamUrl) {
            playExternalMedia({
              type: 'audio',
              provider: 'audius',
              externalId: track.id,
              title: track.title,
              artist: track.artist,
              thumbnailUrl: track.thumbnail_url || track.artwork || null,
              streamUrl: track.stream_url || track.streamUrl,
              externalUrl: track.external_url || track.externalUrl || null,
            });
            onClose();
          }
        } catch {}
        return;
      }
    } else if (type === 'recent') {
      addRecent(value);
      navigate(`/search?q=${encodeURIComponent(value)}`);
    } else if (type === 'suggestion') {
      addRecent(value.title);
      switch (value.media_type) {
        case 'music':
          playExternalMedia({
            type: 'audio',
            provider: value.source || 'audius',
            externalId: value.id,
            title: value.title,
            artist: value.subtitle || value.artist || null,
            thumbnailUrl: value.thumbnail_url,
            streamUrl: value.stream_url || '',
            externalUrl: value.external_url || null,
          });
          break;
        case 'movie':         navigate(`/movies/${encodeURIComponent(value.id)}`); break;
        case 'tv':            navigate(`/tv/${encodeURIComponent(value.id)}`); break;
        case 'podcast':       navigate(`/podcasts/${encodeURIComponent(value.id)}`); break;
        case 'audiobook':     navigate(`/audiobooks/${encodeURIComponent(value.id)}`); break;
        case 'video_podcast': navigate(`/video-podcasts/${encodeURIComponent(value.id)}`); break;
        default:
          navigate(`/search?q=${encodeURIComponent(value.title)}`);
      }
    }
    onClose();
  }, [navigate, addRecent, onClose, playExternalMedia]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (totalItems > 0 ? (prev + 1) % totalItems : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (totalItems > 0 ? (prev - 1 + totalItems) % totalItems : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!hasQuery) {
        if (selectedIndex < recents.length) {
          handleSelect('recent', recents[selectedIndex]);
        } else {
          const actionIndex = selectedIndex - recents.length;
          const actions = ['movies', 'random', 'library', 'playlists'];
          if (actions[actionIndex]) handleSelect('action', actions[actionIndex]);
        }
      } else {
        if (suggestions[selectedIndex]) {
          handleSelect('suggestion', suggestions[selectedIndex]);
        }
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  // Focus trap
  useFocusTrap(modalRef, isOpen);

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose} role="presentation">
      <div
        className="command-palette-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onKeyDown={handleKeyDown}
      >
        <div className="command-palette-input-wrapper">
          <Icon name="search" size={18} />
          <input
            id="command-palette-title"
            ref={inputRef}
            type="text"
            aria-label="Search"
            placeholder="Search songs, stories, people…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
          />
          <kbd style={{ fontSize: '10px', padding: '2px 6px', border: '1px solid var(--tp-line)', borderRadius: '6px', color: 'var(--tp-mute)' }}>Esc</kbd>
        </div>
        <div className="command-palette-content" role="listbox">
          <div role="status" aria-live="polite" className="sr-only">
            {hasQuery ? `${suggestions.length} results for '${query}'` : 'Recent searches and quick actions'}
          </div>
          {hasQuery ? (
            loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="media-skeleton" style={{ height: 44, marginBottom: 8 }} />
              ))
            ) : suggestions.length > 0 ? (
              <div>
                <div className="command-palette-section-title">Suggestions</div>
                {suggestions.map((item, index) => (
                  <CommandPaletteRow
                    key={`${item.source}-${item.id}`}
                    thumb={item.thumbnail_url}
                    title={item.title}
                    subtitle={`${item.media_type} (${item.source})`}
                    hint="Enter"
                    isSelected={selectedIndex === index}
                    onClick={() => handleSelect('suggestion', item)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--tp-mute)' }}>
                <p>No results for &ldquo;{query}&rdquo;. Try a different word.</p>
              </div>
            )
          ) : (
            <>
              <RecentSearches
                recents={recents}
                selectedIndex={selectedIndex}
                onSelect={(q) => handleSelect('recent', q)}
                onRemove={removeRecent}
                onClear={clearRecents}
              />
              <QuickActions
                selectedIndex={selectedIndex}
                startIndex={recents.length}
                onSelect={(actionId) => handleSelect('action', actionId)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
