import { CommandPaletteRow } from './CommandPaletteRow';

export function QuickActions({
  selectedIndex,
  startIndex = 0,
  onSelect,
}: {
  selectedIndex: number;
  startIndex?: number;
  onSelect: (action: string) => void;
}) {
  const actions = [
    { id: 'movies', label: 'Go to Movies', icon: 'play-circle' as const, hint: 'Open' },
    { id: 'random', label: 'Play a random track', icon: 'sparkle' as const, hint: 'Play' },
    { id: 'library', label: 'Open my library', icon: 'library' as const, hint: 'Open' },
    { id: 'playlists', label: 'Open my playlists', icon: 'library' as const, hint: 'Open' },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="command-palette-section-title">Quick Actions</div>
      {actions.map((action, index) => {
        const globalIndex = startIndex + index;
        return (
          <CommandPaletteRow
            key={action.id}
            icon={action.icon}
            title={action.label}
            hint={action.hint}
            isSelected={selectedIndex === globalIndex}
            onClick={() => onSelect(action.id)}
          />
        );
      })}
    </div>
  );
}
