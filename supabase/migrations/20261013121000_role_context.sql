create or replace function public.my_scoped_roles()
returns table(role text, scope_type text, scope_id uuid)
language sql stable security invoker set search_path to ''
as $$
 select p.role, 'platform'::text, null::uuid
 from public.platform_role_assignments p where p.profile_id=(select auth.uid())
 union all
 select o.role, 'organization'::text, o.organization_id
 from public.organization_role_assignments o where o.profile_id=(select auth.uid())
 union all
 select c.role, 'center'::text, c.center_id
 from public.center_role_assignments c where c.profile_id=(select auth.uid())
 union all
 select l.role, 'lesson'::text, l.lesson_id
 from public.lesson_staff_assignments l where l.profile_id=(select auth.uid())
$$;
revoke all on function public.my_scoped_roles() from public,anon;
grant execute on function public.my_scoped_roles() to authenticated;
