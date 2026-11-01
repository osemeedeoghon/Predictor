import { Ticket } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { isValidInviteCode, normalizeInviteCode } from '../lib/inviteCode';

interface JoinTournamentProps {
  onJoin: (code: string) => Promise<void>;
  onCancel?: () => void;
  /** True when the member has no tournaments yet. */
  firstTime: boolean;
}

export function JoinTournament({ onJoin, onCancel, firstTime }: JoinTournamentProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeInviteCode(code);
    if (!isValidInviteCode(normalized)) {
      setError('Invitation codes are 8–16 letters or numbers.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onJoin(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join the tournament.');
      setSubmitting(false);
    }
  }

  return (
    <section className="card join-card" aria-labelledby="join-title">
      <Ticket aria-hidden size={28} className="join-card__icon" />
      <h1 id="join-title" className="section-title">
        {firstTime ? 'Join your first tournament' : 'Join another tournament'}
      </h1>
      <p className="muted">
        {firstTime
          ? "You're not in any tournaments yet. Enter the invitation code from your club's organizer."
          : 'Enter the invitation code from the organizer.'}
      </p>
      <form className="join-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label className="field__label" htmlFor="invite-code">
            Invitation code
          </label>
          <input
            id="invite-code"
            className="text-input text-input--code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'invite-code-error' : undefined}
            onChange={(e) => setCode(e.target.value)}
          />
          {error && (
            <p id="invite-code-error" className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="join-form__actions">
          <button type="submit" className="button button--primary" disabled={submitting}>
            {submitting ? 'Joining…' : 'Join tournament'}
          </button>
          {onCancel && (
            <button type="button" className="button button--ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
