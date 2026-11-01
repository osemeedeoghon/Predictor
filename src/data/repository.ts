import type { Prediction, PredictionInput, TournamentData, TournamentSummary } from '../types';
import { createMockTournamentData } from './mockData';

/**
 * Data access boundary. The demo uses an in-memory mock; signed-in members
 * use the Supabase implementation in supabaseRepository.ts.
 */
export interface TournamentRepository {
  /** True when nothing is persisted beyond the current page. */
  readonly isDemo: boolean;
  /** Tournaments the current user belongs to. */
  listTournaments(): Promise<TournamentSummary[]>;
  getTournamentData(tournamentId: string): Promise<TournamentData>;
  submitPrediction(input: PredictionInput): Promise<Prediction>;
  /** Joins via invitation code and resolves with the tournament id. */
  joinTournament(inviteCode: string): Promise<string>;
}

interface MockRepositoryOptions {
  now?: () => Date;
  delayMs?: number;
  /** Force loading to reject, for exercising the error state. */
  fail?: boolean;
}

const wait = (ms: number) =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

export function createMockRepository({
  now = () => new Date(),
  delayMs = 0,
  fail = false,
}: MockRepositoryOptions = {}): TournamentRepository {
  let data: TournamentData | null = null;
  const load = () => (data ??= createMockTournamentData(now()));

  return {
    isDemo: true,
    async listTournaments() {
      await wait(delayMs);
      if (fail) throw new Error('Demo data could not be loaded.');
      const { tournament } = load();
      return [{ id: tournament.id, name: tournament.name, role: 'member' }];
    },
    async getTournamentData() {
      await wait(delayMs);
      if (fail) throw new Error('Demo data could not be loaded.');
      return load();
    },
    // Demo only: nothing leaves the browser. The caller keeps the
    // prediction in React state for the lifetime of the page.
    async submitPrediction(input) {
      await wait(delayMs);
      return { ...input, submittedAt: now().toISOString() };
    },
    async joinTournament() {
      throw new Error('Joining tournaments needs an account. Sign in to use an invitation code.');
    },
  };
}
