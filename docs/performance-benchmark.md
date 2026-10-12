# Representative query-plan benchmark

**Environment:** isolated Supabase local stack, PostgreSQL 17.11, 50,000 synthetic `public.members` rows split evenly across 10 synthetic centers. No production rows were added or changed. The script is `supabase/tests/performance_explain.sql`; it runs `ANALYZE` and `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)`.

## Results

| Query pattern | Plan | Planning time | Execution time | Actual rows | Buffer observations |
|---|---|---:|---:|---:|---|
| Latest 50 members for one center | `Index Scan using members_center_idx` | 0.182 ms | 0.051 ms | 50 | 12 shared buffer hits |
| Count members for one center | `Bitmap Heap Scan` + `Bitmap Index Scan using members_center_idx` | 0.068 ms | 1.775 ms | 5,000 | 908 shared hits: 862 heap blocks and 46 index hits |

The count plan estimated 4,975 rows and returned 5,000 (about 0.5% estimate error). The existing `(center_id, created_at DESC)` index served both center-scoped patterns. These are one-run synthetic measurements in a warm local database, not production latency/SLO measurements.

## Decision

- Keep `members_center_idx`; these query patterns are already index-backed.
- Do not remove the 18 indexes reported unused by the Performance Advisor based on this benchmark; advisor usage counts are workload-dependent.
- The 22 reported unindexed foreign-key relationships still need query-specific review against representative child-table joins/deletes before adding indexes. This benchmark does not justify blanket index changes.
- Capture additional plans for subscriptions, attendance, credit transactions, and lesson scheduling before making index changes for those workflows.
