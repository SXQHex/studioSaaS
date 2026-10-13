# Recovery database rollout — 2026-10-14

Live project: ysplylnwdfwizmuxvcqg.

Applied live migration: **20261013231712 — roadmap_recovery_4_to_9_and_consistency**.

This migration atomically applies the following source files in order:

- supabase/migrations/20261013195811_group_programs.sql
- supabase/migrations/20261013200017_manual_collections.sql
- supabase/migrations/20261013200126_lesson_lifecycle.sql
- supabase/migrations/20261013200343_operational_notifications.sql
- supabase/migrations/20261013200515_marketing_crm.sql
- supabase/migrations/20261013200611_studio_reports.sql
- supabase/migrations/20261013201345_group_waitlist.sql
- supabase/migrations/20261013230735_recovery_consistency_fixes.sql

Historical live versions for scoped roles, panels, linking and requests differ from their repository timestamps. Existing history was preserved; no repair or baseline replay was performed. The local files remain the clean-database CI chain. Do not run db push on production until the live/source version map has been reconciled deliberately.

Verification after rollout: all nine new public tables exist with RLS; consume_lesson_credit and charge_lesson_member are not executable by anon/authenticated; studio-notifications is active on */15 * * * *; method and end-time notification fixes are present. Existing counts were preserved: 6 Auth users, 1 member, 1 subscription, 1 lesson, 1 credit transaction. No production test fixtures were added and no password was changed.

The clean isolated PostgreSQL contracts cover partial collections, refunds/reversals, participant-only credit use, absence and cancellation, makeup/reschedule, reminders and end-only changes, CRM role isolation, 1,003-row reports and waitlist capacity. CI repeats the full chain on Supabase PostgreSQL 17.

Real-session UI acceptance and email delivery remain deferred. Auth leaked-password protection cannot be changed through the currently exposed connector; review it in Authentication settings. SECURITY DEFINER RPCs retain scoped checks; btree_gist remains in public because its historical exclusion constraints are tied to the current schema.
