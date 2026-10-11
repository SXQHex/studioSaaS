# Production deployment checklist

Production app origin: `https://uye.fethiyetango.com`.
Netlify site provided for this app: `https://ftksaasweb.netlify.app`.

## 1. Verify the Netlify production site

In Netlify, open the site whose production URL is `ftksaasweb.netlify.app` and verify:
- It is connected to the private GitHub repository `SXQHex/ftk_saas_web`.
- Production branch is `main`.
- The latest production deploy uses commit `fb8f2f2b0c22f01e07e103973ba67d9c20d9a299` or newer.
- Build settings use `npm run build`; Node.js is pinned to 26 in `netlify.toml`; do not set a static publish directory.
- Configure these production environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL=https://ysplylnwdfwizmuxvcqg.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the StudioSaaS publishable key.

Never put a `service_role`/secret key in browser-visible or `NEXT_PUBLIC_*` variables. Save the variables, trigger a new production deploy, and wait for it to succeed.

## 2. Attach the custom domain in Netlify

In the Netlify site's domain settings, add and verify `uye.fethiyetango.com`. The Cloudflare DNS record has already been created:
- Type: `CNAME`
- Name: `uye.fethiyetango.com`
- Target: `ftksaasweb.netlify.app`
- Proxy status: **DNS only** (grey cloud)
- TTL: Auto

Do not alter the existing apex or `www` DNS records; they serve the public website. Netlify must be told to accept the custom domain and issue its TLS certificate. Once Netlify reports HTTPS is ready, check:
- `https://ftksaasweb.netlify.app/api/health`
- `https://uye.fethiyetango.com/api/health`

Expected response: `{"status":"ok","service":"ftk-saas-web"}`. The external web checker available in this workspace could not fetch the Netlify endpoints, so the published site's live health response has not been independently verified here.

## 3. Supabase Auth configuration

In the **StudioSaaS** project, open Authentication > URL Configuration:
- Site URL: `https://uye.fethiyetango.com`
- Redirect URL allowlist includes `https://uye.fethiyetango.com/reset-password`.
- Add `http://localhost:3000/reset-password` only if local development is required.
- Add specific preview callback URLs temporarily for testing; do not add broad wildcard production entries.

The Security Advisor currently reports leaked-password protection disabled. Enable it under Authentication > Password/Security settings before inviting operational users: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection. Confirm email verification and rate limits match the intended account-provisioning policy.

## 4. Activate the owner account

Read [initial-admin-setup.md](initial-admin-setup.md). The existing profile is still assigned the `student` role. Promote only the verified studio-owner profile to `admin` using the trusted procedure in the Supabase SQL Editor; never set an admin role from browser code or sign-up metadata.

## 5. Production smoke tests

After the custom domain responds with valid HTTPS:
1. Sign in as the verified owner and confirm admin navigation.
2. Test creating a member, subscription, lesson and attendance record.
3. Check the credit ledger and remaining balance; confirm cancelled/postponed lessons do not consume credits and duplicate attendance cannot consume credits twice.
4. Test password recovery end-to-end from `uye.fethiyetango.com`.
5. Test student and instructor restrictions, including denied admin writes.
6. Only begin day-to-day use after Auth configuration and the above checks pass.

## Deployment limits

GitHub Actions validates dependency audit, lint, production build and an HTTP health smoke test. A direct Netlify management connection is not exposed in the current tool session, so the repo association, environment variables, custom-domain attachment and certificate state must be verified inside Netlify. Cloudflare DNS for the `uye` hostname is configured; the main website records remain unchanged.
