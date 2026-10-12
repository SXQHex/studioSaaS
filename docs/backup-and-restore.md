# Backup and restore runbook

**Status: isolated logical-dump restore drill is automated in CI; managed Supabase backup/PITR restoration is not evidenced by this drill.** Do not mark the managed-backup portion of T05 complete until the owner confirms the available recovery point and a separate backup restore passes.

## Recovery targets (proposed; owner confirmation required)

- Recovery Point Objective (RPO): 24 hours maximum data loss until the project plan/backup mode is verified.
- Recovery Time Objective (RTO): 4 hours to restore service.
- Backup owner: project owner; restore operator: project owner or an explicitly authorized database administrator.
- Retention: use the retention actually provided by the current Supabase plan and record it here after checking the Dashboard. Do not assume a paid-plan backup policy applies.

## Database backups

1. In Supabase Dashboard → Database → Backups, verify the latest successful backup, the available retention window, and whether Point-in-Time Recovery (PITR) is enabled. Record the observation date and available restore range without including credentials.
2. If daily managed backups are not included in the plan, schedule an encrypted logical export using the Supabase CLI/`pg_dump` from a controlled operator environment. Store it outside the project in access-controlled storage; do not commit dumps to Git.
3. Keep the schema-only baseline in Git as a reproducible starting point, but do not treat it as a data backup.
4. Before production DDL, confirm that a usable database backup or isolated clone exists and document the exact recovery point and rollback decision-maker.

Official guidance: https://supabase.com/docs/guides/platform/backups

## Storage and other platform configuration

Database backups do **not** include file objects uploaded through the Supabase Storage API. Back up required Storage objects separately using the dashboard or Storage/S3-compatible API, preserving object paths and metadata. Also document Auth URL configuration, email templates, rate limits, Edge Function source/configuration, secrets (in a secret manager only), and any external integrations; these are not all restored by a database dump.

## Isolated restore drill

The CI drill creates a custom-format `pg_dump` from an isolated Supabase database containing synthetic records, restores it into a second database, and verifies that all 50,000 synthetic members and 10 centers survived. This validates the logical dump/restore path only; it does not prove that a managed production backup, Storage objects, Auth settings, or Edge Functions can be restored. Record the workflow run URL and timings here after the run succeeds.

1. Create/use a separate test project or isolated database; never restore over production for a drill.
2. Restore the selected managed backup or logical export. If using a project clone, separately configure Auth, Storage, extensions, and Edge Functions as required.
3. Apply the baseline only when creating a new database from schema SQL; do not apply it on top of a restored database.
4. Run schema checks, Security Advisor, app lint/typecheck/tests/build, and smoke tests against the isolated restore.
5. Verify sign-in, representative center-scoped reads, lesson/attendance behavior, credit-ledger consistency, and access isolation using synthetic test users.
6. Record backup timestamp, restore start/end, validation results, gaps, and operator. Delete the temporary restore only after evidence is captured and data retention policy permits it.

## Rollback decision

Application rollback and database restore are separate actions. Revert the application deployment first only if the code change is the cause and the schema remains backward compatible. Restore the database only when data/schema corruption or an irreversible database change requires it; choose the recovery point with the owner and account for loss of later writes. Re-check Storage separately.
