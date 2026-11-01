# ClubPredict

A private tennis-tournament prediction app for club members: predict match winners and exact
set scores. Independent prototype; not affiliated with or endorsed by any club. All bundled
data (players, members, tournaments) is fictional.

## Modes

| Mode | When | Data |
| --- | --- | --- |
| **Demo only** | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` not set | Fictional, in-memory, resets on reload |
| **Accounts** | Both env vars set | Supabase Auth + Postgres with Row Level Security. "Explore the demo instead" remains available on the sign-in screen |

Scoring and the leaderboard are demo-only for now. Live tournaments save predictions but show
"Leaderboard not available yet".

## Quick start (demo)

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # all automated tests
npm run build      # type-check + production build
```

## Connecting Supabase

### 1. Create a project and set environment variables

In the Supabase dashboard open **Project Settings → API** and copy the **Project URL** and the
**anon public** key. Then:

```bash
cp .env.example .env.local   # .env.local is git-ignored
```

Fill in both values. **Never** use the `service_role` key here: anything prefixed `VITE_` is
bundled into the browser. The app needs only the anon key; Row Level Security does the
authorization.

### 2. Apply the migration

The schema is in `supabase/migrations/20261030120000_clubpredict_core.sql`. Use either option:

**Option A: SQL editor (no tools needed)**

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the whole migration file and click **Run**. It should finish without errors.
3. *(Development projects only)* Open a new query, paste `supabase/seed.sql` and run it. This
   creates a fictional tournament with invitation code **`AUTUMNDEMO`**.

**Option B: Supabase CLI**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Then run `supabase/seed.sql` in the SQL editor if you want demo data.

### 3. Configure Auth

Under **Authentication → URL Configuration**, set **Site URL** to where the app is served
(e.g. `http://localhost:5173` in development) and add it to **Redirect URLs**, because sign-up
confirmation emails link back there. Keep **Confirm email** enabled. The app tells new users to
check their inbox.

### 4. Try it

1. `npm run dev`, then **Create account**, confirm the email, and sign in.
2. Enter invitation code `AUTUMNDEMO`.
3. To make someone an organizer (they can then manage players, matches and results), run this
   in the SQL editor. There is deliberately no way to do it from the app:

   ```sql
   update public.tournament_members
   set role = 'organizer'
   where user_id = (select id from auth.users where email = 'organizer@example.com');
   ```

New tournaments and invitation codes are also created in the SQL editor for now (see
`supabase/seed.sql` for the shape).

## Security model

Enforced in the database, not just the UI:

- **RLS on every table**; the `anon` role has no table access.
- **Tournament data** (tournaments, players, matches, rosters) is visible only to members.
- **Invitation codes** live in `tournament_invites`, readable only by organizers. Joining goes
  through `join_tournament(invite_code)`, a `security definer` function that validates the
  code (active and unexpired) and always inserts `role = 'member'`.
- **No self-promotion**: `tournament_members` has no insert/update/delete grants for users.
- **Official results**: only organizers can insert/update matches, and a check constraint
  rejects impossible scores.
- **Predictions**: members can insert/update/delete only their own rows, only while the match
  is open (before `scheduled_at` by the *database* clock, with no result). A trigger re-checks
  the lock, validates the winner and set scores, and blocks moving a prediction to another
  match or member.
- **Hidden picks**: other members' predictions are readable only after the match locks.

Known limitations:

- Supabase's general API rate limits apply, but `join_tournament` has no dedicated attempt
  limit. Codes are 8–16 characters to make guessing impractical.
- Display names are visible to fellow members of a shared tournament.

## Tests

`npm test` runs everything below **locally, with no Supabase project needed**:

| File | Covers |
| --- | --- |
| `src/lib/*.test.ts` | Tennis score validation, match status, demo scoring |
| `src/auth/auth.test.ts` | Auth form validation, Supabase Auth error → message mapping |
| `src/data/data.test.ts` | DB row mapping, data-shape validation, error mapping, invite codes, Supabase repository against a stub client |
| `src/App.test.tsx` | Sign-in / sign-up / sign-out, session restore, demo fallback, joining by code, server rejections, live-mode UI |
| `src/TournamentApp.test.tsx` | Demo match list, predictions, locking, filters, navigation |
| `supabase/tests/policies.test.ts` | **The real migration** run in [PGlite](https://pglite.dev) (Postgres in WASM) with a minimal stub of Supabase's `auth` schema and roles. Checks RLS, grants, triggers and `join_tournament` by acting as different users |
| `supabase/tests/seed.test.ts` | The seed applies cleanly on top of the migration |

**Needs a configured Supabase project (manual for now):** real Supabase Auth behaviour (email
confirmation, password policy, rate limits, token refresh) and PostgREST end to end. After
applying the migration, check:

1. Sign up → confirmation email → sign in; reload keeps you signed in; sign out works.
2. Join with `AUTUMNDEMO`; a wrong code shows "not valid or has expired".
3. Predict the open match; edit it; reload, and it's still there.
4. As a second member, the first member's prediction on the open match is not returned by
   `select * from predictions` (run through the app's client or the REST API with that
   user's JWT, not the SQL editor, which bypasses RLS).
5. Make the match start (organizer edits `scheduled_at` to the past) and confirm edits are
   rejected with "predictions are locked".
