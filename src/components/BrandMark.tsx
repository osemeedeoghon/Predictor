export function BrandMark() {
  return (
    <span className="brand__mark" aria-hidden>
      <svg viewBox="0 0 32 32" width="32" height="32">
        <circle cx="16" cy="16" r="11" fill="var(--ball)" />
        <path
          d="M7 11c4.5 2 4.5 8 0 10M25 11c-4.5 2-4.5 8 0 10"
          fill="none"
          stroke="var(--green-900)"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}
