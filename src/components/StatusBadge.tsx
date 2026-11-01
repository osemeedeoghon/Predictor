import { CircleCheck, Clock, Lock } from 'lucide-react';
import { STATUS_LABELS } from '../lib/matchStatus';
import type { MatchStatus } from '../types';

const ICONS = { upcoming: Clock, locked: Lock, completed: CircleCheck } as const;

export function StatusBadge({ status }: { status: MatchStatus }) {
  const Icon = ICONS[status];
  return (
    <span className={`status-badge status-badge--${status}`}>
      <Icon aria-hidden size={14} />
      {STATUS_LABELS[status]}
    </span>
  );
}
