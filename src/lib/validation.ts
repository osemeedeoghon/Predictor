import type { BestOf, Match, SetScore } from '../types';

export interface SetDraft {
  a: number | null;
  b: number | null;
}

export interface PredictionDraft {
  winnerId: string | null;
  sets: SetDraft[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /** One entry per set in the draft; null when that set is fine. */
  setErrors: (string | null)[];
}

export const MAX_GAMES = 7;

export const setsToWin = (bestOf: BestOf) => Math.ceil(bestOf / 2);

/** Possible match scores in sets, from the winner's perspective. */
export function possibleSetOutcomes(bestOf: BestOf): Array<{ won: number; lost: number }> {
  const need = setsToWin(bestOf);
  return Array.from({ length: need }, (_, lost) => ({ won: need, lost }));
}

/**
 * A completed set is 6–0 to 6–4, 7–5, or 7–6 (tiebreak). Returns which side
 * won it, or null if the score is not a finished, legal set.
 */
export function getSetWinner({ a, b }: SetScore): 'a' | 'b' | null {
  if (![a, b].every((g) => Number.isInteger(g) && g >= 0 && g <= MAX_GAMES)) return null;
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  const legal = (high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6));
  if (!legal) return null;
  return a > b ? 'a' : 'b';
}

export const isValidSetScore = (set: SetScore) => getSetWinner(set) !== null;

export function validatePrediction(match: Match, draft: PredictionDraft): ValidationResult {
  const errors: string[] = [];
  const need = setsToWin(match.bestOf);

  const setErrors = draft.sets.map((set): string | null => {
    if (set.a === null || set.b === null) return 'Enter games for both players.';
    if (!isValidSetScore({ a: set.a, b: set.b })) {
      return 'Not a valid set score. Use 6–0 to 6–4, 7–5 or 7–6.';
    }
    return null;
  });

  const winnerSide =
    draft.winnerId === match.playerA.id ? 'a' : draft.winnerId === match.playerB.id ? 'b' : null;

  if (!draft.winnerId) errors.push('Choose who you think will win.');
  else if (!winnerSide) errors.push('The predicted winner must be one of the two players.');

  if (draft.sets.length < need || draft.sets.length > match.bestOf) {
    errors.push('Choose the match score in sets.');
  } else if (setErrors.some(Boolean)) {
    errors.push('Complete every set with a valid score.');
  } else if (winnerSide) {
    const winners = draft.sets.map((s) => getSetWinner({ a: s.a!, b: s.b! }));
    const setsWon = winners.filter((w) => w === winnerSide).length;
    const finalSetWinner = winners[winners.length - 1];
    if (setsWon !== need || finalSetWinner !== winnerSide) {
      const name = winnerSide === 'a' ? match.playerA.name : match.playerB.name;
      errors.push(
        `Set scores don't match your pick: ${name} must win ${need} sets, including the last one.`,
      );
    }
  }

  return { valid: errors.length === 0, errors, setErrors };
}

/** Converts a validated draft into concrete set scores. */
export function draftToSets(draft: PredictionDraft): SetScore[] {
  return draft.sets.map((s) => ({ a: s.a ?? 0, b: s.b ?? 0 }));
}
