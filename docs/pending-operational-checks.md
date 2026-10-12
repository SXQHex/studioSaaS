# Pending operational checks

This document records checks that still require dashboard access, isolated test accounts, or a measured restore run. A written procedure is not proof that a backup has been restored successfully.

## Live database state checked 2026-10-12

- Supabase project `StudioSaaS` (`ysplylnwdfwizmuxvcqg`) is `ACTIVE_HEALTHY` on PostgreSQL 17.11.
- Supabase reports 12 applied migration versions. The baseline snapshot was consolidated to represent the current schema; the live migration history was not modified.
- Center-level tenancy, room/session requests, complete center isolation, and notification migrations are present in the live migration history. Verify functional behavior in an isolated environment before relying on it operationally.
- Security Advisor findings are tracked in the hardening work: internal `app_private` SECURITY DEFINER execution privileges need tightening; five public SECURITY DEFINER RPCs are intentionally callable by authenticated users and perform role/center checks in their bodies; leaked-password protection is disabled.
- Performance Advisor reports 22 foreign-key relationships without covering indexes, 18 indexes with no observed usage, and six tables with multiple permissive SELECT policies. These are review items, not automatic index/policy deletion instructions.

## Auth configuration

In Supabase Dashboard → Authentication → URL Configuration, verify:

- Site URL is `https://uye.fethiyetango.com`.
- Redirect allowlist includes `https://uye.fethiyetango.com/reset-password`.
- Add `http://localhost:3000/reset-password` only for local development.
- Avoid broad wildcard production redirect URLs.

In Authentication → Password/Security settings, enable leaked-password protection and verify email confirmation/rate-limit settings against the account-provisioning policy. These dashboard settings have not been changed by the repository work.

## Deployment verification

- Netlify site: `ftksaasweb`; production URL: `https://ftksaasweb.netlify.app`; custom domain: `https://uye.fethiyetango.com`.
- Confirm the Netlify site is connected to `SXQHex/studioSaaS`, deploys from `main`, and uses Node 26. Confirm both `/api/health` endpoints return the expected service status.
- Verify production environment variables in Netlify without copying their values into GitHub or test output. The browser-facing app requires only the Supabase URL and publishable key.

## Center-isolation acceptance tests

Use two isolated test centers, separate admins, instructors, and students. Verify that cross-center reads/writes fail, an instructor cannot enumerate members merely by submitting a pending request, an instructor can access only members tied to assigned scheduled/completed sessions, room/instructor overlaps are rejected at approval, and duplicate attendance cannot double-consume credits. Do not create test users or rows in production for these checks.

## Migration/baseline tracking

`supabase/schema/00_baseline_snapshot.sql` is a schema-only reconstruction for new isolated databases. It intentionally excludes user, member, lesson, tenant, and secret data. The three earliest changes were applied in SQL Editor and their original SQL was not saved. The current live migration history remains remote state; before using `supabase db push`, reconcile local and remote history explicitly. Never run the baseline against production.
