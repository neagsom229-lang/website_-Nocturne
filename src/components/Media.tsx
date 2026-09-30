import type { ReactNode } from 'react';

type Ratio = 'portrait' | 'square' | 'wide' | 'tall' | 'banner' | 'fill';

type MediaProps = {
  /** Omit to fall back to a theme gradient plate. */
  src?: string;
  alt?: string;
  ratio?: Ratio;
  className?: string;
  /** Darken the lower edge so overlaid type keeps its contrast. */
  scrim?: boolean;
  children?: ReactNode;
};

/**
 * The theme's photo treatment: every image in the pack goes through this container so
 * --tp-img-* (radius, frame, filter, overlay, blend, tilt, aspect) is always applied.
 */
export function Media({ src, alt = '', ratio = 'portrait', className, scrim = false, children }: MediaProps) {
  const modifier = ratio === 'portrait' ? '' : ` media--${ratio}`;
  return (
    <div className={`media${modifier}${className ? ` ${className}` : ''}`} aria-hidden={src ? undefined : true}>
      {src ? <img src={src} alt={alt} loading="lazy" decoding="async" /> : null}
      <span className="media__overlay" aria-hidden="true" />
      {scrim ? <span className="media__scrim" aria-hidden="true" /> : null}
      {children}
    </div>
  );
}
