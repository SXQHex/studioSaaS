# DRY and simplicity cleanup

This change keeps the existing Next.js, Supabase and Vercel architecture.

## Behavior

- Attendance credit warnings and credit consumption use the same database selector. It checks the lesson date, package type, center, balance, freeze intervals and extended expiry.
- All lesson form conversions and event timestamps use Istanbul. Calendar day grouping also uses Istanbul calendar dates.
- New packages are sold through the catalog. Existing subscriptions remain readable and can still be activated, expired or cancelled. Payment changes remain in the manual ledger.
- Operations and roadmap lists use a scoped, parameterized database RPC with 25 rows per page. Search, filters and numeric sorting run before pagination. Form selectors have separate search and pagination; they no longer need all customer records in browser memory.
- Subscription totals aggregate in PostgreSQL and are not limited by the Data API's row cap. Subscription lists display extended expiry.
- Self registration loads only the signed-in user's linked membership records, acceptances and documents. Staff tables load separately through the paged API.

## Maintenance

- Form field rendering, payload conversion, action state, document opening, workspace date ranges and related-view invalidation each have one implementation.
- Workspace boundary schemas validate lists, planning and the nested previous-period report separately. Planning contracts live in `lib/workspace.ts` instead of a UI component.
- Current session-request actions no longer call the compatibility email endpoint. Notifications and outbox entries are already committed in the request transaction; the old endpoint remains available for older deployed clients.
- CI applies sorted migrations and invokes SQL tests at their historical schema checkpoints through `scripts/verify-database.mjs`. New migration files are discovered automatically.
- Hand-written source is formatted and checked in CI. Generated database types retain their generated formatting. Historical SQL is not rewritten.

## Verification and rollout

Local validation: unit tests, TypeScript, lint, formatting and production build. An isolated PostgreSQL/PGlite database applies the baseline and every forward migration, runs the existing SQL checkpoints and the new behavioral regression test. The new test covers all list projections, page boundaries, cross-center and student access, search beyond the first page, more than 1,000 subscriptions, freeze/extended expiry, and duplicate credit consumption.

The forward migration `20261014051755_dry_simplification.sql` must be deployed before the frontend that calls its RPCs. It adds read RPCs and an internal selector, replaces only the credit-charge selector implementation, and does not remove or rewrite existing records. Apply the normal production backup/advisor and migration-history process described in `supabase/README.md`; do not push the reconstructed baseline to production.

Browser tests remain in the existing CI Playwright job. No production deployment or production database migration is part of the local verification.
