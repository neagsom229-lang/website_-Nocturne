import { useEffect, useState } from 'react';

export function WaveformPlaceholder() {
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return (
    <div className={`waveform-placeholder ${reducedMotion ? 'is-static' : 'is-animated'}`} aria-hidden="true">
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}
