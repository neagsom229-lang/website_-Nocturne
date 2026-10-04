import { CommandPaletteRow } from './CommandPaletteRow';

export function RecentSearches({
  recents,
  onSelect,
  onRemove,
  onClear,
}: {
  recents: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
}) {
  if (!recents.length) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="command-palette-section-title">
        <span>Recent Searches</span>
        <button type="button" onClick={onClear} style={{ background: 'none', border: 'none', color: 'var(--tp-acc)', cursor: 'pointer', fontSize: '11px' }}>
          Clear all
        </button>
      </div>
      {recents.map((query) => (
        <CommandPaletteRow
          key={query}
          icon="search"
          title={query}
          isSelected={false}
          onClick={() => onSelect(query)}
          onRemove={() => onRemove(query)}
        />
      ))}
    </div>
  );
}
