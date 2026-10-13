create or replace function app_private.is_appowner()
returns boolean language sql stable security definer set search_path to ''
as $$
 select (select auth.uid()) is not null and exists(
 select 1 from public.platform_role_assignments a
 where a.profile_id=(select auth.uid()) and a.role='appowner')
$$;

create or replace function app_private.is_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
 select app_private.is_appowner() or exists(
 select 1 from public.organization_role_assignments a
 where a.organization_id=p_org and a.profile_id=(select auth.uid()) and a.role='owner')
$$;

create or replace function app_private.has_center_role(p_center uuid,p_role text)
returns boolean language sql stable security definer set search_path to ''
as $$
 select exists(select 1 from public.center_role_assignments a
 where a.center_id=p_center and a.profile_id=(select auth.uid()) and a.role=p_role)
$$;

create or replace function app_private.is_center_admin(p_center_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
 select app_private.is_appowner() or app_private.has_center_role(p_center_id,'admin')
$$;

create or replace function app_private.can_manage_center(p_center uuid)
returns boolean language sql stable security definer set search_path to ''
as $$
 select app_private.is_center_admin(p_center)
 or exists(select 1 from public.centers c
   where c.id=p_center and app_private.is_org_owner(c.organization_id))
$$;

revoke all on function app_private.is_appowner() from public,anon;
revoke all on function app_private.is_org_owner(uuid) from public,anon;
revoke all on function app_private.has_center_role(uuid,text) from public,anon;
revoke all on function app_private.is_center_admin(uuid) from public,anon;
revoke all on function app_private.can_manage_center(uuid) from public,anon;
grant execute on function app_private.is_appowner() to authenticated;
grant execute on function app_private.is_org_owner(uuid) to authenticated;
grant execute on function app_private.has_center_role(uuid,text) to authenticated;
grant execute on function app_private.is_center_admin(uuid) to authenticated;
grant execute on function app_private.can_manage_center(uuid) to authenticated;
