import { describe, expect, it } from 'vitest';
import type { Match, Prediction } from '../types';
import { getMatchStatus } from './matchStatus';
import { buildLeaderboard, scorePrediction } from './scoring';

const base: Match = {
  id: 'm1',
  round: 'Final',
  court: 'Court 1',
  scheduledAt: '2026-10-17T12:00:00Z',
  bestOf: 3,
  playerA: { id: 'a', name: 'Player A' },
  playerB: { id: 'b', name: 'Player B' },
};
const completed: Match = {
  ...base,
  result: { winnerId: 'a', sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 7, b: 5 }] },
};
const pick = (winnerId: string, sets: Array<[number, number]>): Prediction => ({
  matchId: 'm1',
  winnerId,
  sets: sets.map(([a, b]) => ({ a, b })),
  submittedAt: '2026-10-17T10:00:00Z',
});

describe('getMatchStatus', () => {
  it('is upcoming before the start time and locked from it', () => {
    expect(getMatchStatus(base, new Date('2026-10-17T11:59:00Z'))).toBe('upcoming');
    expect(getMatchStatus(base, new Date('2026-10-17T12:00:00Z'))).toBe('locked');
  });

  it('is completed once a result exists', () => {
    expect(getMatchStatus(completed, new Date('2026-10-17T11:00:00Z'))).toBe('completed');
  });
});

describe('scorePrediction', () => {
  it('returns null for matches without a result', () => {
    expect(scorePrediction(pick('a', [[6, 0], [6, 0]]), base)).toBeNull();
  });

  it('awards nothing for the wrong winner', () => {
    expect(scorePrediction(pick('b', [[4, 6], [6, 3], [5, 7]]), completed)?.points).toBe(0);
  });

  it('awards winner points only for a wrong set count', () => {
    expect(scorePrediction(pick('a', [[6, 4], [6, 4]]), completed)).toMatchObject({
      points: 4, // 3 winner + 1 exact first set
      correctSetCount: false,
      exactSets: 1,
    });
  });

  it('awards the maximum for an exact prediction', () => {
    expect(scorePrediction(pick('a', [[6, 4], [3, 6], [7, 5]]), completed)?.points).toBe(8);
  });
});

describe('buildLeaderboard', () => {
  it('ranks members with shared ranks for ties and includes the current user', () => {
    const board = buildLeaderboard(
      [
        { member: { id: 'x', displayName: 'Xena' }, points: 10, predictionsMade: 2 },
        { member: { id: 'y', displayName: 'Yuri' }, points: 4, predictionsMade: 1 },
      ],
      { id: 'me', displayName: 'Me' },
      { m1: pick('a', [[6, 4], [6, 4]]) },
      [completed],
    );
    expect(board.map((e) => [e.member.displayName, e.points, e.rank])).toEqual([
      ['Xena', 10, 1],
      ['Me', 4, 2],
      ['Yuri', 4, 2],
    ]);
    expect(board.find((e) => e.isCurrentUser)?.predictionsMade).toBe(1);
  });
});
