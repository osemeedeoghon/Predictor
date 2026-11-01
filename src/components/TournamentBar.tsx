import { Plus } from 'lucide-react';
import type { TournamentSummary } from '../types';

interface TournamentBarProps {
  tournaments: TournamentSummary[];
  activeId: string;
  onSelect: (id: string) => void;
  onJoinAnother?: () => void;
}

/** Tournament switcher and "join another" entry point for signed-in members. */
export function TournamentBar({ tournaments, activeId, onSelect, onJoinAnother }: TournamentBarProps) {
  if (tournaments.length < 2 && !onJoinAnother) return null;
  return (
    <div className="tournament-bar">
      {tournaments.length > 1 && (
        <label className="tournament-bar__select">
          <span>Tournament</span>
          <select
            className="game-select"
            value={activeId}
            onChange={(e) => onSelect(e.target.value)}
          >
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.role === 'organizer' ? ' (organizer)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {onJoinAnother && (
        <button type="button" className="button button--ghost" onClick={onJoinAnother}>
          <Plus aria-hidden size={16} /> Join with a code
        </button>
      )}
    </div>
  );
}
