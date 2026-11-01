import { ChevronRight, MapPin } from 'lucide-react';
import { formatMatchTime, formatRelative, formatSets, playerName } from '../lib/format';
import type { Match, MatchStatus, Player, Prediction } from '../types';
import { StatusBadge } from './StatusBadge';

interface MatchCardProps {
  match: Match;
  status: MatchStatus;
  prediction?: Prediction;
  selected: boolean;
  now: Date;
  onSelect: (matchId: string) => void;
}

function PlayerLine({ player, won }: { player: Player; won: boolean }) {
  return (
    <span className={`player-line${won ? ' player-line--won' : ''}`}>
      {player.name}
      {player.seed && <span className="seed">[{player.seed}]</span>}
    </span>
  );
}

export function MatchCard({ match, status, prediction, selected, now, onSelect }: MatchCardProps) {
  const winnerId = match.result?.winnerId;
  const action =
    status !== 'upcoming' ? 'View details' : prediction ? 'Edit prediction' : 'Make prediction';

  return (
    <article className={`match-card match-card--${status}${selected ? ' is-selected' : ''}`}>
      <div className="match-card__top">
        <span className="match-card__round">{match.round}</span>
        <StatusBadge status={status} />
      </div>
      <h3 className="match-card__players">
        <PlayerLine player={match.playerA} won={winnerId === match.playerA.id} />
        <span className="vs" aria-label="versus">
          v
        </span>
        <PlayerLine player={match.playerB} won={winnerId === match.playerB.id} />
      </h3>
      <p className="match-card__meta">
        <time dateTime={match.scheduledAt}>{formatMatchTime(match.scheduledAt)}</time>
        <span aria-hidden>·</span>
        <span>
          <MapPin aria-hidden size={13} /> {match.court}
        </span>
        {status !== 'completed' && (
          <>
            <span aria-hidden>·</span>
            <span>{formatRelative(match.scheduledAt, now)}</span>
          </>
        )}
      </p>
      {match.result && (
        <p className="match-card__result">
          Result: {playerName(match, match.result.winnerId)} won {formatSets(match.result.sets)}
        </p>
      )}
      <p className={`match-card__pick${prediction ? '' : ' match-card__pick--none'}`}>
        {prediction
          ? `Your pick: ${playerName(match, prediction.winnerId)}, ${formatSets(prediction.sets)}`
          : status === 'upcoming'
            ? 'No prediction yet'
            : 'You did not predict this match'}
      </p>
      <button
        type="button"
        className="match-card__action"
        aria-expanded={selected}
        aria-controls="prediction-panel"
        onClick={() => onSelect(match.id)}
      >
        {action}{' '}
        <span className="sr-only">
          for {match.playerA.name} versus {match.playerB.name}
        </span>
        <ChevronRight aria-hidden size={16} />
      </button>
    </article>
  );
}
