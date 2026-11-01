import { MAX_GAMES, type SetDraft } from '../lib/validation';
import type { Match, Player } from '../types';

const GAME_OPTIONS = Array.from({ length: MAX_GAMES + 1 }, (_, i) => i);

interface SetScoreFieldsProps {
  match: Match;
  sets: SetDraft[];
  setErrors: (string | null)[];
  showErrors: boolean;
  onChange: (index: number, side: 'a' | 'b', games: number | null) => void;
}

interface GameSelectProps {
  setNumber: number;
  player: Player;
  value: number | null;
  errorId?: string;
  onChange: (games: number | null) => void;
}

function GameSelect({ setNumber, player, value, errorId, onChange }: GameSelectProps) {
  return (
    <select
      className="game-select"
      aria-label={`Set ${setNumber}: games for ${player.name}`}
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">–</option>
      {GAME_OPTIONS.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );
}

export function SetScoreFields({ match, sets, setErrors, showErrors, onChange }: SetScoreFieldsProps) {
  if (sets.length === 0) {
    return <p className="hint">Choose a match score above to enter set scores.</p>;
  }
  return (
    <div className="set-grid">
      <div className="set-row set-row--head" aria-hidden>
        <span />
        <span>{match.playerA.name}</span>
        <span />
        <span>{match.playerB.name}</span>
      </div>
      {sets.map((set, i) => {
        const error = showErrors ? setErrors[i] : null;
        const errorId = error ? `${match.id}-set-${i}-error` : undefined;
        return (
          <div className="set-row" key={i} role="group" aria-label={`Set ${i + 1}`}>
            <span className="set-row__label">Set {i + 1}</span>
            <GameSelect
              setNumber={i + 1}
              player={match.playerA}
              value={set.a}
              errorId={errorId}
              onChange={(g) => onChange(i, 'a', g)}
            />
            <span className="set-row__dash" aria-hidden>
              –
            </span>
            <GameSelect
              setNumber={i + 1}
              player={match.playerB}
              value={set.b}
              errorId={errorId}
              onChange={(g) => onChange(i, 'b', g)}
            />
            {error && (
              <p id={errorId} className="field-error set-row__error">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
