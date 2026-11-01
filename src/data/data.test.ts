import { describe, expect, it, vi } from 'vitest';
import { isValidInviteCode, normalizeInviteCode } from '../lib/inviteCode';
import type { ClubPredictClient } from '../lib/supabase';
import { toAppError } from './dataErrors';
import { DataShapeError, mapMatch, mapPlayer, parseSets } from './mappers';
import { createSupabaseRepository } from './supabaseRepository';

describe('parseSets', () => {
  it('parses well-formed set lists', () => {
    expect(parseSets([{ a: 6, b: 4 }, { a: 7, b: 6 }])).toEqual([
      { a: 6, b: 4 },
      { a: 7, b: 6 },
    ]);
  });

  it.each([null, 'x', [{ a: '6', b: 4 }], [{ a: 6 }], [{ a: 6.5, b: 4 }], [{ a: 8, b: 6 }], [[6, 4]]])(
    'rejects malformed data %j',
    (value) => {
      expect(() => parseSets(value)).toThrow(DataShapeError);
    },
  );
});

describe('mapMatch', () => {
  const players = new Map([
    ['p1', mapPlayer({ id: 'p1', name: 'Player One', seed: 2 })],
    ['p2', mapPlayer({ id: 'p2', name: 'Player Two', seed: null })],
  ]);
  const row = {
    id: 'm1',
    round: 'Final',
    court: null,
    scheduled_at: '2026-10-30T15:00:00Z',
    best_of: 3,
    player_a_id: 'p1',
    player_b_id: 'p2',
    winner_id: null,
    result_sets: null,
  };

  it('maps database rows to domain matches', () => {
    expect(mapMatch(row, players)).toEqual({
      id: 'm1',
      round: 'Final',
      court: 'Court TBC',
      scheduledAt: '2026-10-30T15:00:00Z',
      bestOf: 3,
      playerA: { id: 'p1', name: 'Player One', seed: 2 },
      playerB: { id: 'p2', name: 'Player Two' },
    });
    const done = mapMatch({ ...row, winner_id: 'p2', result_sets: [{ a: 4, b: 6 }, { a: 3, b: 6 }] }, players);
    expect(done.result).toEqual({ winnerId: 'p2', sets: [{ a: 4, b: 6 }, { a: 3, b: 6 }] });
  });

  it('refuses unknown players or formats', () => {
    expect(() => mapMatch({ ...row, player_b_id: 'p9' }, players)).toThrow(DataShapeError);
    expect(() => mapMatch({ ...row, best_of: 4 }, players)).toThrow(DataShapeError);
  });
});

describe('toAppError', () => {
  it('maps database error codes to member-facing messages', () => {
    expect(toAppError({ code: 'CP001' }, 'save').message).toMatch(/locked/);
    expect(toAppError({ code: 'CP010' }, 'join').message).toMatch(/not valid or has expired/);
    expect(
      toAppError({ code: '42501', message: 'new row violates row-level security policy' }, 'save').message,
    ).toMatch(/may have locked/);
    expect(toAppError({ code: 'PGRST301' }, 'load').message).toMatch(/session has expired/);
    expect(toAppError({ message: 'TypeError: Failed to fetch' }, 'load').message).toMatch(/couldn't reach/i);
  });

  it('hides unexpected internal details', () => {
    const msg = toAppError({ code: 'XX000', message: 'internal: relation secret' }, 'load data').message;
    expect(msg).toBe('Something went wrong while trying to load data. Please try again.');
  });
});

describe('invitation codes', () => {
  it('normalises spacing, hyphens and case', () => {
    expect(normalizeInviteCode(' autumn-demo ')).toBe('AUTUMNDEMO');
  });

  it('validates the format', () => {
    expect(isValidInviteCode('AUTUMNDEMO')).toBe(true);
    expect(isValidInviteCode('SHORT')).toBe(false);
    expect(isValidInviteCode("AUTUMN'--")).toBe(false);
  });
});

describe('createSupabaseRepository', () => {
  function stubClient(result: { data: unknown; error: unknown }) {
    const builder = {
      upsert: vi.fn(() => builder),
      select: vi.fn(() => builder),
      single: vi.fn(async () => result),
    };
    const client = { from: vi.fn(() => builder), rpc: vi.fn(async () => result) };
    return { client: client as unknown as ClubPredictClient, builder, rpc: client.rpc };
  }

  it("always saves predictions under the signed-in member's id", async () => {
    const saved = { match_id: 'm1', winner_id: 'p1', sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }], updated_at: 'now' };
    const { client, builder } = stubClient({ data: saved, error: null });
    const repo = createSupabaseRepository(client, 'user-1');
    const result = await repo.submitPrediction({ matchId: 'm1', winnerId: 'p1', sets: saved.sets });
    expect(builder.upsert).toHaveBeenCalledWith(
      { match_id: 'm1', user_id: 'user-1', winner_id: 'p1', sets: saved.sets },
      { onConflict: 'match_id,user_id' },
    );
    expect(result).toEqual({ matchId: 'm1', winnerId: 'p1', sets: saved.sets, submittedAt: 'now' });
  });

  it('surfaces database rejections as readable errors', async () => {
    const { client } = stubClient({ data: null, error: { code: 'CP001', message: 'Predictions for this match are locked.' } });
    const repo = createSupabaseRepository(client, 'user-1');
    await expect(repo.submitPrediction({ matchId: 'm1', winnerId: 'p1', sets: [] })).rejects.toThrow(
      'This match has started, so predictions are locked.',
    );
  });

  it('joins through the join_tournament function with a normalised code', async () => {
    const { client, rpc } = stubClient({ data: 't1', error: null });
    const repo = createSupabaseRepository(client, 'user-1');
    await expect(repo.joinTournament(' autumn-demo ')).resolves.toBe('t1');
    expect(rpc).toHaveBeenCalledWith('join_tournament', { invite_code: 'AUTUMNDEMO' });
  });

  it('rejects malformed codes without calling the server', async () => {
    const { client, rpc } = stubClient({ data: null, error: null });
    await expect(createSupabaseRepository(client, 'u').joinTournament('abc')).rejects.toThrow(/8–16/);
    expect(rpc).not.toHaveBeenCalled();
  });
});
