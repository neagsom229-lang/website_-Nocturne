/**
 * reveal.ts — drop-in scroll reveal for the BEDROOM POP pack.
 *
 * Markup: <div data-reveal="theme" data-reveal-index="0">…</div>
 *   data-reveal        keyframe name, or "theme" to use the theme's --tp-reveal
 *   data-reveal-index  stagger position (index x --tp-stagger)
 *   data-reveal-dur    override --tp-dur-slow
 *
 * Put data-reveal-root on a scroll container to observe inside it instead of the viewport.
 * Reveals fire once. Nav, tab bars and above-the-fold app chrome must never carry data-reveal.
 */
export function initReveals(scope: ParentNode = document): () => void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return () => {};
  }

  const root = document.documentElement;
  const groups = new Map<Element | null, HTMLElement[]>();

  scope.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    el.style.animation = 'none';
    el.style.opacity = '0';
    if (el.dataset.revealDone === 'true') return;
    const scroller = el.closest('[data-reveal-root]');
    const key: Element | null = scroller;
    const bucket = groups.get(key);
    if (bucket) bucket.push(el);
    else groups.set(key, [el]);
  });

  const observers: IntersectionObserver[] = [];

  groups.forEach((elements, scroller) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const styles = getComputedStyle(root);
          const name =
            el.dataset.reveal === 'theme'
              ? styles.getPropertyValue('--tp-reveal').trim() || 'tp-up'
              : (el.dataset.reveal ?? 'tp-up');
          const duration =
            el.dataset.revealDur || styles.getPropertyValue('--tp-dur-slow').trim() || '500ms';
          const ease = styles.getPropertyValue('--tp-ease').trim() || 'ease';
          const stagger = Number.parseFloat(styles.getPropertyValue('--tp-stagger')) || 60;
          const index = Number(el.dataset.revealIndex ?? 0);

          el.style.opacity = '';
          el.style.animation = `${name} ${duration} ${ease} ${Math.round(index * stagger)}ms both`;
          el.dataset.revealDone = 'true';
          observer.unobserve(el);
        });
      },
      { root: scroller, threshold: 0.2 },
    );

    elements.forEach((el) => observer.observe(el));
    observers.push(observer);
  });

  return () => observers.forEach((observer) => observer.disconnect());
}
