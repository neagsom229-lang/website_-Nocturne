export function Avatar({
  name,
  src,
  size = 'medium',
}: {
  name: string;
  src?: string | null;
  size?: 'small' | 'medium' | 'large';
}) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
  return (
    <span className={`social-avatar social-avatar--${size}`} aria-label={name}>
      {src ? <img src={src} alt="" loading="lazy" /> : <span aria-hidden="true">{initials}</span>}
    </span>
  );
}
