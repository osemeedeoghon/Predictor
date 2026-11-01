import type { MatchStatus } from '../types';

export type MatchFilter = 'all' | MatchStatus;

const OPTIONS: Array<{ value: MatchFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Open' },
  { value: 'locked', label: 'Locked' },
  { value: 'completed', label: 'Completed' },
];

interface MatchFiltersProps {
  value: MatchFilter;
  counts: Record<MatchFilter, number>;
  onChange: (value: MatchFilter) => void;
}

export function MatchFilters({ value, counts, onChange }: MatchFiltersProps) {
  return (
    <div className="filters" role="group" aria-label="Filter matches by status">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="filters__button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label} <span className="filters__count">{counts[opt.value]}</span>
        </button>
      ))}
    </div>
  );
}
