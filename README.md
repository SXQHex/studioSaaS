# FTK SaaS Web

Next.js frontend for the dance-school management app. Supabase is the authentication and data backend.

## Runtime

- Next.js: `16.4.0`
- Node.js: `26.x` (pinned via `.nvmrc` and enforced by `package.json`)

## Local development

1. Install Node.js 26.x and pnpm (or npm).
2. Copy `.env.example` to `.env.local` and set the Supabase project URL and **publishable** key.
3. Install dependencies with `pnpm install` (or `npm install`).
4. Run `pnpm dev` (or `npm run dev`).
5. Run `npm run lint` to check JavaScript and TypeScript with Biome.

## Project structure

```
app/
  dashboard/
    layout.tsx            session lookup + shell
    page.tsx              role-based overview (student view in _components/)
    (staff)/              admin + instructor pages (route group, URLs unchanged)
      members | lessons | attendance | subscriptions | credits
lib/
  supabase/               typed clients, cached session (getSession), requireRole
  validation/             zod schemas shared by Server Actions and tests
  actions/                Server Actions: every write goes through here
  data/                   typed read queries with server-side search + pagination
components/               shared UI pieces (filters, pagination, notices, action hook)
supabase/                 schema snapshot and migrations (center-level isolation and room booking)
tests/                    unit tests (npm test)
```

Data flow: pages read through `lib/data`, forms call Server Actions in `lib/actions`, which validate with
`lib/validation`, re-check the role with `requireRole`, and then write through the user's own Supabase session so
RLS still applies. `created_by` / `checked_in_by` always come from the session, never from the browser.

## Scripts

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Admin setup

See [docs/initial-admin-setup.md](docs/initial-admin-setup.md) to securely promote the intended owner profile through the Supabase SQL Editor. Public sign-up remains `student` by default.

## Application modules

- Dashboard overview
- Center-scoped member list, edit and active/inactive status (admin)
- Center-scoped lesson planning and status controls (admin); instructors submit non-blocking room/session requests for manager approval
- Attendance entry (admin/instructor); credit consumption runs through database triggers
- Subscriptions and payment status (admin)
- Credit transaction ledger and audited manual adjustments (admin)

## Security

- Never put a Supabase `service_role`/secret key in frontend environment variables.
- Database access must be protected by Supabase RLS policies.
- Production responses include browser security headers; authenticated routes are not indexed.
- CI runs a high-severity dependency audit, Biome lint, a production build and an HTTP health smoke test.
- Public signup must never grant the `admin` role. Role assignment belongs to trusted server-side/database logic.

## Deployment

Import this repository as a **new Netlify site** and configure the environment variables listed in `.env.example`. Do not attach this repository to the existing `fethiyetango.netlify.app` marketing site. Netlify is pinned to Node.js 26 in `netlify.toml`. Let Netlify use its Next.js runtime/adapter; do not configure a static-only export.

For the custom domain and Auth callback allowlist, follow [docs/production-deployment.md](docs/production-deployment.md).
