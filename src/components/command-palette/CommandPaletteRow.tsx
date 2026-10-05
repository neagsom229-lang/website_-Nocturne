import { Icon, type IconName } from '../Icon';
import { SmartImage } from '../SmartImage';

export function CommandPaletteRow({
  icon,
  thumb,
  title,
  subtitle,
  hint,
  isSelected,
  onClick,
  onRemove,
}: {
  icon?: IconName;
  thumb?: string | null;
  title: string;
  subtitle?: string;
  hint?: string;
  isSelected: boolean;
  onClick: () => void;
  onRemove?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      className={`command-palette-row ${isSelected ? 'is-selected' : ''}`}
      onClick={onClick}
    >
      {thumb ? (
        <SmartImage src={thumb} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flex: 'none' }} />
      ) : icon ? (
        <span style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 6, background: 'var(--tp-surf-2)', color: 'var(--tp-acc)', flex: 'none' }}>
          <Icon name={icon} size={16} />
        </span>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
        <span style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {subtitle ? <span style={{ fontSize: '11px', color: 'var(--tp-mute)' }}>{subtitle}</span> : null}
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(e); }}
          style={{ background: 'none', border: 'none', color: 'var(--tp-mute)', cursor: 'pointer', padding: 4 }}
          aria-label="Remove recent search"
        >
          <Icon name="close" size={14} />
        </button>
      ) : hint ? (
        <span style={{ fontSize: '11px', color: 'var(--tp-mute)', fontFamily: 'var(--tp-font-mono)' }}>{hint}</span>
      ) : null}
    </button>
  );
}
