import { Inbox, RefreshCw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export function LoadingState({ label = 'Loading tournament…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="skeleton-stack" aria-hidden>
        <div className="skeleton skeleton--wide" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
      <p className="state__text">{label}</p>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  title?: string;
}

export function ErrorState({ message, onRetry, title = "Couldn't load the tournament" }: ErrorStateProps) {
  return (
    <div className="state state--error" role="alert">
      <TriangleAlert aria-hidden size={28} />
      <h2 className="state__title">{title}</h2>
      <p className="state__text">{message}</p>
      <button type="button" className="button button--secondary" onClick={onRetry}>
        <RefreshCw aria-hidden size={16} /> Try again
      </button>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state state--empty">
      <Inbox aria-hidden size={28} />
      <h3 className="state__title">{title}</h3>
      {children && <p className="state__text">{children}</p>}
    </div>
  );
}
