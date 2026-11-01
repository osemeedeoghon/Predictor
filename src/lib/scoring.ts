import type { LeaderboardEntry, Match, Member, Prediction } from '../types';

export const POINTS = {
  correctWinner: 3,
  correctSetCount: 2,
  exactSet: 1,
} as const;

export interface PredictionScore {
  points: number;
  correctWinner: boolean;
  correctSetCount: boolean;
  exactSets: number;
}

/**
 * Winner +3. If the winner is right: right number of sets +2, and +1 for
 * each set whose exact score matches in order.
 */
export function scorePrediction(prediction: Prediction, match: Match): PredictionScore | null {
  if (!match.result) return null;
  const { result } = match;
  const correctWinner = prediction.winnerId === result.winnerId;
  if (!correctWinner) {
    return { points: 0, correctWinner, correctSetCount: false, exactSets: 0 };
  }
  const correctSetCount = prediction.sets.length === result.sets.length;
  const exactSets = prediction.sets.filter(
    (s, i) => result.sets[i] && s.a === result.sets[i].a && s.b === result.sets[i].b,
  ).length;
  const points =
    POINTS.correctWinner +
    (correctSetCount ? POINTS.correctSetCount : 0) +
    exactSets * POINTS.exactSet;
  return { points, correctWinner, correctSetCount, exactSets };
}

export interface RankedEntry extends LeaderboardEntry {
  rank: number;
}

export function buildLeaderboard(
  others: LeaderboardEntry[],
  currentUser: Member,
  predictions: Record<string, Prediction>,
  matches: Match[],
): RankedEntry[] {
  const userPredictions = Object.values(predictions);
  const userPoints = userPredictions.reduce((total, p) => {
    const match = matches.find((m) => m.id === p.matchId);
    return total + (match ? scorePrediction(p, match)?.points ?? 0 : 0);
  }, 0);

  const entries: LeaderboardEntry[] = [
    ...others,
    {
      member: currentUser,
      points: userPoints,
      predictionsMade: userPredictions.length,
      isCurrentUser: true,
    },
  ].sort((x, y) => y.points - x.points || x.member.displayName.localeCompare(y.member.displayName));

  // Standard competition ranking: ties share a rank (1, 2, 2, 4).
  return entries.map((entry) => ({
    ...entry,
    rank: entries.findIndex((e) => e.points === entry.points) + 1,
  }));
}
