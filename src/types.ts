// Domain types for ClubPredict. These mirror the shape we expect the
// Supabase tables to have later, so the UI does not depend on mock data.

export interface Player {
  id: string;
  name: string;
  seed?: number;
}

/** Games won in a single set, from the perspective of playerA / playerB. */
export interface SetScore {
  a: number;
  b: number;
}

export type BestOf = 3 | 5;

export interface MatchResult {
  winnerId: string;
  sets: SetScore[];
}

export interface Match {
  id: string;
  round: string;
  court: string;
  /** ISO timestamp. Predictions lock at this time. */
  scheduledAt: string;
  bestOf: BestOf;
  playerA: Player;
  playerB: Player;
  result?: MatchResult;
}

export type MatchStatus = 'upcoming' | 'locked' | 'completed';

/** What a member submits; the data source adds ownership and timestamps. */
export interface PredictionInput {
  matchId: string;
  winnerId: string;
  sets: SetScore[];
}

export interface Prediction {
  matchId: string;
  winnerId: string;
  sets: SetScore[];
  /** ISO timestamp of when the prediction was made in this session. */
  submittedAt: string;
}

export interface Member {
  id: string;
  displayName: string;
}

export interface LeaderboardEntry {
  member: Member;
  points: number;
  predictionsMade: number;
  isCurrentUser?: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  venue: string;
  startsOn: string;
  endsOn: string;
  isDemo: boolean;
}

export type TournamentRole = 'member' | 'organizer';

export interface TournamentSummary {
  id: string;
  name: string;
  role: TournamentRole;
}

export interface TournamentData {
  tournament: Tournament;
  role: TournamentRole;
  matches: Match[];
  currentUser: Member;
  /** Predictions the current user had already made before this session. */
  currentUserPredictions: Prediction[];
  /** Other members' standings (demo only; scoring is not live yet). */
  otherMembers: LeaderboardEntry[];
}
