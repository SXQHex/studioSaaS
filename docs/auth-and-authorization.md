# Authentication and authorization target design

Decision (2026-10-13): **Multi-role RBAC + ABAC**. The current database still uses a single `profiles.role` enum; this decision is the target design and is **not** yet fully implemented. Do not represent the current three-role RLS policies as enforcing the six-role model.

Target roles: `appowner` (platform), `owner` (organization), `admin` (center), `instructor` (assigned lessons), `ainstructor` (assigned lessons, attendance only), `student` (own learning records). Roles may overlap for a single user and vary by organization, center and lesson. A staff member can also attend a lesson as a student.

RBAC determines allowed operations; ABAC evaluates attributes such as organization/center membership, lesson assignment, student enrollment, time window, lesson state and resource ownership. Evaluate the conditions in database RLS policies and trusted server actions. Registration never accepts privileged roles from user-submitted metadata. Migrate `profiles.role` to scoped role assignments in a separately tested schema change, rather than adding the new roles to the single-valued enum prematurely.

## Public registration

- `/register` uses Supabase Auth `signUp`, collects full name, email and password, and sends an email confirmation link to `/auth/confirm`.
- The existing trusted `app_private.handle_new_user` trigger creates a `profiles` row with `student` role. Neither a user-chosen role nor center membership is assigned at registration.
- `/login` links to `/register`. `/auth/confirm` supports both the email-signup callback and existing recovery verification.
- Configure Supabase Authentication: enable email signups and email confirmation; add `https://uye.fethiyetango.com/auth/confirm` and (only for local testing) `http://localhost:3000/auth/confirm` to the redirect URL allowlist. Configure and test SMTP delivery before public launch.
- Supabase's built-in Auth sign-up rate limits apply; configure CAPTCHA and stricter public abuse protection before opening signups at scale. Confirm whether public self-registration is allowed for the organization.
- Check registration/confirmation end-to-end on the deployed domain with a disposable email. Browser-only CI tests verify form validation and accessibility but cannot verify real email delivery without an Auth test environment.

## Next.js authentication route group

Authentication pages live in `app/(auth)/login`, `app/(auth)/register`, and `app/(auth)/reset-password`. The confirmation handler lives in `app/(auth)/auth/confirm/route.ts`. The `(auth)` segment is a Next.js route group and does not appear in public URLs; existing `/login`, `/register`, `/reset-password`, and `/auth/confirm` paths remain unchanged. `/reset-password` displays the password form, while `/auth/confirm` verifies emailed tokens and redirects to the appropriate page. The login API remains `/api/auth/login`.
