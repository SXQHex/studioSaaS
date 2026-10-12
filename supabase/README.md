# Supabase database files

| Path | Purpose |
| --- | --- |
| `schema/00_baseline_snapshot.sql` | Schema-only reconstruction of the current StudioSaaS database: center tenancy, rooms/session requests, notifications, constraints, indexes, functions, triggers, and RLS. No user or tenant rows are seeded. Run only against a fresh isolated Supabase database. |
| `migrations/20261012180000_harden_internal_function_privileges.sql` | Forward-only hardening for `app_private` function execution privileges. Test against an isolated database and review the restore plan before applying to production. |

## Working with the database

- The baseline represents the live schema observed on 2026-10-12. It folds the schema effects of older SQL changes into one reproducible file because three early changes were applied through SQL Editor and their original SQL was not retained.
- Historical migration files have been removed from the working tree after consolidation into the baseline. The production `supabase_migrations.schema_migrations` history remains unchanged. Do not assume a clean `supabase migration list` or run `supabase db push` against production until local/remote migration history has been explicitly reconciled.
- For a fresh database, start an isolated Supabase instance, apply `schema/00_baseline_snapshot.sql`, then apply the forward-only migrations in `migrations/` in timestamp order. Do not apply the baseline to an existing database.
- For a production schema change, first create and verify a backup/restore path, test the SQL against an isolated branch or clone, review the diff and advisor output, and apply only the narrowly scoped migration. Never use the baseline as a production migration.
- After DDL changes, run Supabase Security and Performance Advisors and regenerate `lib/supabase/database.types.ts`. Nullable RPC arguments are manually widened in the generated type where the SQL function intentionally accepts `NULL`; preserve these annotations when regenerating.
- Do not put API keys, passwords, access tokens, production user records, or tenant seed rows in SQL files.

## Live migration history

The connected StudioSaaS project reported these applied versions on 2026-10-12: `20261009135234`, `20261009135835`, `20261009135855`, `20261010030941`, `20261010032120`, `20261011213919`, `20261011213924`, `20261011213930`, `20261012033035`, `20261012033207`, `20261012033310`, and `20261012034617`. Some names/timestamps differ from the historical source filenames that were consolidated; do not rewrite the remote history to match local names.
