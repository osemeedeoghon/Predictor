-- Fictional demo data for a development project. Not part of the migration.
-- Run in the Supabase SQL editor (runs as postgres, bypassing RLS).
-- Match times are relative to now() so there are open, locked and completed
-- matches. Invitation code: AUTUMNDEMO

do $$
declare
  t uuid := gen_random_uuid();
  p_hale uuid := gen_random_uuid();
  p_rook uuid := gen_random_uuid();
  p_castell uuid := gen_random_uuid();
  p_marwick uuid := gen_random_uuid();
  p_okafor uuid := gen_random_uuid();
  p_pell uuid := gen_random_uuid();
  p_vance uuid := gen_random_uuid();
  p_brannigan uuid := gen_random_uuid();
begin
  insert into public.tournaments (id, name, venue, starts_on, ends_on)
  values (t, 'Autumn Club Championships — Demo', 'Fictional Lawn Tennis Club',
          current_date - 1, current_date + 2);

  insert into public.tournament_invites (tournament_id, code) values (t, 'AUTUMNDEMO');

  insert into public.players (id, tournament_id, name, seed) values
    (p_hale, t, 'Rowan Hale', 1),
    (p_rook, t, 'Callum Rook', null),
    (p_castell, t, 'Priya Castell', 4),
    (p_marwick, t, 'Elena Marwick', null),
    (p_okafor, t, 'Sasha Okafor', 2),
    (p_pell, t, 'Jonah Pell', null),
    (p_vance, t, 'Imogen Vance', 3),
    (p_brannigan, t, 'Theo Brannigan', null);

  insert into public.matches
    (tournament_id, round, court, scheduled_at, best_of, player_a_id, player_b_id, winner_id, result_sets)
  values
    (t, 'Quarter-final', 'Court 1', now() - interval '3 hours', 3, p_hale, p_rook,
       p_hale, '[{"a":6,"b":3},{"a":6,"b":4}]'),
    (t, 'Quarter-final', 'Court 2', now() - interval '170 minutes', 3, p_castell, p_marwick,
       p_castell, '[{"a":4,"b":6},{"a":7,"b":5},{"a":6,"b":2}]'),
    (t, 'Quarter-final', 'Court 1', now() - interval '25 minutes', 3, p_okafor, p_pell, null, null),
    (t, 'Quarter-final', 'Court 3', now() + interval '1 day', 3, p_vance, p_brannigan, null, null);
end $$;

-- To make yourself an organizer after joining (SQL editor only):
--   update public.tournament_members
--   set role = 'organizer'
--   where user_id = (select id from auth.users where email = 'you@example.com');
