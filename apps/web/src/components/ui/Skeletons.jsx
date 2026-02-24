export function SkeletonBlock({ height = 16, width = '100%', style = {} }) {
  return <div className="ui-skeleton" style={{ height, width, ...style }} />;
}

export function SkeletonCard() {
  return (
    <div className="ui-card">
      <SkeletonBlock height={18} width="40%" style={{ marginBottom: 12 }} />
      <SkeletonBlock />
      <SkeletonBlock style={{ marginTop: 8 }} />
      <SkeletonBlock width="70%" style={{ marginTop: 8 }} />
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <div className="ui-card">
      <div className="ui-skeleton-table">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="ui-skeleton-row">
            {Array.from({ length: cols }).map((__, c) => (
              <SkeletonBlock key={c} height={14} width={`${Math.max(30, 100 - c * 8)}%`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

