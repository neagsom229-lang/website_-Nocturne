import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Shelf<T>({
  title,
  seeAllHref,
  items,
  renderCard,
  loading = false,
}: {
  title: string;
  seeAllHref?: string;
  items: T[];
  renderCard: (item: T) => ReactNode;
  loading?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    scroller.current?.scrollBy?.({ left: direction * 520, behavior: 'smooth' });
  }

  return (
    <section className="discovery-shelf" aria-label={title}>
      <div className="discovery-shelf__heading">
        <h2>{title}</h2>
        {seeAllHref ? <Link to={seeAllHref}>See all <span aria-hidden="true">→</span></Link> : null}
      </div>
      <div className="discovery-shelf__wrap">
        <button
          type="button"
          className="discovery-shelf__arrow discovery-shelf__arrow--left"
          aria-label="Scroll left"
          onClick={() => scroll(-1)}
        >‹</button>
        <div className="discovery-shelf__scroller" ref={scroller} data-testid="shelf-scroller">
          {loading
            ? Array.from({ length: 6 }, (_, index) => (
              <div className="discovery-skeleton" aria-hidden="true" key={index} />
            ))
            : items.map((item, index) => (
              <div className="discovery-shelf__item" key={index}>{renderCard(item)}</div>
            ))}
          {!loading && !items.length ? <p className="discovery-shelf__empty">Nothing here just yet.</p> : null}
        </div>
        <button
          type="button"
          className="discovery-shelf__arrow discovery-shelf__arrow--right"
          aria-label="Scroll right"
          onClick={() => scroll(1)}
        >›</button>
      </div>
    </section>
  );
}
