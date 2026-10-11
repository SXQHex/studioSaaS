# Pending operational checks

## Applied database changes

StudioSaaS has both production hardening migrations applied:
- `fix_group_lesson_visibility_for_open_ended_packages`: student SELECT policy accepts group packages with `ends_on IS NULL`; see [SQL](../supabase/migrations/20261010030941_fix_group_lesson_visibility_for_open_ended_packages.sql).
- `harden_attendance_and_credit_ledger_writes`: validates attendance lesson/member combinations in RLS, prevents attendance updates in favour of admin delete + validated re-insert, makes credit transactions append-only for authenticated clients, and rejects direct API updates to credit balances; see [SQL](../supabase/migrations/20261010032120_harden_attendance_and_credit_ledger_writes.sql).

Existing attendance has a unique index on `(lesson_id, member_id)`, and lesson credit consumption has a unique partial index on `(subscription_id, lesson_id)` for `lesson_use`, preserving idempotency.

## DNS and deployment

- Cloudflare DNS: `uye.fethiyetango.com CNAME ftksaasweb.netlify.app`, DNS-only, TTL Auto. The apex and `www` records still point at the existing public website.
- Netlify site `ftksaasweb` is connected to `SXQHex/ftk_saas_web`; confirm future production deploys report `ready`.
- Verify `https://uye.fethiyetango.com/api/health` in a browser when checking production.

## Supabase Auth: password recovery

Configure StudioSaaS under **Authentication → URL Configuration**:
- Site URL: `https://uye.fethiyetango.com`
- Redirect URLs includes `https://uye.fethiyetango.com/reset-password`.

Update **Authentication → Email Templates → Reset Password**. Use a link to the app's server-side verifier so recovery does not depend on a PKCE verifier stored in the browser that initiated the request:

```html
<h2>Şifrenizi sıfırlayın</h2>
<p>Yeni bir şifre belirlemek için aşağıdaki bağlantıyı açın.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Yeni şifre belirle</a></p>
<p>Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>
```

The app route `/auth/confirm` validates `token_hash` using Supabase SSR and writes the recovered session to cookies before redirecting to `/reset-password`. After saving the email template, request a **new** reset email and test the link in the same or a different browser; old links were generated using the previous template and may be single-use or expired.

## Remaining security checks

- The Supabase Security Advisor previously reported leaked-password protection disabled. Check StudioSaaS Authentication > Password/Security settings and enable it if available. Guide: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Confirm email verification and rate limits fit the intended account-provisioning policy. The owner account has the admin role, but email confirmation status should be checked before production use.

## Center-level isolation and room booking (pending)

The migrations `20261011190000_session_rooms_and_requests.sql` and
`20261011200000_center_level_tenancy.sql` are in the feature pull request and **have not been applied to production**.
Organizations group brands; the center is the data-isolation boundary. Before rollout, test with separate admin
accounts assigned to separate centers, instructors, and students. Review
[the rollout checklist](./center-level-isolation-and-room-rollout.md), assign rooms to upcoming legacy lessons,
and verify group-credit consumption cannot cross centers.

## Migration tracking

Three earlier StudioSaaS migrations were applied without saving their SQL. `supabase/schema/00_baseline_snapshot.sql` is a reconstruction of the live schema (including the two hardening migrations) and is the file to use for a fresh database; see [supabase/README.md](../supabase/README.md). Run `supabase db diff --linked` occasionally to confirm it still matches production.
