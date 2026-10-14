# Authentication and authorization target design

Current implementation (verified 2026-10-14): **Multi-role RBAC + ABAC is active** in scoped assignment tables, session role resolution, RLS and RPC authorization. The legacy profiles.role remains a compatibility field; it is not the source of staff privileges.

Target roles: `appowner` (platform), `owner` (organization), `admin` (center), `instructor` (assigned lessons), `ainstructor` (assigned lessons, attendance only), `student` (own learning records). Roles may overlap for a single user and vary by organization, center and lesson. A staff member can also attend a lesson as a student.

RBAC determines allowed operations; ABAC evaluates attributes such as organization/center membership, lesson assignment, student enrollment, time window, lesson state and resource ownership. Evaluate the conditions in database RLS policies and trusted server actions. Registration never accepts privileged roles from user-submitted metadata. Staff privileges now come from scoped role assignments rather than the legacy single-role enum.

## Public registration

- `/register` uses Supabase Auth `signUp`, collects full name, email and password, and sends an email confirmation link to `/confirm`.
- The existing trusted `app_private.handle_new_user` trigger creates a `profiles` row with `student` role. Neither a user-chosen role nor center membership is assigned at registration.
- `/login` links to `/register`. `/confirm` supports both the email-signup callback and existing recovery verification.
- Configure Supabase Authentication: enable email signups and email confirmation; add `https://uye.fethiyetango.com/confirm` and (only for local testing) `http://localhost:3000/confirm` to the redirect URL allowlist. Configure and test SMTP delivery before public launch.
- Supabase's built-in Auth sign-up rate limits apply; configure CAPTCHA and stricter public abuse protection before opening signups at scale. Confirm whether public self-registration is allowed for the organization.
- Check registration/confirmation end-to-end on the deployed domain with a disposable email. Browser-only CI tests verify form validation and accessibility but cannot verify real email delivery without an Auth test environment.

## Next.js authentication route group

Authentication pages live in `app/(auth)/login`, `app/(auth)/register`, and `app/(auth)/reset-password`. The confirmation handler lives in `app/(auth)/confirm/route.ts`. The `(auth)` segment is a Next.js route group and does not appear in public URLs; existing `/login`, `/register`, `/reset-password`, and `/confirm` paths remain unchanged. `/reset-password` displays the password form, while `/confirm` verifies emailed tokens and redirects to the appropriate page. The login API remains `/api/auth/login`.

## Phased multi-role rollout (2026-10-13)

1. Additive schema foundation: `platform_role_assignments`, `organization_role_assignments`, `center_role_assignments`, `lesson_staff_assignments`, and `lesson_enrollments`. A person can hold multiple roles in different scopes and be enrolled in a lesson at the same time. The student context is derived from enrollment or the person's own profile.
2. **Active scoped authorization:** Backfill, RLS cutover, session role resolution and trusted role-management RPCs are implemented. Direct client writes to privileged assignment tables remain restricted.
3. Scope integrity, scoped role backfill, multi-context sessions and cross-center/cross-organization negative contracts are implemented. Real-session UI acceptance remains separately tracked. Retain the legacy single-role field until all compatibility consumers are removed.
4. Privileged role assignment must be performed by vetted server/database flows. Do not infer or grant `appowner`, `owner`, `admin`, `instructor` or `ainstructor` from user-editable Auth metadata.

## Persistent development test accounts (2026-10-13)

The FTK Studio / Merkez development identities are `owner@ftk.com` (organization owner), `admin@ftk.com` (center admin), `instructor@ftk.com` (center instructor), and `asist@ftk.com` (center assistant instructor). They were created and email-confirmed in Supabase Auth, with their scoped role assignments inserted into the foundation tables. Keep these four accounts available throughout development; do not delete them as part of test cleanup. No appowner role is assigned to these identities. Never document or commit their passwords. Their scoped permissions remain inactive for some application operations until the complete RLS/server-action cutover.
