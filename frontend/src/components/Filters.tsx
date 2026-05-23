export interface FilterState {
  from: string;
  to: string;
  min: string;
  max: string;
  limit: string;
}

export const emptyFilters: FilterState = {
  from: "",
  to: "",
  min: "",
  max: "",
  limit: "500",
};

/** True when any value-narrowing filter (not the result limit) is set. */
export function hasActiveFilters(f: FilterState): boolean {
  return !!(f.from || f.to || f.min || f.max);
}

interface Props {
  value: FilterState;
  onChange: (f: FilterState) => void;
  onReset: () => void;
}

export function Filters({ value, onChange, onReset }: Props) {
  const set = (k: keyof FilterState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });

  return (
    <div className="filters">
      <label>
        From
        <input type="date" value={value.from} onChange={set("from")} />
      </label>
      <label>
        To
        <input type="date" value={value.to} onChange={set("to")} />
      </label>
      <label>
        Min
        <input type="number" min="0" step="any" placeholder="0" value={value.min} onChange={set("min")} />
      </label>
      <label>
        Max
        <input type="number" min="0" step="any" placeholder="∞" value={value.max} onChange={set("max")} />
      </label>
      <label>
        Limit
        <input type="number" min="1" step="1" value={value.limit} onChange={set("limit")} />
      </label>
      <button className="ghost-btn" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
