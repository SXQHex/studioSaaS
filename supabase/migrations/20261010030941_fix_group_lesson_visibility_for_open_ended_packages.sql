-- Applied in StudioSaaS (ysplylnwdfwizmuxvcqg) as migration
-- 20261010030941_fix_group_lesson_visibility_for_open_ended_packages.
-- Group subscriptions intentionally have ends_on = NULL and remain valid
-- until credits are exhausted; student SELECT access must not require an end date.

drop policy if exists lessons_staff_all_student_own on public.lessons;

create policy lessons_staff_all_student_own
on public.lessons
for select
to authenticated
using (
  (select app_private.current_role()) = any (array['admin'::app_role, 'instructor'::app_role])
  or private_member_id in (
    select m.id
    from public.members as m
    where m.profile_id = (select auth.uid())
  )
  or (
    type = 'group'::lesson_type
    and exists (
      select 1
      from public.subscriptions as s
      join public.members as m on m.id = s.member_id
      where m.profile_id = (select auth.uid())
        and s.type = 'group_4_weeks'::subscription_type
        and s.status = 'active'::subscription_status
        and s.starts_on <= (lessons.starts_at at time zone 'Europe/Istanbul')::date
        and (
          s.ends_on is null
          or s.ends_on >= (lessons.starts_at at time zone 'Europe/Istanbul')::date
        )
    )
  )
);
