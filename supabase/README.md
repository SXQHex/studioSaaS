# Supabase database files

| Path | What it is |
| --- | --- |
| `schema/00_baseline_snapshot.sql` | Reconstructed baseline plus the two production hardening migrations listed in its header. **It does not include the newer room-booking and center-isolation migrations below.** |
| `migrations/20261010030941_…sql` and `20261010032120_…sql` | Production hardening migrations; their effects are reflected in the baseline snapshot. |
| `migrations/20261011190000_session_rooms_and_requests.sql` | Adds organizations, centers, rooms and manager-approved session requests. Not yet applied to production. |
| `migrations/20261011200000_center_level_tenancy.sql` | Makes **center** the data-isolation boundary, scopes RLS, and fixes cross-center credit consumption. Not yet applied to production. |
| `migrations/20261011210000_complete_center_isolation.sql` | Tightens instructor member access to scheduled/completed assigned sessions; a pending request no longer grants member-data access. Not yet applied to production. |

## Working with the database

- Make schema changes as new files in `migrations/` named `<timestamp>_<description>.sql`, test them
  on a Supabase branch, then apply them to production.
- After every DDL change, test against a Supabase branch, re-check the Security and Performance advisors, and regenerate the types:

  ```bash
  npx supabase gen types typescript --project-id ysplylnwdfwizmuxvcqg > lib/supabase/database.types.ts
  ```

- To confirm the snapshot still matches production, run `supabase db diff --linked` (needs the Supabase CLI
  and a linked project). Any output means the snapshot has drifted and should be refreshed.

## Why a snapshot instead of the original migrations

Three early migrations (`mvp_school_membership_attendance`, `remove_group_28_day_expiry`,
`respect_cancelled_group_lessons`) were applied from the SQL editor and their SQL was never saved. Only their
names are recorded in `supabase_migrations`. The snapshot captures their combined, current result.
