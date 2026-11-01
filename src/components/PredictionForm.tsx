import { useMemo, useState, type FormEvent } from 'react';
import {
  draftToSets,
  possibleSetOutcomes,
  validatePrediction,
  type PredictionDraft,
} from '../lib/validation';
import type { Match, Prediction, SetScore } from '../types';
import { SetScoreFields } from './SetScoreFields';

interface PredictionFormProps {
  match: Match;
  existing?: Prediction;
  onSubmit: (winnerId: string, sets: SetScore[]) => Promise<void>;
}

function initialDraft(existing?: Prediction): PredictionDraft {
  return existing
    ? { winnerId: existing.winnerId, sets: existing.sets.map((s) => ({ ...s })) }
    : { winnerId: null, sets: [] };
}

export function PredictionForm({ match, existing, onSubmit }: PredictionFormProps) {
  const [draft, setDraft] = useState<PredictionDraft>(() => initialDraft(existing));
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validation = useMemo(() => validatePrediction(match, draft), [match, draft]);
  const outcomes = possibleSetOutcomes(match.bestOf);
  const players = [match.playerA, match.playerB];

  const setSetCount = (count: number) =>
    setDraft((d) => ({
      ...d,
      sets: Array.from({ length: count }, (_, i) => d.sets[i] ?? { a: null, b: null }),
    }));

  const setGames = (index: number, side: 'a' | 'b', games: number | null) =>
    setDraft((d) => ({
      ...d,
      sets: d.sets.map((s, i) => (i === index ? { ...s, [side]: games } : s)),
    }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setShowErrors(true);
    setSubmitError(null);
    if (!validation.valid || !draft.winnerId) return;
    setSubmitting(true);
    try {
      await onSubmit(draft.winnerId, draftToSets(draft));
      setShowErrors(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Prediction could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  }

  const visibleErrors = showErrors ? validation.errors : [];

  return (
    <form className="prediction-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="fieldset">
        <legend>1. Who will win?</legend>
        <div className="winner-options">
          {players.map((p) => (
            <label key={p.id} className="choice choice--player">
              <input
                type="radio"
                name={`winner-${match.id}`}
                value={p.id}
                checked={draft.winnerId === p.id}
                onChange={() => setDraft((d) => ({ ...d, winnerId: p.id }))}
              />
              <span className="choice__body">
                <span className="choice__title">{p.name}</span>
                {p.seed && <span className="choice__sub">Seed {p.seed}</span>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>2. Match score in sets (best of {match.bestOf})</legend>
        <div className="outcome-options">
          {outcomes.map(({ won, lost }) => (
            <label key={lost} className="choice choice--compact">
              <input
                type="radio"
                name={`outcome-${match.id}`}
                value={won + lost}
                checked={draft.sets.length === won + lost}
                onChange={() => setSetCount(won + lost)}
              />
              <span className="choice__body">
                <span className="choice__title">
                  {won}–{lost}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="hint">Winner's sets first, e.g. 2–1 means the match goes to a deciding set.</p>
      </fieldset>

      <fieldset className="fieldset">
        <legend>3. Games in each set</legend>
        <SetScoreFields
          match={match}
          sets={draft.sets}
          setErrors={validation.setErrors}
          showErrors={showErrors}
          onChange={setGames}
        />
        <p className="hint">Valid sets: 6–0 to 6–4, 7–5, or 7–6 (tiebreak).</p>
      </fieldset>

      {(visibleErrors.length > 0 || submitError) && (
        <div className="form-errors" role="alert">
          <p className="form-errors__title">Please fix the following:</p>
          <ul>
            {visibleErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
            {submitError && <li>{submitError}</li>}
          </ul>
        </div>
      )}

      <button type="submit" className="button button--primary button--block" disabled={submitting}>
        {submitting ? 'Submitting…' : existing ? 'Update prediction' : 'Submit prediction'}
      </button>
    </form>
  );
}
