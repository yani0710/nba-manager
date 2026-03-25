export function RosterFiltersPanel({ categories, activeCategory, onSelectCategory }) {
  return (
    <aside className="roster-filters">
      <h3>Filters</h3>
      <div className="roster-filter-list">
        {categories.map((category) => (
          <button
            key={category.key}
            type="button"
            className={`roster-filter-item ${activeCategory === category.key ? 'is-active' : ''}`}
            onClick={() => onSelectCategory(category.key)}
          >
            <span>{category.label}</span>
            <strong>{category.count}</strong>
          </button>
        ))}
      </div>
    </aside>
  );
}
