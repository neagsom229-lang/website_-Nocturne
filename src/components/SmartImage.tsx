import { useState } from 'react';

const DEAD_HOSTS = [
  'audius.zeogrid.com',
  'audius-figment-',
  '.zeogrid.com',
];

function isDeadHost(url: string): boolean {
  return DEAD_HOSTS.some((h) => url.includes(h));
}

export function SmartImage({
  src,
  alt = '',
  fallback = '/fallback-cover.svg',
  className,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement> & { fallback?: string }) {
  const [failed, setFailed] = useState(false);

  // Skip dead hosts entirely — don't even try to load them
  if (!src || failed || isDeadHost(src)) {
    return (
      <img
        src={fallback}
        alt={alt}
        className={className}
        {...rest}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}
