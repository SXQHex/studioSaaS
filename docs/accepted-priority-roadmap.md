# Accepted priority roadmap — implementation and validation
Date: 2026-10-14

Implemented:
- Full-snapshot operational table search, status filtering, sorting and 25-row pagination. Existing snapshot RPCs return all authorized rows; search is never restricted to the displayed page. Student/package/lesson/lead shortcuts retain identity. Existing student list has server pagination.
- Room/instructor weekly planning with center/resource working hours, closures and informational group drafts. Pending requests remain soft. Existing approval overlap safeguards plus a resource-availability trigger protect confirmed lessons.
- Durable transactional email outbox sourced atomically from notifications. Claims use leases and SKIP LOCKED; provider sends reuse stable idempotency keys. Five automatic attempts within 23 hours; bounded manager retry; sent/delivered/bounced/complained states. Signed provider webhooks record delivery/bounce/complaint events. A domain-restricted sending key and webhook signing key are held in Supabase Vault; only service_role can retrieve them. Existing full-access environment keys can optionally support receipt polling. Cron invokes the worker with a private random token; user invocation requires scoped manager access. The compatibility sender queues instead of duplicating sends.
- Self registration details, optional marketing preference, center-required documents/emergency contact, immutable policy publications and acceptance receipts. New policy publications require separate acceptance. Private PDF/JPEG/PNG uploads with scoped read/upload access; managers can see missing items and open authorized documents.
- Manager-only web form setup and server-mediated intake with field validation, honeypot, hourly form/IP/contact limits, duplicate lead matching and single initial task. Confirmed trial outcomes generate deduplicated follow-up tasks; manager task assignment supported. Inactivity is surfaced as a review list, never an automatic marketing send.
- Configurable package catalog for private/group credits and actual sale conditions; catalog archival preserves sold snapshots. Group credits are configurable through catalog. Scheduled freezes have count/day limits, no overlap, preserve original dates and produce an effective expiry. Credit selection, student display, reports and reminders use effective expiry.
- Equal-period collection/lead/completed-lesson attendance comparison, source cohorts, weekly attendance and actionable debt/renewal/inactivity/late-task lists. No unsupported campaign revenue attribution.
- Scoped progress pilot with level, skill, 1–5 rating, history and explicit student visibility.

Preserved: manual/nakit payment, existing repository/backend/Supabase/Vercel, no automatic private reservation, existing organization/center policies and the private-lesson 12-hour default. Free-plan leaked-password protection remains a documented plan limit, not a new issue.

Conditional: existing group waitlist retained. Event/ticket and guardian modules remain deferred until actual business use exists. SMS/WhatsApp also remain conditional.

Validation:
- 77 unit/SSR tests pass; TypeScript, lint (no errors; pre-existing/style warnings remain) and production build pass.
- Deno type checks pass for all four email/intake Edge Functions.
- Clean PostgreSQL reconstruction applies baseline plus all migrations. Existing roadmap/recovery/organization-policy SQL contracts and new priority roadmap contracts pass.
- New SQL coverage: private progress isolation, self-only acceptance, version retention, duplicate intake/task, trial dedupe, catalog six-credit group sale/retry, freeze overlap limits, cross-center planning rejection, closed-resource rejection, nonblocking group drafts, scoped analytics, email claim lease and event idempotency.
- Headless Chromium on a temporary QA route: global search/sort/pagination across 1,003 records, correct lead preselection, mobile width, no page errors. QA route removed before commit.
- Browser fixture validation and SQL contracts are separate evidence; this does not claim real-account end-to-end acceptance of every new workflow.

Operational follow-through:
- Populate actual center/resource hours, catalog products and approved policy texts through the new screens.
- Create public intake forms only when the intended center is ready.
- Pilot progress with a small instructor group; assess regular use before expanding.
- Real-recipient email delivery/retry and permanent-account signed-in acceptance require a controlled recipient/session; do not change persistent passwords or insert test records in production.

Live integration check: all forward migrations applied; email worker and intake/webhook Edge Functions active; domain-restricted sender and webhook signing secret provisioned into Vault. Unsigned worker/webhook requests return 401. These checks confirm configuration and authentication, not real mailbox acceptance.
