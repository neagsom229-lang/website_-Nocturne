import { ICON_GLYPHS, type IconName } from './icons/paths';

export type { IconName };

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Provide a label only when the icon carries meaning on its own. */
  label?: string;
};

export function Icon({ name, size = 20, strokeWidth = 1.7, className, label }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      focusable="false"
    >
      {label ? <title>{label}</title> : null}
      {ICON_GLYPHS[name]}
    </svg>
  );
}
