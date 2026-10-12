# Live schema inventory

**Source:** read-only catalog queries against Supabase project `ysplylnwdfwizmuxvcqg` on 2026-10-12. This file contains schema metadata only; it contains no row data or secrets.

## Public application schema

- Tables: 12
- Columns: 114
- Indexes: 46
- RLS policies: 23
- Non-internal triggers: 21
- Views/materialized views: 0
- Enums: 6
- Public tables with RLS disabled: 0

Tables: `attendance`, `center_admins`, `centers`, `credit_transactions`, `lessons`, `members`, `notifications`, `organizations`, `profiles`, `rooms`, `session_requests`, `subscriptions`.

Enums:

- `app_role`: `admin`, `instructor`, `student`
- `lesson_status`: `scheduled`, `completed`, `cancelled`, `postponed`
- `lesson_type`: `private`, `group`
- `payment_status`: `pending`, `paid`, `refunded`
- `subscription_status`: `active`, `expired`, `cancelled`
- `subscription_type`: `private_credits`, `group_4_weeks`

## Application-managed functions

The `app_private` schema contains 21 functions. SECURITY DEFINER functions use an empty `search_path`; the `public.rls_auto_enable` event-trigger function uses `pg_catalog`. The five public SECURITY DEFINER RPCs intended for signed-in callers are:

- `create_center(uuid, text, text)`
- `create_session_request(uuid, uuid, lesson_type, text, uuid, timestamptz, timestamptz, integer, text, uuid)`
- `grant_center_admin(uuid, uuid)`
- `list_requestable_members(uuid)`
- `revoke_center_admin(uuid, uuid)`

They deny `anon` execution and allow `authenticated` execution; their role/center checks must be retained and covered by tests. `review_session_request(uuid, boolean, text)` is SECURITY INVOKER and must remain protected by RLS/role checks.

The current catalog also reports internal `app_private` SECURITY DEFINER functions whose default `PUBLIC` execute grants make them executable by `anon`/`authenticated` where schema permissions permit. The forward-only migration `20261012180000_harden_internal_function_privileges.sql` revokes those grants and allows direct execution only for `current_role()`, `is_center_admin(uuid)`, and `instructor_can_access_member_center(uuid, uuid)`, which are used in RLS expressions.

## Extensions

Application-relevant extension observed: `btree_gist` 1.7 in `public`, required for exclusion constraints on room/instructor overlaps. Supabase platform-managed extensions observed separately: `pg_stat_statements` 1.11 in `extensions`, `pgcrypto` 1.3 in `extensions`, `uuid-ossp` 1.1 in `extensions`, `supabase_vault` 0.3.1 in `vault`, and built-in `plpgsql` 1.0 in `pg_catalog`. The baseline recreates the application-required extension; platform-managed extensions remain the responsibility of Supabase configuration.

## Advisor findings at capture time

Security Advisor:

- Five authenticated-callable public SECURITY DEFINER RPCs; the body of each must be reviewed for role and center checks.
- `btree_gist` installed in the exposed `public` schema (warning).

Performance Advisor:

- 22 foreign-key relationships without a covering index.
- 18 indexes with no observed usage at capture time.
- Six tables with multiple permissive SELECT policies.

These performance findings were recorded without automatic index or policy deletion. The project has little data and low observed workload, so `EXPLAIN (ANALYZE, BUFFERS)` results with representative data are still required before changing indexes.

## Baseline limitations

The SQL baseline represents the project-managed application schema and does not attempt to recreate Supabase-owned Auth, Storage, Vault, or event-trigger infrastructure. It is intended for a fresh Supabase database, not a generic bare PostgreSQL instance. A clean-database apply and catalog comparison must pass in CI before this baseline is treated as fully verified.
