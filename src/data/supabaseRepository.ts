import { isValidInviteCode, normalizeInviteCode } from '../lib/inviteCode';
import type { ClubPredictClient } from '../lib/supabase';
import type { Json } from '../lib/database.types';
import { toAppError } from './dataErrors';
import { mapMatch, mapPlayer, mapPrediction, mapTournament } from './mappers';
import type { TournamentRepository } from './repository';

const MATCH_COLUMNS =
  'id, round, court, scheduled_at, best_of, player_a_id, player_b_id, winner_id, result_sets';
const PREDICTION_COLUMNS = 'match_id, winner_id, sets, updated_at';

/**
 * Supabase-backed data access for a signed-in member. Every query runs with
 * the member's JWT, so Row Level Security decides what is visible; the
 * filters here only narrow results, they are not the security boundary.
 */
export function createSupabaseRepository(
  client: ClubPredictClient,
  userId: string,
): TournamentRepository {
  return {
    isDemo: false,

    async listTournaments() {
      const [tournaments, memberships] = await Promise.all([
        client.from('tournaments').select('id, name').order('starts_on', { ascending: false }),
        client.from('tournament_members').select('tournament_id, role').eq('user_id', userId),
      ]);
      if (tournaments.error) throw toAppError(tournaments.error, 'load your tournaments');
      if (memberships.error) throw toAppError(memberships.error, 'load your tournaments');

      const roles = new Map(memberships.data.map((m) => [m.tournament_id, m.role]));
      return tournaments.data
        .filter((t) => roles.has(t.id))
        .map((t) => ({ id: t.id, name: t.name, role: roles.get(t.id)! }));
    },

    async getTournamentData(tournamentId) {
      const [tournament, membership, profile, players, matches] = await Promise.all([
        client.from('tournaments').select('*').eq('id', tournamentId).maybeSingle(),
        client
          .from('tournament_members')
          .select('role')
          .eq('tournament_id', tournamentId)
          .eq('user_id', userId)
          .maybeSingle(),
        client.from('profiles').select('id, display_name').eq('id', userId).maybeSingle(),
        client.from('players').select('id, name, seed').eq('tournament_id', tournamentId),
        client
          .from('matches')
          .select(MATCH_COLUMNS)
          .eq('tournament_id', tournamentId)
          .order('scheduled_at'),
      ]);
      for (const res of [tournament, membership, profile, players, matches]) {
        if (res.error) throw toAppError(res.error, 'load this tournament');
      }
      if (!tournament.data || !membership.data) {
        throw new Error("This tournament doesn't exist or you're not a member of it.");
      }

      const matchIds = (matches.data ?? []).map((m) => m.id);
      const predictions = matchIds.length
        ? await client
            .from('predictions')
            .select(PREDICTION_COLUMNS)
            .eq('user_id', userId)
            .in('match_id', matchIds)
        : { data: [], error: null };
      if (predictions.error) throw toAppError(predictions.error, 'load your predictions');

      try {
        const playersById = new Map((players.data ?? []).map((p) => [p.id, mapPlayer(p)]));
        return {
          tournament: mapTournament(tournament.data),
          role: membership.data.role,
          matches: (matches.data ?? []).map((m) => mapMatch(m, playersById)),
          currentUser: {
            id: userId,
            displayName: profile.data?.display_name ?? 'You',
          },
          currentUserPredictions: (predictions.data ?? []).map(mapPrediction),
          otherMembers: [],
        };
      } catch (err) {
        throw toAppError(err, 'tournament');
      }
    },

    async submitPrediction({ matchId, winnerId, sets }) {
      const { data, error } = await client
        .from('predictions')
        .upsert(
          { match_id: matchId, user_id: userId, winner_id: winnerId, sets: sets as unknown as Json },
          { onConflict: 'match_id,user_id' },
        )
        .select(PREDICTION_COLUMNS)
        .single();
      if (error) throw toAppError(error, 'save your prediction');
      return mapPrediction(data);
    },

    async joinTournament(inviteCode) {
      const code = normalizeInviteCode(inviteCode);
      if (!isValidInviteCode(code)) {
        throw new Error('Invitation codes are 8–16 letters or numbers.');
      }
      const { data, error } = await client.rpc('join_tournament', { invite_code: code });
      if (error) throw toAppError(error, 'join the tournament');
      return data;
    },
  };
}
