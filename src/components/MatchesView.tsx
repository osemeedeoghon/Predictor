import { useState } from 'react';
import { getMatchStatus } from '../lib/matchStatus';
import type { RankedEntry } from '../lib/scoring';
import type { Match, MatchStatus, Prediction, SetScore, TournamentData } from '../types';
import { MatchFilters, type MatchFilter } from './MatchFilters';
import { MatchList } from './MatchList';
import { PredictionPanel } from './PredictionPanel';
import { EmptyState } from './StateMessage';
import { TournamentOverview } from './TournamentOverview';

interface MatchesViewProps {
  data: TournamentData;
  predictions: Record<string, Prediction>;
  /** Undefined when scoring is not enabled (live tournaments for now). */
  you: RankedEntry | undefined;
  isDemo: boolean;
  now: Date;
  onSubmitPrediction: (match: Match, winnerId: string, sets: SetScore[]) => Promise<void>;
}

export function MatchesView({
  data,
  predictions,
  you,
  isDemo,
  now,
  onSubmitPrediction,
}: MatchesViewProps) {
  const [filter, setFilter] = useState<MatchFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const withStatus = data.matches.map((match) => ({ match, status: getMatchStatus(match, now) }));
  const statusCounts: Record<MatchStatus, number> = { upcoming: 0, locked: 0, completed: 0 };
  withStatus.forEach(({ status }) => statusCounts[status]++);

  const visible = withStatus
    .filter(({ status }) => filter === 'all' || status === filter)
    .map(({ match }) => match);
  const selected = withStatus.find(({ match }) => match.id === selectedId);

  return (
    <div className={`matches-layout${selected ? ' has-selection' : ''}`}>
      <div className="matches-layout__main">
        <TournamentOverview
          tournament={data.tournament}
          role={data.role}
          counts={statusCounts}
          predictionsMade={Object.keys(predictions).length}
          points={you ? you.points : null}
          rank={you?.rank ?? null}
        />
        {data.matches.length === 0 ? (
          <EmptyState title="No matches scheduled yet">
            The organizer hasn't added any matches. Check back closer to the event.
          </EmptyState>
        ) : (
          <>
            <div className="list-head">
              <h2 className="section-title">Matches</h2>
              <MatchFilters
                value={filter}
                counts={{ all: data.matches.length, ...statusCounts }}
                onChange={setFilter}
              />
            </div>
            <MatchList
              matches={visible}
              predictions={predictions}
              selectedId={selectedId}
              now={now}
              onSelect={setSelectedId}
            />
          </>
        )}
      </div>
      <aside className="matches-layout__side" aria-label="Prediction">
        {selected ? (
          <PredictionPanel
            key={selected.match.id}
            match={selected.match}
            status={selected.status}
            prediction={predictions[selected.match.id]}
            isDemo={isDemo}
            showPoints={you !== undefined}
            onSubmit={(winnerId, sets) => onSubmitPrediction(selected.match, winnerId, sets)}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="panel panel--placeholder">
            <EmptyState title="Pick a match">
              Select a match to predict the winner and set score, or to see how your pick did.
            </EmptyState>
          </div>
        )}
      </aside>
    </div>
  );
}
