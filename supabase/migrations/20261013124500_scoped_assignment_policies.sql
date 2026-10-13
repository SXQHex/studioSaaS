-- All authorization predicates used by assignment-management policies are SECURITY DEFINER.
drop policy if exists center_roles_read_own on public.center_role_assignments;
create policy center_roles_read_scoped on public.center_role_assignments
 for select to authenticated
 using (profile_id=(select auth.uid()) or app_private.can_manage_center(center_id));
drop policy if exists organization_roles_read_own on public.organization_role_assignments;
create policy organization_roles_read_scoped on public.organization_role_assignments
 for select to authenticated
 using (profile_id=(select auth.uid()) or app_private.is_org_owner(organization_id));
drop policy if exists lesson_staff_read_own on public.lesson_staff_assignments;
create policy lesson_staff_read_scoped on public.lesson_staff_assignments
 for select to authenticated
 using (profile_id=(select auth.uid()) or app_private.can_manage_center(center_id));
grant select,insert,delete on public.lesson_staff_assignments to authenticated;
create policy lesson_staff_insert_manager on public.lesson_staff_assignments
 for insert to authenticated with check (app_private.can_manage_center(center_id));
create policy lesson_staff_delete_manager on public.lesson_staff_assignments
 for delete to authenticated using (app_private.can_manage_center(center_id));

drop policy if exists lesson_enrollments_read_own on public.lesson_enrollments;
create policy lesson_enrollments_read_scoped on public.lesson_enrollments
 for select to authenticated using (
 app_private.can_manage_center(center_id)
 or exists(select 1 from public.members m where m.id=member_id and m.profile_id=(select auth.uid()))
 );
grant select,insert,delete on public.lesson_enrollments to authenticated;
create policy lesson_enrollments_insert_manager on public.lesson_enrollments
 for insert to authenticated with check (app_private.can_manage_center(center_id));
create policy lesson_enrollments_delete_manager on public.lesson_enrollments
 for delete to authenticated using (app_private.can_manage_center(center_id));
