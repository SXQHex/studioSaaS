-- Synthetic performance fixture: 50k members across 10 centers. Run only in an isolated DB.
-- Captures representative plans without modifying production data.
\set ON_ERROR_STOP on
\timing on
insert into public.organizations (id, name, slug)
values ('20000000-0000-0000-0000-000000000099', 'Synthetic Performance Org', 'synthetic-performance-org');
insert into public.centers (id, organization_id, name)
select ('30000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       '20000000-0000-0000-0000-000000000099'::uuid,
       'Synthetic Center ' || g
from generate_series(1, 10) as g;
insert into public.members (id, center_id, full_name, email, created_at, updated_at)
select ('40000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid,
       ('30000000-0000-0000-0000-' || lpad(((g - 1) % 10 + 1)::text, 12, '0'))::uuid,
       'Synthetic Member ' || g,
       'perf-' || g || '@example.invalid',
       now() - make_interval(secs => g),
       now() - make_interval(secs => g)
from generate_series(1, 50000) as g;
ANALYZE public.organizations;
ANALYZE public.centers;
ANALYZE public.members;

-- Center dashboard: newest members for a specific center.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
select id, full_name, created_at
from public.members
where center_id = '30000000-0000-0000-0000-000000000001'::uuid
order by created_at desc
limit 50;

-- Center-scoped member count: captures selectivity and row estimate quality.
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
select count(*)
from public.members
where center_id = '30000000-0000-0000-0000-000000000001'::uuid;
