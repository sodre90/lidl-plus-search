interface Props {
  value: string;
  onChange: (v: string) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}

export function SearchBar({ value, onChange, filtersOpen, onToggleFilters }: Props) {
  return (
    <section className="searchbar">
      <div className="search-input-wrap">
        <span className="search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          id="q"
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search items — e.g. bread, milk, coffee…"
          autoComplete="off"
          autoFocus
        />
        <button
          className="ghost-btn"
          onClick={onToggleFilters}
          aria-expanded={filtersOpen}
        >
          Filters
        </button>
      </div>
    </section>
  );
}
