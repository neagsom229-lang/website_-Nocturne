import { useState, type CSSProperties } from 'react';

/**
 * Artwork plates for the pack.
 *
 * A cover is identified by a seed string. If that seed has a matching photograph the
 * photo is used (with the theme's --tp-img-* treatment, plus a scrim so any label keeps
 * contrast). Otherwise the plate is composed from theme tokens — gradient, accent and
 * the theme's grain pattern — never a grey box and never a broken image.
 */
const COVER_PHOTOS: Record<string, string> = {
  lamp: '/images/cover-lamp.png',
};

const VARIANTS = 6;

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/* Dark bases with a contained pool of accent light — the accent never fills the plate,
   so the artwork reads as a lit room rather than a coloured rectangle. */
const PLATES: string[] = [
  'radial-gradient(58% 46% at 26% 16%, var(--tp-acc) 0%, transparent 64%), linear-gradient(158deg, var(--tp-surf-2) 0%, var(--tp-surf) 100%)',
  'radial-gradient(46% 38% at 80% 18%, var(--tp-acc-2) 0%, transparent 70%), radial-gradient(52% 44% at 14% 86%, var(--tp-acc) 0%, transparent 72%), var(--tp-canvas)',
  'repeating-linear-gradient(118deg, var(--tp-surf-2) 0 16px, var(--tp-surf) 16px 32px)',
  'radial-gradient(70% 50% at 50% 116%, var(--tp-acc) 0%, transparent 66%), linear-gradient(200deg, var(--tp-surf-2) 0%, var(--tp-canvas) 100%)',
  'repeating-linear-gradient(0deg, transparent 0 21px, var(--tp-line) 21px 22px), linear-gradient(140deg, var(--tp-surf) 0%, var(--tp-surf-2) 100%)',
  'conic-gradient(from 214deg at 74% 20%, var(--tp-surf-2) 0deg, var(--tp-surf) 96deg, var(--tp-acc) 200deg, var(--tp-surf-2) 320deg, var(--tp-surf) 360deg)',
];

export type CoverRatio = 'portrait' | 'square' | 'wide' | 'tall' | 'banner' | 'fill';

type CoverArtProps = {
  seed: string;
  label?: string;
  sublabel?: string;
  ratio?: CoverRatio;
  /** Mono sticker, top-left — only used on procedural plates. */
  sticker?: string;
  className?: string;
};

export function CoverArt({ seed, label, sublabel, ratio = 'square', sticker, className }: CoverArtProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = COVER_PHOTOS[seed];
  const usesPhoto = Boolean(photo) && !photoFailed;
  const plate = PLATES[hashSeed(seed) % VARIANTS];

  const modifier = ratio === 'portrait' ? '' : ` cover--${ratio}`;
  const style: CSSProperties | undefined = usesPhoto ? undefined : { backgroundImage: plate };

  return (
    <div
      className={`cover${modifier}${className ? ` ${className}` : ''}`}
      style={style}
      aria-hidden={label ? undefined : true}
    >
      {usesPhoto ? (
        <img src={photo} alt="" onError={() => setPhotoFailed(true)} decoding="async" loading="lazy" />
      ) : (
        <span className="cover__band" aria-hidden="true" />
      )}
      <span className="cover__overlay" aria-hidden="true" />
      <span className="cover__grain" aria-hidden="true" />
      {label ? <span className="cover__scrim" aria-hidden="true" /> : null}
      {sticker && !usesPhoto ? <span className="cover__sticker">{sticker}</span> : null}
      {label ? <span className="cover__label">{label}</span> : null}
      {sublabel ? <span className="cover__sub">{sublabel}</span> : null}
    </div>
  );
}
