drop policy if exists centers_admin_manage on public.centers;
drop policy if exists centers_staff_read on public.centers;
create policy centers_scoped_read on public.centers
 for select to authenticated using (
   app_private.is_org_owner(organization_id)
   or app_private.is_center_admin(id)
   or app_private.has_center_role(id,'instructor')
   or app_private.has_center_role(id,'ainstructor')
 );
create policy centers_owner_update on public.centers
 for update to authenticated
 using (app_private.is_org_owner(organization_id))
 with check (app_private.is_org_owner(organization_id));
