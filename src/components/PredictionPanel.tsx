import { ChevronLeft, CircleCheck, Lock, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatMatchTime, formatSets, playerName } from '../lib/format';
import { scorePrediction } from '../lib/scoring';
import type { Match, MatchStatus, Prediction, SetScore } from '../types';
import { PredictionForm } from './PredictionForm';
import { StatusBadge } from './StatusBadge';

interface PredictionPanelProps {
  match: Match;
  status: MatchStatus;
  prediction?: Prediction;
  /** Demo predictions live in memory only; live ones are saved to the database. */
  isDemo: boolean;
  /** Show points for completed matches (demo only until scoring ships). */
  showPoints: boolean;
  onSubmit: (winnerId: string, sets: SetScore[]) => Promise<void>;
  onClose: () => void;
}

export function PredictionPanel({
  match,
  status,
  prediction,
  isDemo,
  showPoints,
  onSubmit,
  onClose,
}: PredictionPanelProps) {
  const [confirmed, setConfirmed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus into the panel when a match is opened (helps on mobile,
  // where the panel replaces the list).
  useEffect(() => {
    headingRef.current?.focus();
  }, [match.id]);

  async function handleSubmit(winnerId: string, sets: SetScore[]) {
    setConfirmed(false);
    await onSubmit(winnerId, sets);
    setConfirmed(true);
  }

  return (
    <section id="prediction-panel" className="panel" aria-labelledby="panel-title">
      <div className="panel__bar">
        <button type="button" className="button button--ghost panel__back" onClick={onClose}>
          <ChevronLeft aria-hidden size={18} /> All matches
        </button>
        <button
          type="button"
          className="icon-button panel__close"
          aria-label="Close prediction panel"
          onClick={onClose}
        >
          <X aria-hidden size={18} />
        </button>
      </div>

      <div className="panel__head">
        <p className="eyebrow">
          {match.round} · {match.court}
        </p>
        <h2 id="panel-title" ref={headingRef} tabIndex={-1} className="panel__title">
          {match.playerA.name} <span className="vs">v</span> {match.playerB.name}
        </h2>
        <div className="panel__meta">
          <StatusBadge status={status} />
          <time dateTime={match.scheduledAt}>{formatMatchTime(match.scheduledAt)}</time>
        </div>
      </div>

      {confirmed && prediction && (
        <div className="confirmation" role="status">
          <CircleCheck aria-hidden size={20} />
          {isDemo ? (
            <div>
              <p className="confirmation__title">Prediction recorded for this demo session</p>
              <p>
                {playerName(match, prediction.winnerId)} to win {formatSets(prediction.sets)}. Not
                saved to a server — it will be cleared if you reload the page.
              </p>
            </div>
          ) : (
            <div>
              <p className="confirmation__title">Prediction saved</p>
              <p>
                {playerName(match, prediction.winnerId)} to win {formatSets(prediction.sets)}. You
                can change it until the match starts. Other members can't see it until then.
              </p>
            </div>
          )}
        </div>
      )}

      {status === 'upcoming' ? (
        <PredictionForm
          key={match.id}
          match={match}
          existing={prediction}
          onSubmit={handleSubmit}
        />
      ) : (
        <ClosedMatchDetails
          match={match}
          status={status}
          prediction={prediction}
          showPoints={showPoints}
        />
      )}
    </section>
  );
}

function ClosedMatchDetails({
  match,
  status,
  prediction,
  showPoints,
}: {
  match: Match;
  status: Exclude<MatchStatus, 'upcoming'>;
  prediction?: Prediction;
  showPoints: boolean;
}) {
  const score = prediction && showPoints ? scorePrediction(prediction, match) : null;
  return (
    <div className="closed">
      <p className="closed__notice">
        <Lock aria-hidden size={16} />
        {status === 'locked'
          ? 'Predictions closed when this match started. Your pick can no longer be changed.'
          : 'This match is complete. Predictions can no longer be changed.'}
      </p>
      <dl className="detail-list">
        {match.result && (
          <div>
            <dt>Result</dt>
            <dd>
              {playerName(match, match.result.winnerId)} won {formatSets(match.result.sets)}
            </dd>
          </div>
        )}
        <div>
          <dt>Your pick</dt>
          <dd>
            {prediction
              ? `${playerName(match, prediction.winnerId)}, ${formatSets(prediction.sets)}`
              : 'No prediction made'}
          </dd>
        </div>
        {score && (
          <div>
            <dt>Points earned</dt>
            <dd>
              <strong>{score.points}</strong>
              {score.correctWinner
                ? ` — winner ✓, set count ${score.correctSetCount ? '✓' : '✗'}, ${score.exactSets} exact set${score.exactSets === 1 ? '' : 's'}`
                : ' — wrong winner'}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
