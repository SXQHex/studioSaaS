-- Activate deny-by-default ABAC on application resources.
-- Keep student subscription visibility, but remove all global profiles.role permissions.
drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_scoped_read on public.profiles for select to authenticated
 using (app_private.can_view_profile(id));

drop policy if exists organizations_admin_manage on public.organizations;
drop policy if exists organizations_staff_read on public.organizations;
create policy organizations_scoped_read on public.organizations for select to authenticated
 using (app_private.is_org_owner(id) or exists(
   select 1 from public.centers c join public.center_role_assignments r on r.center_id=c.id
   where c.organization_id=organizations.id and r.profile_id=(select auth.uid())
 ));
create policy organizations_owner_update on public.organizations for update to authenticated
 using (app_private.is_org_owner(id)) with check (app_private.is_org_owner(id));
create policy organizations_platform_insert on public.organizations for insert to authenticated
 with check (app_private.is_appowner());

drop policy if exists rooms_admin_manage on public.rooms;
drop policy if exists rooms_staff_read on public.rooms;
create policy rooms_scoped_read on public.rooms for select to authenticated
 using (app_private.can_manage_center(center_id)
 or app_private.has_center_role(center_id,'instructor')
 or app_private.has_center_role(center_id,'ainstructor'));
create policy rooms_manager_insert on public.rooms for insert to authenticated
 with check (app_private.can_manage_center(center_id));
create policy rooms_manager_update on public.rooms for update to authenticated
 using (app_private.can_manage_center(center_id)) with check (app_private.can_manage_center(center_id));
create policy rooms_manager_delete on public.rooms for delete to authenticated
 using (app_private.can_manage_center(center_id));

drop policy if exists members_admin_manage on public.members;
drop policy if exists members_read_own_or_assigned_session on public.members;
create policy members_scoped_read on public.members for select to authenticated
 using (profile_id=(select auth.uid())
 or app_private.can_manage_center(center_id)
 or app_private.instructor_can_access_member_center(center_id,id));
create policy members_manager_insert on public.members for insert to authenticated
 with check (app_private.can_manage_center(center_id));
create policy members_manager_update on public.members for update to authenticated
 using (app_private.can_manage_center(center_id)) with check (app_private.can_manage_center(center_id));
create policy members_manager_delete on public.members for delete to authenticated
 using (app_private.can_manage_center(center_id));

drop policy if exists lessons_admin_manage on public.lessons;
drop policy if exists lessons_read_assigned_or_own on public.lessons;
create policy lessons_scoped_read on public.lessons for select to authenticated
 using (app_private.can_manage_center(center_id)
 or app_private.is_assigned_staff(id)
 or private_member_id in (select m.id from public.members m
   where m.profile_id=(select auth.uid()) and m.center_id=lessons.center_id)
 or exists (select 1 from public.lesson_enrollments e
   join public.members m on m.id=e.member_id and m.center_id=e.center_id
   where e.lesson_id=lessons.id and m.profile_id=(select auth.uid()))
 or (type='group'::public.lesson_type and exists (
   select 1 from public.subscriptions s join public.members m
     on m.id=s.member_id and m.center_id=s.center_id
   where s.center_id=lessons.center_id and m.profile_id=(select auth.uid())
     and s.type='group_4_weeks'::public.subscription_type
     and s.status='active'::public.subscription_status
     and s.starts_on <= (lessons.starts_at at time zone 'Europe/Istanbul')::date
     and (s.ends_on is null or s.ends_on >= (lessons.starts_at at time zone 'Europe/Istanbul')::date)
 )));
create policy lessons_manager_insert on public.lessons for insert to authenticated
 with check (app_private.can_manage_center(center_id));
create policy lessons_manager_update on public.lessons for update to authenticated
 using (app_private.can_manage_center(center_id)) with check (app_private.can_manage_center(center_id));
create policy lessons_manager_delete on public.lessons for delete to authenticated
 using (app_private.can_manage_center(center_id));

drop policy if exists attendance_admin_delete_center on public.attendance;
drop policy if exists attendance_insert_assigned_session on public.attendance;
drop policy if exists attendance_read_center_or_own on public.attendance;
create policy attendance_scoped_read on public.attendance for select to authenticated
 using (app_private.can_manage_center(center_id) or app_private.is_assigned_staff(lesson_id)
 or exists(select 1 from public.members m where m.id=member_id and m.profile_id=(select auth.uid())));
create policy attendance_scoped_insert on public.attendance for insert to authenticated
 with check ((app_private.can_manage_center(center_id) or app_private.is_assigned_staff(lesson_id))
 and exists(select 1 from public.lessons l where l.id=lesson_id and l.center_id=attendance.center_id
 and l.status not in ('cancelled','postponed')
 and (l.type='group' or (l.type='private' and l.private_member_id=attendance.member_id))));
create policy attendance_manager_delete on public.attendance for delete to authenticated
 using (app_private.can_manage_center(center_id));

drop policy if exists subscriptions_admin_manage on public.subscriptions;
drop policy if exists subscriptions_read_own_or_assigned_session on public.subscriptions;
create policy subscriptions_scoped_read on public.subscriptions for select to authenticated
 using (app_private.can_manage_center(center_id)
 or exists(select 1 from public.members m where m.id=member_id and m.profile_id=(select auth.uid()))
 or (app_private.has_center_role(center_id,'instructor') and app_private.instructor_can_access_member_center(center_id,member_id)));
create policy subscriptions_manager_insert on public.subscriptions for insert to authenticated
 with check (app_private.can_manage_center(center_id));
create policy subscriptions_manager_update on public.subscriptions for update to authenticated
 using (app_private.can_manage_center(center_id)) with check (app_private.can_manage_center(center_id));
create policy subscriptions_manager_delete on public.subscriptions for delete to authenticated
 using (app_private.can_manage_center(center_id));

drop policy if exists credit_transactions_admin_insert_center on public.credit_transactions;
drop policy if exists credit_transactions_read_center_or_own on public.credit_transactions;
create policy credit_transactions_scoped_read on public.credit_transactions for select to authenticated
 using (app_private.can_manage_center(center_id)
 or exists(select 1 from public.members m where m.id=member_id and m.profile_id=(select auth.uid()))
 or (lesson_id is not null and app_private.has_center_role(center_id,'instructor') and app_private.is_assigned_staff(lesson_id)));
create policy credit_transactions_manager_insert on public.credit_transactions for insert to authenticated
 with check (app_private.can_manage_center(center_id)
 and reason in ('admin_adjustment','refund')
 and exists(select 1 from public.subscriptions s
 where s.id=subscription_id and s.member_id=credit_transactions.member_id
 and s.center_id=credit_transactions.center_id));

drop policy if exists session_requests_admin_review_center on public.session_requests;
drop policy if exists session_requests_read_center_or_own on public.session_requests;
create policy session_requests_scoped_read on public.session_requests for select to authenticated
 using (requested_by=(select auth.uid()) or instructor_id=(select auth.uid())
 or app_private.can_manage_center(center_id));
create policy session_requests_manager_review on public.session_requests for update to authenticated
 using (app_private.can_manage_center(center_id))
 with check (app_private.can_manage_center(center_id));
