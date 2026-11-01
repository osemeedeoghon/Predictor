import type { Json, Tables } from '../lib/database.types';
import type { BestOf, Match, Player, Prediction, SetScore, Tournament } from '../types';

/** Thrown when the database returns data the app cannot safely display. */
export class DataShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataShapeError';
  }
}

const isGameCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 7;

/** Parses a jsonb set list such as [{"a":6,"b":4}]. */
export function parseSets(value: Json | null | undefined): SetScore[] {
  if (!Array.isArray(value)) throw new DataShapeError('Set scores must be a list.');
  return value.map((set) => {
    if (!set || typeof set !== 'object' || Array.isArray(set)) {
      throw new DataShapeError('Each set must be an object.');
    }
    const { a, b } = set as Record<string, unknown>;
    if (!isGameCount(a) || !isGameCount(b)) {
      throw new DataShapeError('Set scores must be whole numbers from 0 to 7.');
    }
    return { a, b };
  });
}

export function toBestOf(value: number): BestOf {
  if (value === 3 || value === 5) return value;
  throw new DataShapeError(`Unsupported match format: best of ${value}.`);
}

export function mapTournament(row: Tables<'tournaments'>): Tournament {
  return {
    id: row.id,
    name: row.name,
    venue: row.venue ?? '',
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isDemo: false,
  };
}

export function mapPlayer(row: Pick<Tables<'players'>, 'id' | 'name' | 'seed'>): Player {
  return { id: row.id, name: row.name, ...(row.seed ? { seed: row.seed } : {}) };
}

type MatchRow = Pick<
  Tables<'matches'>,
  'id' | 'round' | 'court' | 'scheduled_at' | 'best_of' | 'player_a_id' | 'player_b_id' | 'winner_id' | 'result_sets'
>;

export function mapMatch(row: MatchRow, playersById: Map<string, Player>): Match {
  const playerA = playersById.get(row.player_a_id);
  const playerB = playersById.get(row.player_b_id);
  if (!playerA || !playerB) throw new DataShapeError(`Match ${row.id} references an unknown player.`);
  return {
    id: row.id,
    round: row.round,
    court: row.court ?? 'Court TBC',
    scheduledAt: row.scheduled_at,
    bestOf: toBestOf(row.best_of),
    playerA,
    playerB,
    ...(row.winner_id && row.result_sets
      ? { result: { winnerId: row.winner_id, sets: parseSets(row.result_sets) } }
      : {}),
  };
}

type PredictionRow = Pick<Tables<'predictions'>, 'match_id' | 'winner_id' | 'sets' | 'updated_at'>;

export function mapPrediction(row: PredictionRow): Prediction {
  return {
    matchId: row.match_id,
    winnerId: row.winner_id,
    sets: parseSets(row.sets),
    submittedAt: row.updated_at,
  };
}
