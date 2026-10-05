import { useState, type CSSProperties } from 'react';
import { SmartImage } from './SmartImage';

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

const PLATES = [
  'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.2) 80%), linear-gradient(135deg, #2b2926 0%, #1a1917 100%)',
  'radial-gradient(circle at 80% 30%, rgba(212,143,94,0.15) 0%, rgba(0,0,0,0.25) 70%), linear-gradient(145deg, #2c2420 0%, #161311 100%)',
  'radial-gradient(circle at 40% 70%, rgba(142,158,143,0.12) 0%, rgba(0,0,0,0.3) 80%), linear-gradient(120deg, #212521 0%, #131513 100%)',
  'radial-gradient(circle at 70% 80%, rgba(181,142,130,0.15) 0%, rgba(0,0,0,0.25) 75%), linear-gradient(160deg, #272020 0%, #141111 100%)',
  'radial-gradient(circle at 30% 40%, rgba(143,158,171,0.12) 0%, rgba(0,0,0,0.3) 80%), linear-gradient(135deg, #1e2225 0%, #111314 100%)',
  'radial-gradient(circle at 50% 20%, rgba(199,178,137,0.15) 0%, rgba(0,0,0,0.25) 70%), linear-gradient(150deg, #28251e 0%, #151411 100%)',
];

export function CoverArt({
  seed,
  ratio = 'square',
  label,
  sublabel,
  sticker,
  className,
}: {
  seed: string;
  ratio?: 'square' | 'portrait' | 'card' | 'wide' | 'tall' | 'fill';
  label?: string;
  sublabel?: string;
  sticker?: string;
  className?: string;
}) {
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
        <SmartImage src={photo} alt="" onError={() => setPhotoFailed(true)} decoding="async" loading="lazy" />
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
