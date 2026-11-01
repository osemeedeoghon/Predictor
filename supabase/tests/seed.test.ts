// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import migration from '../migrations/20261030120000_clubpredict_core.sql?raw';
import seed from '../seed.sql?raw';

it('applies the demo seed on top of the migration', async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  `);
  await db.exec(migration);
  await db.exec(seed);
  const { rows } = await db.query<{ matches: number; code: string }>(
    `select (select count(*)::int from public.matches) as matches,
            (select code from public.tournament_invites) as code`,
  );
  expect(rows).toEqual([{ matches: 4, code: 'AUTUMNDEMO' }]);
  await db.close();
}, 30_000);
