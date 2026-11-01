import { Medal } from 'lucide-react';
import { POINTS, type RankedEntry } from '../lib/scoring';
import { EmptyState } from './StateMessage';

export function Leaderboard({ entries }: { entries: RankedEntry[] }) {
  return (
    <section className="card" aria-labelledby="leaderboard-title">
      <div className="card__head">
        <h1 id="leaderboard-title" className="section-title">
          Leaderboard
        </h1>
        <p className="muted">Fictional demo members. Points update when matches complete.</p>
      </div>
      {entries.length === 0 ? (
        <EmptyState title="No predictions yet">
          The leaderboard fills up once members start predicting.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="leaderboard">
            <caption className="sr-only">Demo leaderboard, ranked by points</caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Member</th>
                <th scope="col" className="num">
                  Predictions
                </th>
                <th scope="col" className="num">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.member.id} className={e.isCurrentUser ? 'is-you' : undefined}>
                  <td>
                    <span className={`rank rank--${e.rank <= 3 ? e.rank : 'other'}`}>
                      {e.rank <= 3 && <Medal aria-hidden size={14} />}
                      {e.rank}
                    </span>
                  </td>
                  <th scope="row">{e.member.displayName}</th>
                  <td className="num">{e.predictionsMade}</td>
                  <td className="num points">{e.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Shown for live tournaments until scoring and aggregation are built. */
export function LeaderboardUnavailable() {
  return (
    <section className="card" aria-labelledby="leaderboard-title">
      <h1 id="leaderboard-title" className="section-title">
        Leaderboard
      </h1>
      <EmptyState title="Leaderboard not available yet">
        Points and rankings will appear here once scoring is switched on for this tournament.
        Your predictions are already being saved.
      </EmptyState>
    </section>
  );
}

export function ScoringRules({ planned = false }: { planned?: boolean }) {
  return (
    <section className="card" aria-labelledby="scoring-title">
      <h2 id="scoring-title" className="section-title section-title--sm">
        {planned ? 'Planned scoring' : 'How points work'}
      </h2>
      <ul className="rules">
        <li>
          <strong>+{POINTS.correctWinner}</strong> correct match winner
        </li>
        <li>
          <strong>+{POINTS.correctSetCount}</strong> correct number of sets (with the right winner)
        </li>
        <li>
          <strong>+{POINTS.exactSet}</strong> for each set score exactly right, in order
        </li>
        <li>Predictions lock at the scheduled start time.</li>
      </ul>
    </section>
  );
}
