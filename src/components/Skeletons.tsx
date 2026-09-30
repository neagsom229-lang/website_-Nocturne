/** Loading states for every list in the pack — rows, rails and detail plates. */

export function SkeletonRow() {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      <span className="skeleton" style={{ width: 52, height: 52, flex: 'none' }} />
      <span className="stack--sm" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="skeleton skeleton--line" style={{ width: '68%' }} />
        <span className="skeleton skeleton--line" style={{ width: '42%', height: 10 }} />
      </span>
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="list" role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </div>
  );
}

export function SkeletonRail({ cards = 3 }: { cards?: number }) {
  return (
    <div className="reel" role="status" aria-label="Loading">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} style={{ width: 168, display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden="true">
          <span className="skeleton skeleton--art" />
          <span className="skeleton skeleton--line" style={{ width: '72%' }} />
          <span className="skeleton skeleton--line" style={{ width: '46%', height: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPlate({ lines = 3 }: { lines?: number }) {
  return (
    <div className="plate stack--sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className="skeleton skeleton--line"
          style={{ width: `${92 - index * 14}%` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
