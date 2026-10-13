# Authentication and authorization target design

Decision (2026-10-13): **Multi-role RBAC + ABAC**. The current database still uses a single `profiles.role` enum; this decision is the target design and is **not** yet fully implemented. Do not represent the current three-role RLS policies as enforcing the six-role model.

Target roles: `appowner` (platform), `owner` (organization), `admin` (center), `instructor` (assigned lessons), `ainstructor` (assigned lessons, attendance only), `student` (own learning records). Roles may overlap for a single user and vary by organization, center and lesson. A staff member can also attend a lesson as a student.

RBAC determines allowed operations; ABAC evaluates attributes such as organization/center membership, lesson assignment, student enrollment, time window, lesson state and resource ownership. Evaluate the conditions in database RLS policies and trusted server actions. Registration never accepts privileged roles from user-submitted metadata. Migrate `profiles.role` to scoped role assignments in a separately tested schema change, rather than adding the new roles to the single-valued enum prematurely.

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
2. **Not yet active authorization:** Existing `profiles.role`, `center_admins`, `lessons.instructor_id` and corresponding RLS remain in effect. New relationship tables grant authenticated users only self-read, with no client mutation privileges. Do not use them to grant production privileges before backfill and policy cutover.
3. Next stage: test scope integrity (same organization/center across assignments and enrollment), backfill historical administrator/instructor relationships, migrate server session and pages to multi-context role resolution, implement deny-by-default RLS for all affected CRUD operations, and add negative cross-center/cross-organization tests. Then remove the legacy single-role field only when no application code relies on it.
4. Privileged role assignment must be performed by vetted server/database flows. Do not infer or grant `appowner`, `owner`, `admin`, `instructor` or `ainstructor` from user-editable Auth metadata.

## Persistent development test accounts (2026-10-13)

The FTK Studio / Merkez development identities are `owner@ftk.com` (organization owner), `admin@ftk.com` (center admin), `instructor@ftk.com` (center instructor), and `asist@ftk.com` (center assistant instructor). They were created and email-confirmed in Supabase Auth, with their scoped role assignments inserted into the foundation tables. Keep these four accounts available throughout development; do not delete them as part of test cleanup. No appowner role is assigned to these identities. Never document or commit their passwords. Their scoped permissions remain inactive for some application operations until the complete RLS/server-action cutover.
