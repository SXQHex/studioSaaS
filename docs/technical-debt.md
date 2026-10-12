# Technical debt and quality baseline

Measured on 2026-10-12 in an isolated checkout using Node 26.11.1 and the committed lockfiles.

## Automated checks

- `npm audit --audit-level=high`: passed; 0 reported vulnerabilities.
- `npm run lint`: exits successfully; 0 errors, 16 warnings, 20 informational diagnostics across 72 files.
- `npm run typecheck`: passed after regenerating database types from the current StudioSaaS schema and correcting RPC nullable argument types.
- `npm test`: passed, 43 tests across 7 files.
- `npm run build`: passed.
- Clean Supabase baseline + SQL privilege test: configured in GitHub Actions, but not executed in this sandbox because Docker and `psql` are unavailable here. CI evidence is still required.

## Lint backlog

| Rule | Count | Priority | Action |
|---|---:|---|---|
| `lint/style/useTemplate` | 20 informational | P2 | Convert concatenation only when the containing component is next touched; avoid unrelated UI rewrites. |
| `lint/style/noDescendingSpecificity` | 9 warnings | P2 | Review CSS selector ordering and specificity; visually verify affected components before rearranging rules. |
| `lint/complexity/noImportantStyles` | 6 warnings | P2 | Review `!important` declarations in context; remove only after confirming the intended cascade. |
| `lint/complexity/useOptionalChain` | 1 warning | P2 | Replace the redundant null check with optional chaining after behavior tests. |

Warnings are currently non-blocking because Biome exits zero. CI should continue to run lint, and the backlog should be reduced without broad formatting or visual changes that are unrelated to a measured issue.

## Explicitly deferred pending evidence

- Performance Advisor findings (22 unindexed foreign-key relationships, 18 unused-at-capture indexes, 6 tables with multiple permissive SELECT policies) need representative data and `EXPLAIN (ANALYZE, BUFFERS)` before index/policy changes.
- UX/accessibility review requires browser-based mobile/desktop checks and keyboard/contrast/focus/error-state verification. This checkout did not have a browser runtime.
- Full authorization E2E matrix (anon, unauthorised authenticated, second center, assigned/unassigned instructor, concurrent duplicate attendance) must run against an isolated Supabase database with synthetic fixtures; static contract tests are not equivalent to that matrix.
- Leaked-password protection is a Supabase Auth dashboard setting and remains a manual operational action; no Auth configuration was changed in this work.
