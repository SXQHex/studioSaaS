create or replace function app_private.can_view_profile(p_profile uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
 select (select auth.uid()) is not null and (
 p_profile=(select auth.uid()) or app_private.is_appowner()
 or exists(select 1 from public.center_role_assignments a
    where a.profile_id=p_profile and app_private.can_manage_center(a.center_id))
 or exists(select 1 from public.members m
    where m.profile_id=p_profile and app_private.can_manage_center(m.center_id))
 )
$$;

create or replace function app_private.instructor_can_access_member_center(p_center_id uuid,p_member_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
 select (select auth.uid()) is not null and exists(
 select 1 from public.lessons l
 join public.lesson_staff_assignments a on a.lesson_id=l.id and a.center_id=l.center_id
 where l.center_id=p_center_id and a.profile_id=(select auth.uid())
 and l.status in ('scheduled','completed')
 and (l.private_member_id=p_member_id
 or exists(select 1 from public.lesson_enrollments e
    where e.lesson_id=l.id and e.center_id=l.center_id and e.member_id=p_member_id)
 or exists(select 1 from public.attendance att
    where att.lesson_id=l.id and att.center_id=l.center_id and att.member_id=p_member_id))
 )
$$;

revoke all on function app_private.can_view_profile(uuid) from public,anon;
revoke all on function app_private.instructor_can_access_member_center(uuid,uuid) from public,anon;
grant execute on function app_private.can_view_profile(uuid) to authenticated;
grant execute on function app_private.instructor_can_access_member_center(uuid,uuid) to authenticated;
