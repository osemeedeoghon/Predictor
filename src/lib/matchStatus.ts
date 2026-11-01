import type { Match, MatchStatus } from '../types';

/** Completed once a result exists; locked from the scheduled start time. */
export function getMatchStatus(match: Match, now: Date): MatchStatus {
  if (match.result) return 'completed';
  return now.getTime() >= new Date(match.scheduledAt).getTime() ? 'locked' : 'upcoming';
}

export const canPredict = (match: Match, now: Date) => getMatchStatus(match, now) === 'upcoming';

export const STATUS_LABELS: Record<MatchStatus, string> = {
  upcoming: 'Open',
  locked: 'Locked',
  completed: 'Completed',
};
