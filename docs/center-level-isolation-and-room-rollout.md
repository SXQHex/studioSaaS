# Center-level isolation and room booking rollout

## Tenant boundary

Organizations represent brands or business groups. They are not security boundaries. A **center** is the data-isolation boundary; rooms belong to one center.

- Admins are assigned to centers through `center_admins`. The migration assigns existing admins to the existing data center to preserve access. Creating a center assigns its creator. A center manager can grant another admin access to that center.
- Members belong to exactly one center. Their subscriptions, attendance and credit ledger rows inherit and must match that center.
- Lessons belong to exactly one center. A room must belong to the same center, and a private lesson's member must also belong to that center.
- Instructors are not granted center-wide write access. They can read their assigned lessons and requests assigned to them, and may submit private-lesson requests. Managers create group-session proposals and assign the instructor. A small RPC returns only member IDs/names for the explicitly selected center to populate private-lesson requests.
- Pending requests do not reserve anything. The manager review function creates the scheduled lesson and marks the request approved in one transaction. Exclusion constraints prevent concurrent overlapping room or instructor reservations.
- Group-credit consumption is filtered by the completed lesson's center, preventing credits in one center from being consumed by a lesson in another.

## Migration sequence

1. Review and merge PR #2 (typed data layer, server actions, validation, paging and CI).
2. Review PR #3 and apply migrations to a Supabase branch or restored copy first:
   - `20261011190000_session_rooms_and_requests.sql`
   - `20261011200000_center_level_tenancy.sql`
   - `20261011210000_complete_center_isolation.sql`
3. Compare the resulting schema with `supabase/schema/00_baseline_snapshot.sql`, check migration history, and run Supabase security advisors.
4. Verify RLS with separate admin accounts assigned to different centers, instructors, and student accounts. Do not test only as the database owner/service role.
5. Only then schedule production migration with a backup and rollback plan.

## Existing data

Existing members, lessons, subscriptions, attendance and credit transactions are backfilled to one initial center. Existing lessons are **not automatically assigned to a room**: legacy lessons can have missing end times or overlapping times, so assigning them blindly could create false reservations or make the exclusion constraints fail. Before enabling room booking in production, review upcoming lessons and assign a center, room, end time, and attendee count. Until then, roomless legacy lessons will not reserve a room.

## Required checks

- Two admins assigned to different centers cannot read or mutate each other's members, subscriptions, lessons, attendance, credits, rooms, or requests.
- A student can only access their own member, subscriptions, attendance and credits in their center.
- An instructor cannot create a lesson directly, approve a request, or read other instructors' requests.
- A private request must name an active member in the requested center, linked to a scheduled/completed session assigned to that instructor, and always has one attendee.
- A pending request does not grant the instructor access to a member row or that member’s subscriptions/credits.
- A group request can specify a larger attendee count, but must fit the room capacity on both request and approval.
- Two overlapping requests may both remain pending. Approving one causes approval of an overlapping room or instructor request to fail without partially creating a lesson.
- A completed lesson in center A never consumes subscriptions from center B.
- Credit adjustment races and existing credit-ledger triggers should be tested with concurrent transactions.

The migrations are not applied to the live Supabase project by these pull requests. Unit tests that inspect the SQL security contract are not a substitute for running the migration on a Supabase branch and executing the two-center role matrix above.
