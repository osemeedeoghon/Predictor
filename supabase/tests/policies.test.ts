// @vitest-environment node
//
// Runs the real migration in PGlite (Postgres compiled to WASM) and checks
// the Row Level Security policies, grants and triggers by acting as
// different users. Supabase's `auth` schema and API roles are stubbed with
// the minimum the migration relies on. Use a real Supabase project for
// end-to-end checks of Auth itself.
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import migration from '../migrations/20261030120000_clubpredict_core.sql?raw';

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const U = { alice: id(1), bob: id(2), olivia: id(3), mallory: id(4) };
const T1 = id(100);
const T2 = id(101);
const P = { a: id(201), b: id(202), c: id(203), d: id(204), x: id(205), y: id(206) };
const M = { open: id(301), locked: id(302), done: id(303), otherTournament: id(304) };

const SEED = `
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${U.alice}', 'alice@example.test', '{"display_name":"Alice A"}'),
    ('${U.bob}', 'bob@example.test', '{"display_name":"Bob B"}'),
    ('${U.olivia}', 'olivia@example.test', '{}'),
    ('${U.mallory}', 'm@example.test', '{"display_name":" "}');

  insert into public.tournaments (id, name, starts_on, ends_on) values
    ('${T1}', 'Autumn Demo', current_date, current_date + 2),
    ('${T2}', 'Other Club Demo', current_date, current_date + 2);
  insert into public.tournament_invites (tournament_id, code) values
    ('${T1}', 'AUTUMNDEMO'), ('${T2}', 'OTHERDEMO1');
  insert into public.tournament_members (tournament_id, user_id, role) values
    ('${T1}', '${U.alice}', 'member'),
    ('${T1}', '${U.bob}', 'member'),
    ('${T1}', '${U.olivia}', 'organizer');

  insert into public.players (id, tournament_id, name) values
    ('${P.a}', '${T1}', 'Player A'), ('${P.b}', '${T1}', 'Player B'),
    ('${P.c}', '${T1}', 'Player C'), ('${P.d}', '${T1}', 'Player D'),
    ('${P.x}', '${T2}', 'Player X'), ('${P.y}', '${T2}', 'Player Y');

  insert into public.matches (id, tournament_id, round, scheduled_at, player_a_id, player_b_id, winner_id, result_sets) values
    ('${M.open}', '${T1}', 'QF', now() + interval '2 hours', '${P.a}', '${P.b}', null, null),
    ('${M.locked}', '${T1}', 'QF', now() - interval '10 minutes', '${P.c}', '${P.d}', null, null),
    ('${M.done}', '${T1}', 'QF', now() - interval '3 hours', '${P.a}', '${P.c}', '${P.a}', '[{"a":6,"b":3},{"a":6,"b":4}]'),
    ('${M.otherTournament}', '${T2}', 'F', now() + interval '2 hours', '${P.x}', '${P.y}', null, null);
`;

const STRAIGHT_SETS_A = '[{"a":6,"b":3},{"a":6,"b":4}]';

let db: PGlite;

interface RunResult {
  rows: Record<string, unknown>[];
  affectedRows: number;
  error?: string;
  code?: string;
}

/** Runs one statement as `user` (null = anon) inside a savepoint. */
async function run(user: string | null, sql: string, params: unknown[] = []): Promise<RunResult> {
  await db.exec('savepoint step');
  try {
    await db.exec(user ? 'set role authenticated' : 'set role anon');
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
    const res = await db.query<Record<string, unknown>>(sql, params);
    await db.exec('reset role; release savepoint step');
    return { rows: res.rows, affectedRows: res.affectedRows ?? 0 };
  } catch (e) {
    await db.exec('rollback to savepoint step; release savepoint step');
    const err = e as { message: string; code?: string };
    return { rows: [], affectedRows: 0, error: err.message, code: err.code };
  }
}

/** Superuser statement (like the SQL editor or a trusted backend). */
const admin = (sql: string, params: unknown[] = []) => db.query(sql, params);

const predict = (user: string, matchId: string, winnerId: string, sets: string, forUser = user) =>
  run(
    user,
    `insert into public.predictions (match_id, user_id, winner_id, sets) values ($1, $2, $3, $4::jsonb)
     on conflict (match_id, user_id) do update set winner_id = excluded.winner_id, sets = excluded.sets
     returning id`,
    [matchId, forUser, winnerId, sets],
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(migration);
  await db.exec(SEED);
}, 30_000);

afterAll(() => db.close());

// Each test runs in a transaction that is rolled back afterwards.
beforeEach(() => db.exec('begin'));
afterEach(() => db.exec('rollback'));

describe('profiles', () => {
  it('are created on sign-up with a display name fallback', async () => {
    const { rows } = await admin('select id, display_name from public.profiles order by id');
    expect(rows).toEqual([
      { id: U.alice, display_name: 'Alice A' },
      { id: U.bob, display_name: 'Bob B' },
      { id: U.olivia, display_name: 'olivia' },
      { id: U.mallory, display_name: 'Member' },
    ]);
  });

  it('are visible to yourself and fellow members only', async () => {
    const alice = await run(U.alice, 'select id from public.profiles');
    expect(alice.rows.map((r) => r.id).sort()).toEqual([U.alice, U.bob, U.olivia]);
    const mallory = await run(U.mallory, 'select id from public.profiles');
    expect(mallory.rows.map((r) => r.id)).toEqual([U.mallory]);
  });

  it('can only be edited by their owner', async () => {
    const other = await run(U.alice, `update public.profiles set display_name = 'Hacked' where id = $1`, [U.bob]);
    expect(other.affectedRows).toBe(0);
    const own = await run(U.alice, `update public.profiles set display_name = 'Alice New' where id = $1`, [U.alice]);
    expect(own.affectedRows).toBe(1);
  });
});

describe('tournament visibility', () => {
  it('denies anonymous access entirely', async () => {
    const res = await run(null, 'select * from public.matches');
    expect(res.error).toMatch(/permission denied/);
  });

  it('hides tournaments, players and matches from non-members', async () => {
    for (const table of ['tournaments', 'players', 'matches', 'tournament_members']) {
      const res = await run(U.mallory, `select * from public.${table}`);
      expect(res.error).toBeUndefined();
      expect(res.rows).toHaveLength(0);
    }
  });

  it('shows members only their own tournaments', async () => {
    const t = await run(U.alice, 'select id from public.tournaments');
    expect(t.rows).toEqual([{ id: T1 }]);
    const m = await run(U.alice, 'select id from public.matches');
    expect(m.rows).toHaveLength(3);
  });

  it('keeps invitation codes visible to organizers only', async () => {
    expect((await run(U.alice, 'select code from public.tournament_invites')).rows).toHaveLength(0);
    expect((await run(U.olivia, 'select code from public.tournament_invites')).rows).toEqual([
      { code: 'AUTUMNDEMO' },
    ]);
  });
});

describe('joining with an invitation code', () => {
  it('rejects unknown, inactive and expired codes', async () => {
    expect((await run(U.mallory, `select public.join_tournament('NOPE1234')`)).code).toBe('CP010');
    await admin(`update public.tournament_invites set active = false where code = 'OTHERDEMO1'`);
    expect((await run(U.mallory, `select public.join_tournament('OTHERDEMO1')`)).code).toBe('CP010');
    await admin(`update public.tournament_invites set active = true, expires_at = now() - interval '1 day' where code = 'OTHERDEMO1'`);
    expect((await run(U.mallory, `select public.join_tournament('OTHERDEMO1')`)).code).toBe('CP010');
  });

  it('adds the caller as an ordinary member and normalises the code', async () => {
    const res = await run(U.mallory, `select public.join_tournament(' autumn-demo ') as id`);
    expect(res.rows).toEqual([{ id: T1 }]);
    const { rows } = await admin(
      'select role from public.tournament_members where user_id = $1 and tournament_id = $2',
      [U.mallory, T1],
    );
    expect(rows).toEqual([{ role: 'member' }]);
    // Now a member, Mallory can see the tournament.
    expect((await run(U.mallory, 'select id from public.matches')).rows).toHaveLength(3);
  });

  it('does not change an existing organizer role', async () => {
    await run(U.olivia, `select public.join_tournament('AUTUMNDEMO')`);
    const { rows } = await admin('select role from public.tournament_members where user_id = $1', [U.olivia]);
    expect(rows).toEqual([{ role: 'organizer' }]);
  });

  it('cannot be called anonymously', async () => {
    expect((await run(null, `select public.join_tournament('AUTUMNDEMO')`)).error).toMatch(
      /permission denied/,
    );
  });
});

describe('organizer privileges', () => {
  it('cannot be self-granted by inserting or updating memberships', async () => {
    const insert = await run(
      U.mallory,
      `insert into public.tournament_members (tournament_id, user_id, role) values ($1, $2, 'organizer')`,
      [T1, U.mallory],
    );
    expect(insert.error).toMatch(/permission denied/);
    const update = await run(U.alice, `update public.tournament_members set role = 'organizer' where user_id = $1`, [U.alice]);
    expect(update.error).toMatch(/permission denied/);
  });

  it('lets only organizers record official results', async () => {
    const setResult = (user: string) =>
      run(user, `update public.matches set winner_id = $1, result_sets = $2::jsonb where id = $3`, [
        P.c,
        '[{"a":6,"b":4},{"a":6,"b":4}]',
        M.locked,
      ]);
    expect((await setResult(U.alice)).affectedRows).toBe(0);
    expect((await setResult(U.olivia)).affectedRows).toBe(1);
  });

  it('cannot change results in another tournament', async () => {
    const res = await run(U.olivia, `update public.matches set court = 'X' where id = $1`, [M.otherTournament]);
    expect(res.affectedRows).toBe(0);
  });

  it('rejects impossible official results', async () => {
    const res = await run(U.olivia, `update public.matches set winner_id = $1, result_sets = $2::jsonb where id = $3`, [
      P.c,
      '[{"a":6,"b":6},{"a":6,"b":4}]',
      M.locked,
    ]);
    expect(res.error).toMatch(/matches_result_valid/);
  });
});

describe('predictions', () => {
  it('can be created and edited by the member while the match is open', async () => {
    expect((await predict(U.alice, M.open, P.a, STRAIGHT_SETS_A)).error).toBeUndefined();
    const edit = await predict(U.alice, M.open, P.b, '[{"a":3,"b":6},{"a":7,"b":5},{"a":4,"b":6}]');
    expect(edit.error).toBeUndefined();
    const { rows } = await admin('select winner_id from public.predictions where user_id = $1', [U.alice]);
    expect(rows).toEqual([{ winner_id: P.b }]);
  });

  it('work with the upsert statement PostgREST generates for the client', async () => {
    // supabase-js .upsert() → every payload column in the SET list, plus RETURNING.
    const upsert = (winner: string, sets: string) =>
      run(
        U.alice,
        `insert into public.predictions (match_id, user_id, winner_id, sets) values ($1, $2, $3, $4::jsonb)
         on conflict (match_id, user_id) do update set
           match_id = excluded.match_id, user_id = excluded.user_id,
           winner_id = excluded.winner_id, sets = excluded.sets
         returning match_id, winner_id, sets, updated_at`,
        [M.open, U.alice, winner, sets],
      );
    expect((await upsert(P.a, STRAIGHT_SETS_A)).error).toBeUndefined();
    const second = await upsert(P.b, '[{"a":3,"b":6},{"a":3,"b":6}]');
    expect(second.error).toBeUndefined();
    expect(second.rows[0]).toMatchObject({ match_id: M.open, winner_id: P.b });
  });

  it('are rejected once the match has started or finished', async () => {
    const locked = await predict(U.alice, M.locked, P.c, STRAIGHT_SETS_A);
    expect(locked).toMatchObject({ code: 'CP001', error: 'Predictions for this match are locked.' });
    const done = await predict(U.alice, M.done, P.a, STRAIGHT_SETS_A);
    expect(done.code).toBe('CP001');
  });

  it('are still rejected by RLS alone if the trigger is removed', async () => {
    await admin('alter table public.predictions disable trigger predictions_validate');
    expect((await predict(U.alice, M.locked, P.c, STRAIGHT_SETS_A)).error).toMatch(/row-level security/);
    expect((await predict(U.alice, M.done, P.a, STRAIGHT_SETS_A)).error).toMatch(/row-level security/);
    expect((await predict(U.alice, M.open, P.a, STRAIGHT_SETS_A)).error).toBeUndefined();
  });

  it('cannot be edited after the match locks', async () => {
    await predict(U.alice, M.open, P.a, STRAIGHT_SETS_A);
    await admin(`update public.matches set scheduled_at = now() - interval '1 minute' where id = $1`, [M.open]);
    const res = await run(
      U.alice,
      `update public.predictions set winner_id = $1, sets = $2::jsonb where match_id = $3`,
      [P.b, '[{"a":3,"b":6},{"a":3,"b":6}]', M.open],
    );
    expect(res.affectedRows).toBe(0);
    expect((await predict(U.alice, M.open, P.b, '[{"a":3,"b":6},{"a":3,"b":6}]')).error).toBeDefined();
  });

  it('cannot be made on behalf of another member or by non-members', async () => {
    expect((await predict(U.alice, M.open, P.a, STRAIGHT_SETS_A, U.bob)).error).toMatch(/row-level security/);
    expect((await predict(U.mallory, M.open, P.a, STRAIGHT_SETS_A)).error).toMatch(/row-level security/);
    expect((await predict(U.alice, M.otherTournament, P.x, STRAIGHT_SETS_A)).error).toMatch(/row-level security/);
  });

  it("cannot modify or delete another member's prediction", async () => {
    await predict(U.bob, M.open, P.a, STRAIGHT_SETS_A);
    const update = await run(U.alice, `update public.predictions set winner_id = $1 where user_id = $2`, [P.b, U.bob]);
    expect(update.affectedRows).toBe(0);
    const del = await run(U.alice, 'delete from public.predictions where user_id = $1', [U.bob]);
    expect(del.affectedRows).toBe(0);
  });

  it('validates the score and winner in the database', async () => {
    const badSet = await predict(U.alice, M.open, P.a, '[{"a":6,"b":5},{"a":6,"b":4}]');
    expect(badSet.code).toBe('CP002');
    const mismatch = await predict(U.alice, M.open, P.a, '[{"a":3,"b":6},{"a":4,"b":6}]');
    expect(mismatch.code).toBe('CP002');
    const extraSet = await predict(U.alice, M.open, P.a, '[{"a":6,"b":1},{"a":6,"b":1},{"a":1,"b":6}]');
    expect(extraSet.code).toBe('CP002');
    const wrongPlayer = await predict(U.alice, M.open, P.c, STRAIGHT_SETS_A);
    expect(wrongPlayer.code).toBe('CP002');
    const notJson = await predict(U.alice, M.open, P.a, '[{"a":"6","b":3},{"a":6,"b":3}]');
    expect(notJson.code).toBe('CP002');
  });

  it('cannot be moved to another match', async () => {
    await predict(U.alice, M.open, P.a, STRAIGHT_SETS_A);
    await admin(`update public.matches set scheduled_at = now() + interval '1 hour' where id = $1`, [M.locked]);
    const res = await run(U.alice, 'update public.predictions set match_id = $1 where user_id = $2', [M.locked, U.alice]);
    expect(res.code).toBe('CP003');
  });

  it("hides other members' predictions until the match locks", async () => {
    await predict(U.alice, M.open, P.a, STRAIGHT_SETS_A);
    const before = await run(U.bob, 'select user_id from public.predictions');
    expect(before.rows).toHaveLength(0);
    const own = await run(U.alice, 'select user_id from public.predictions');
    expect(own.rows).toEqual([{ user_id: U.alice }]);

    await admin(`update public.matches set scheduled_at = now() - interval '1 minute' where id = $1`, [M.open]);
    const after = await run(U.bob, 'select user_id from public.predictions');
    expect(after.rows).toEqual([{ user_id: U.alice }]);
    // Still hidden from people outside the tournament.
    expect((await run(U.mallory, 'select user_id from public.predictions')).rows).toHaveLength(0);
  });
});
