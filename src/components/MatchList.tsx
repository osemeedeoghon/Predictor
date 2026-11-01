import { getMatchStatus } from '../lib/matchStatus';
import type { Match, Prediction } from '../types';
import { MatchCard } from './MatchCard';
import { EmptyState } from './StateMessage';

interface MatchListProps {
  matches: Match[];
  predictions: Record<string, Prediction>;
  selectedId: string | null;
  now: Date;
  onSelect: (matchId: string) => void;
}

export function MatchList({ matches, predictions, selectedId, now, onSelect }: MatchListProps) {
  if (matches.length === 0) {
    return (
      <EmptyState title="No matches here">
        Nothing matches this filter right now. Try another status.
      </EmptyState>
    );
  }
  return (
    <ul className="match-list" aria-label="Matches">
      {matches.map((match) => (
        <li key={match.id}>
          <MatchCard
            match={match}
            status={getMatchStatus(match, now)}
            prediction={predictions[match.id]}
            selected={selectedId === match.id}
            now={now}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
