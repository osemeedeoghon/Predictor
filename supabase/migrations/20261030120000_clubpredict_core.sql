-- ClubPredict core schema: profiles, tournaments, memberships, players,
-- matches and predictions, with Row Level Security.
--
-- Authorization model
--   * Every table has RLS enabled; the anon role gets no table access.
--   * Tournament data is visible only to members of that tournament.
--   * Organizers (tournament_members.role = 'organizer') manage players,
--     matches and official results. Nobody can grant themselves that role
--     through the API: tournament_members has no insert/update/delete grants,
--     and the join function always inserts role = 'member'.
--   * Members create/edit only their own predictions, only while the match is
--     open (before scheduled_at and before a result exists). This is enforced
--     by RLS and re-checked by a trigger.
--   * Other members' predictions become readable only once the match locks.
--
-- Helper functions live in the `private` schema, which is not exposed through
-- the Supabase Data API.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.tournament_role as enum ('member', 'organizer');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- A finished set: 6-0 .. 6-4, 7-5 or 7-6.
create function private.is_valid_set(a integer, b integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select a between 0 and 7
     and b between 0 and 7
     and (
       (greatest(a, b) = 6 and least(a, b) <= 4)
       or (greatest(a, b) = 7 and least(a, b) in (5, 6))
     );
$$;

-- Validates a JSON array of sets like [{"a":6,"b":4},{"a":7,"b":5}] for a
-- best-of-N match won by player A (winner_is_a) or player B. Mirrors
-- src/lib/validation.ts.
create function private.is_valid_score(sets jsonb, best_of integer, winner_is_a boolean)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  need integer := (best_of + 1) / 2;
  s jsonb;
  ga numeric;
  gb numeric;
  wins_a integer := 0;
  wins_b integer := 0;
begin
  if sets is null or winner_is_a is null or jsonb_typeof(sets) <> 'array' then
    return false;
  end if;
  if jsonb_array_length(sets) < need or jsonb_array_length(sets) > best_of then
    return false;
  end if;

  for s in select value from jsonb_array_elements(sets) loop
    if jsonb_typeof(s) <> 'object'
       or (select count(*) from jsonb_object_keys(s)) <> 2
       or jsonb_typeof(s -> 'a') is distinct from 'number'
       or jsonb_typeof(s -> 'b') is distinct from 'number' then
      return false;
    end if;
    ga := (s ->> 'a')::numeric;
    gb := (s ->> 'b')::numeric;
    if ga <> trunc(ga) or gb <> trunc(gb) or ga not between 0 and 7 or gb not between 0 and 7 then
      return false;
    end if;
    if not private.is_valid_set(ga::integer, gb::integer) then
      return false;
    end if;
    -- No set can be played once the match has been decided.
    if wins_a = need or wins_b = need then
      return false;
    end if;
    if ga > gb then
      wins_a := wins_a + 1;
    else
      wins_b := wins_b + 1;
    end if;
  end loop;

  return case when winner_is_a then wins_a = need else wins_b = need end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    constraint profiles_display_name_length check (char_length(btrim(display_name)) between 2 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint tournaments_name_length check (char_length(btrim(name)) between 3 and 120),
  venue text
    constraint tournaments_venue_length check (venue is null or char_length(venue) <= 120),
  starts_on date not null,
  ends_on date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournaments_dates_ordered check (ends_on >= starts_on)
);

-- Invitation codes are kept apart from tournaments so ordinary members
-- cannot read them; only organizers can.
create table public.tournament_invites (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  code text not null unique
    constraint tournament_invites_code_format check (code ~ '^[A-Z0-9]{8,16}$'),
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tournament_members (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.tournament_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null
    constraint players_name_length check (char_length(btrim(name)) between 2 and 80),
  seed smallint
    constraint players_seed_range check (seed is null or seed between 1 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_name_unique unique (tournament_id, name),
  -- Target for composite foreign keys so matches can only use players
  -- from their own tournament.
  constraint players_id_tournament_unique unique (id, tournament_id)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round text not null
    constraint matches_round_length check (char_length(btrim(round)) between 1 and 60),
  court text
    constraint matches_court_length check (court is null or char_length(court) <= 60),
  scheduled_at timestamptz not null,
  best_of smallint not null default 3
    constraint matches_best_of check (best_of in (3, 5)),
  player_a_id uuid not null,
  player_b_id uuid not null,
  winner_id uuid,
  result_sets jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_player_a_fkey foreign key (player_a_id, tournament_id)
    references public.players (id, tournament_id) on delete restrict,
  constraint matches_player_b_fkey foreign key (player_b_id, tournament_id)
    references public.players (id, tournament_id) on delete restrict,
  constraint matches_distinct_players check (player_a_id <> player_b_id),
  constraint matches_result_complete check ((winner_id is null) = (result_sets is null)),
  constraint matches_winner_is_player check (winner_id is null or winner_id in (player_a_id, player_b_id)),
  constraint matches_result_valid check (
    result_sets is null or private.is_valid_score(result_sets, best_of, winner_id = player_a_id)
  )
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  winner_id uuid not null,
  sets jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint predictions_one_per_member unique (match_id, user_id)
);

create index tournament_invites_tournament_idx on public.tournament_invites (tournament_id);
create index tournament_members_user_idx on public.tournament_members (user_id);
create index players_tournament_idx on public.players (tournament_id);
create index matches_tournament_time_idx on public.matches (tournament_id, scheduled_at);
create index predictions_user_idx on public.predictions (user_id);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger tournaments_updated_at before update on public.tournaments
  for each row execute function private.set_updated_at();
create trigger players_updated_at before update on public.players
  for each row execute function private.set_updated_at();
create trigger matches_updated_at before update on public.matches
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers (security definer so policies don't recurse)
-- ---------------------------------------------------------------------------

create function private.is_tournament_member(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournament_members
    where tournament_id = p_tournament_id and user_id = (select auth.uid())
  );
$$;

create function private.is_tournament_organizer(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournament_members
    where tournament_id = p_tournament_id
      and user_id = (select auth.uid())
      and role = 'organizer'
  );
$$;

create function private.shares_tournament_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tournament_members mine
    join public.tournament_members theirs on theirs.tournament_id = mine.tournament_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = p_user_id
  );
$$;

create function private.match_tournament_id(p_match_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tournament_id from public.matches where id = p_match_id;
$$;

-- Open = not started and no official result. Uses the database clock, never
-- the browser's.
create function private.match_is_open(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches
    where id = p_match_id and winner_id is null and scheduled_at > now()
  );
$$;

-- ---------------------------------------------------------------------------
-- Prediction integrity trigger (defence in depth alongside RLS)
-- ---------------------------------------------------------------------------

create function private.validate_prediction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.matches%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new.match_id <> old.match_id or new.user_id <> old.user_id then
      raise exception 'A prediction cannot be moved to another match or member.'
        using errcode = 'CP003';
    end if;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  select * into m from public.matches where id = new.match_id;
  if not found then
    raise exception 'Match not found.' using errcode = 'CP004';
  end if;

  if m.winner_id is not null or m.scheduled_at <= now() then
    raise exception 'Predictions for this match are locked.' using errcode = 'CP001';
  end if;

  if new.winner_id not in (m.player_a_id, m.player_b_id) then
    raise exception 'The predicted winner must be one of the two players.' using errcode = 'CP002';
  end if;

  if not private.is_valid_score(new.sets, m.best_of, new.winner_id = m.player_a_id) then
    raise exception 'The predicted set scores are not a valid result for this match.'
      using errcode = 'CP002';
  end if;

  return new;
end;
$$;

create trigger predictions_validate before insert or update on public.predictions
  for each row execute function private.validate_prediction();

-- ---------------------------------------------------------------------------
-- New users get a profile automatically
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if char_length(v_name) < 2 then
    v_name := split_part(coalesce(new.email, ''), '@', 1);
  end if;
  if char_length(v_name) < 2 then
    v_name := 'Member';
  end if;
  insert into public.profiles (id, display_name) values (new.id, left(v_name, 40));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Joining a tournament by invitation code
-- ---------------------------------------------------------------------------

create function public.join_tournament(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_code text := upper(regexp_replace(coalesce(invite_code, ''), '[\s-]', '', 'g'));
  v_tournament uuid;
begin
  if v_user is null then
    raise exception 'You must be signed in to join a tournament.' using errcode = '28000';
  end if;

  select i.tournament_id into v_tournament
  from public.tournament_invites i
  where i.code = v_code
    and i.active
    and (i.expires_at is null or i.expires_at > now());

  if v_tournament is null then
    raise exception 'That invitation code is not valid or has expired.' using errcode = 'CP010';
  end if;

  -- Always 'member'. An existing membership (including organizer) is left untouched.
  insert into public.tournament_members (tournament_id, user_id, role)
  values (v_tournament, v_user, 'member')
  on conflict (tournament_id, user_id) do nothing;

  return v_tournament;
end;
$$;

revoke all on function public.join_tournament(text) from public, anon;
grant execute on function public.join_tournament(text) to authenticated;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges: least privilege per role; RLS narrows rows further.
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.tournaments, public.tournament_invites,
  public.tournament_members, public.players, public.matches, public.predictions
  from anon, authenticated;

grant select, update (display_name) on public.profiles to authenticated;
grant select, update (name, venue, starts_on, ends_on) on public.tournaments to authenticated;
grant select on public.tournament_invites to authenticated;
grant select on public.tournament_members to authenticated;
grant select, insert, update, delete on public.players to authenticated;
grant select, insert, update, delete on public.matches to authenticated;
grant select, delete on public.predictions to authenticated;
grant insert (match_id, user_id, winner_id, sets),
      update (match_id, user_id, winner_id, sets)
  on public.predictions to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_invites enable row level security;
alter table public.tournament_members enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;

-- profiles
create policy "profiles: read self and fellow members" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_tournament_with(id));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- tournaments
create policy "tournaments: members read" on public.tournaments
  for select to authenticated
  using (private.is_tournament_member(id));

create policy "tournaments: organizers update" on public.tournaments
  for update to authenticated
  using (private.is_tournament_organizer(id))
  with check (private.is_tournament_organizer(id));

-- tournament_invites (organizers only; joining goes through join_tournament)
create policy "invites: organizers read" on public.tournament_invites
  for select to authenticated
  using (private.is_tournament_organizer(tournament_id));

-- tournament_members (read-only through the API)
create policy "members: members read roster" on public.tournament_members
  for select to authenticated
  using (private.is_tournament_member(tournament_id));

-- players
create policy "players: members read" on public.players
  for select to authenticated
  using (private.is_tournament_member(tournament_id));

create policy "players: organizers insert" on public.players
  for insert to authenticated
  with check (private.is_tournament_organizer(tournament_id));

create policy "players: organizers update" on public.players
  for update to authenticated
  using (private.is_tournament_organizer(tournament_id))
  with check (private.is_tournament_organizer(tournament_id));

create policy "players: organizers delete" on public.players
  for delete to authenticated
  using (private.is_tournament_organizer(tournament_id));

-- matches (results are only writable by organizers)
create policy "matches: members read" on public.matches
  for select to authenticated
  using (private.is_tournament_member(tournament_id));

create policy "matches: organizers insert" on public.matches
  for insert to authenticated
  with check (private.is_tournament_organizer(tournament_id));

create policy "matches: organizers update" on public.matches
  for update to authenticated
  using (private.is_tournament_organizer(tournament_id))
  with check (private.is_tournament_organizer(tournament_id));

create policy "matches: organizers delete" on public.matches
  for delete to authenticated
  using (private.is_tournament_organizer(tournament_id));

-- predictions
create policy "predictions: read own" on public.predictions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "predictions: read others once locked" on public.predictions
  for select to authenticated
  using (
    private.is_tournament_member(private.match_tournament_id(match_id))
    and not private.match_is_open(match_id)
  );

create policy "predictions: insert own while open" on public.predictions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_tournament_member(private.match_tournament_id(match_id))
    and private.match_is_open(match_id)
  );

create policy "predictions: update own while open" on public.predictions
  for update to authenticated
  using (user_id = (select auth.uid()) and private.match_is_open(match_id))
  with check (
    user_id = (select auth.uid())
    and private.is_tournament_member(private.match_tournament_id(match_id))
    and private.match_is_open(match_id)
  );

create policy "predictions: delete own while open" on public.predictions
  for delete to authenticated
  using (user_id = (select auth.uid()) and private.match_is_open(match_id));
