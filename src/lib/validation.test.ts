import { describe, expect, it } from 'vitest';
import type { Match } from '../types';
import {
  getSetWinner,
  isValidSetScore,
  possibleSetOutcomes,
  validatePrediction,
  type PredictionDraft,
} from './validation';

const match: Match = {
  id: 'm1',
  round: 'Final',
  court: 'Court 1',
  scheduledAt: '2026-10-17T12:00:00Z',
  bestOf: 3,
  playerA: { id: 'a', name: 'Player A' },
  playerB: { id: 'b', name: 'Player B' },
};

const draft = (winnerId: string | null, sets: Array<[number | null, number | null]>) =>
  ({ winnerId, sets: sets.map(([a, b]) => ({ a, b })) }) satisfies PredictionDraft;

describe('set score validation', () => {
  it.each([
    [6, 0],
    [6, 4],
    [4, 6],
    [7, 5],
    [7, 6],
    [6, 7],
  ])('accepts %i–%i', (a, b) => {
    expect(isValidSetScore({ a, b })).toBe(true);
  });

  it.each([
    [6, 5], // set not finished
    [6, 6], // needs a tiebreak
    [7, 4], // would have ended at 6–4
    [7, 7],
    [5, 3], // not finished
    [8, 6], // too many games
    [0, 0],
    [-1, 6],
    [6.5, 2],
  ])('rejects %d–%d', (a, b) => {
    expect(isValidSetScore({ a, b })).toBe(false);
  });

  it('identifies the set winner', () => {
    expect(getSetWinner({ a: 7, b: 6 })).toBe('a');
    expect(getSetWinner({ a: 3, b: 6 })).toBe('b');
    expect(getSetWinner({ a: 6, b: 6 })).toBeNull();
  });
});

describe('possibleSetOutcomes', () => {
  it('lists best-of-3 and best-of-5 match scores', () => {
    expect(possibleSetOutcomes(3)).toEqual([
      { won: 2, lost: 0 },
      { won: 2, lost: 1 },
    ]);
    expect(possibleSetOutcomes(5).map((o) => `${o.won}-${o.lost}`)).toEqual(['3-0', '3-1', '3-2']);
  });
});

describe('validatePrediction', () => {
  it('accepts a straight-sets win', () => {
    expect(validatePrediction(match, draft('a', [[6, 3], [7, 5]])).valid).toBe(true);
  });

  it('accepts a three-set win for player B', () => {
    const result = validatePrediction(match, draft('b', [[6, 4], [3, 6], [6, 7]]));
    expect(result).toEqual({ valid: true, errors: [], setErrors: [null, null, null] });
  });

  it('requires a winner', () => {
    const result = validatePrediction(match, draft(null, [[6, 3], [6, 3]]));
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Choose who you think will win.');
  });

  it('rejects a winner who is not in the match', () => {
    const result = validatePrediction(match, draft('z', [[6, 3], [6, 3]]));
    expect(result.errors).toContain('The predicted winner must be one of the two players.');
  });

  it('requires a match score (number of sets)', () => {
    expect(validatePrediction(match, draft('a', [])).errors).toContain(
      'Choose the match score in sets.',
    );
    expect(
      validatePrediction(match, draft('a', [[6, 1], [6, 1], [6, 1], [6, 1]])).errors,
    ).toContain('Choose the match score in sets.');
  });

  it('flags incomplete sets', () => {
    const result = validatePrediction(match, draft('a', [[6, 3], [null, 4]]));
    expect(result.valid).toBe(false);
    expect(result.setErrors).toEqual([null, 'Enter games for both players.']);
  });

  it('flags impossible set scores', () => {
    const result = validatePrediction(match, draft('a', [[6, 5], [6, 2]]));
    expect(result.valid).toBe(false);
    expect(result.setErrors[0]).toMatch(/not a valid set score/i);
  });

  it('rejects sets that contradict the picked winner', () => {
    const result = validatePrediction(match, draft('a', [[3, 6], [4, 6]]));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/Player A must win 2 sets/);
  });

  it('rejects a three-set score where the match was already over', () => {
    // A wins sets 1 and 2, so a third set cannot be played.
    const result = validatePrediction(match, draft('a', [[6, 2], [6, 2], [2, 6]]));
    expect(result.valid).toBe(false);
  });

  it('supports best-of-5 matches', () => {
    const bo5: Match = { ...match, bestOf: 5 };
    expect(validatePrediction(bo5, draft('a', [[6, 4], [4, 6], [6, 3], [7, 6]])).valid).toBe(true);
    expect(validatePrediction(bo5, draft('a', [[6, 4], [6, 4]])).valid).toBe(false);
  });
});
