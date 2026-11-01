import { Calendar, MapPin } from 'lucide-react';
import { formatDate } from '../lib/format';
import type { MatchStatus, Tournament, TournamentRole } from '../types';

interface TournamentOverviewProps {
  tournament: Tournament;
  role: TournamentRole;
  counts: Record<MatchStatus, number>;
  predictionsMade: number;
  /** Null until scoring is enabled for live tournaments. */
  points: number | null;
  rank: number | null;
}

export function TournamentOverview({
  tournament,
  role,
  counts,
  predictionsMade,
  points,
  rank,
}: TournamentOverviewProps) {
  const total = counts.upcoming + counts.locked + counts.completed;
  const status =
    counts.completed === total ? 'Finished' : counts.upcoming === total ? 'Not started' : 'In progress';

  return (
    <section className="overview" aria-labelledby="tournament-title">
      <div className="overview__head">
        <div>
          <p className="eyebrow">
            <span className="live-dot" aria-hidden /> Tournament status: {status}
          </p>
          <h1 id="tournament-title" className="overview__title">
            {tournament.name}
          </h1>
          <p className="overview__meta">
            <span>
              <MapPin aria-hidden size={16} /> {tournament.venue}
            </span>
            <span>
              <Calendar aria-hidden size={16} /> {formatDate(tournament.startsOn)} –{' '}
              {formatDate(tournament.endsOn)}
            </span>
          </p>
        </div>
      </div>
      <dl className="stats">
        <div className="stat">
          <dt>Open for predictions</dt>
          <dd>{counts.upcoming}</dd>
        </div>
        <div className="stat">
          <dt>Locked / in play</dt>
          <dd>{counts.locked}</dd>
        </div>
        <div className="stat">
          <dt>Completed</dt>
          <dd>{counts.completed}</dd>
        </div>
        <div className="stat stat--accent">
          <dt>Your predictions</dt>
          <dd>
            {predictionsMade}
            <span className="stat__sub"> / {total}</span>
          </dd>
        </div>
        {points === null ? (
          <div className="stat stat--accent">
            <dt>Your role</dt>
            <dd className="stat__text">{role === 'organizer' ? 'Organizer' : 'Member'}</dd>
          </div>
        ) : (
          <div className="stat stat--accent">
            <dt>Your points{rank ? ` · rank ${rank}` : ''}</dt>
            <dd>{points}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
