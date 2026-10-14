# Production deployment — existing Vercel setup

The existing SXQHex/studioSaaS repository, Supabase project ysplylnwdfwizmuxvcqg and Vercel hosting are retained. Recovery work does not change deployment settings, DNS, domains or production branch. Node.js 24 is pinned in .nvmrc and package.json; the build command is npm run build.

## Configuration to verify at release

- Use the existing Vercel project and its configured production branch.
- Keep NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY scoped to the correct environment.
- Never expose service-role credentials in browser variables.
- Preserve the existing domain configuration. Earlier Netlify instructions were obsolete; do not follow them or change DNS based on them.
- Auth Site URL and exact /confirm and /reset-password redirect URLs must match the deployed origin.
- Real reset email delivery and authenticated end-to-end acceptance remain open.

## Recovery database rollout

See [recovery-database-rollout.md](recovery-database-rollout.md) for the live migration-to-source mapping. Do not replay historical local migrations on the live project: their original remote timestamps differ. The baseline is exclusively for fresh isolated databases.

## Release checks

Review the recovery pull request and its CI results before merging into the existing production branch. Verify /api/health, the panels, request workflow, manual collections and reports on the resulting Vercel deployment. A successful isolated build or SQL contract is not real-user acceptance.
