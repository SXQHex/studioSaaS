-- Keep lesson-instructor assignments in sync with the scheduling model.
create or replace function app_private.sync_lesson_staff()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
 if tg_op = 'UPDATE' and old.instructor_id is distinct from new.instructor_id
    and old.instructor_id is not null then
   delete from public.lesson_staff_assignments a
    where a.lesson_id=old.id and a.profile_id=old.instructor_id and a.role='instructor';
 end if;
 if new.instructor_id is not null then
   insert into public.lesson_staff_assignments(lesson_id,center_id,profile_id,role)
   values(new.id,new.center_id,new.instructor_id,'instructor')
   on conflict (lesson_id,profile_id,role) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function app_private.sync_lesson_staff() from public,anon,authenticated;
drop trigger if exists sync_lesson_staff on public.lessons;
create trigger sync_lesson_staff after insert or update of instructor_id on public.lessons
for each row execute function app_private.sync_lesson_staff();

-- Scoped role management is restricted to organizational owners and center managers.
create or replace function public.assign_center_role(p_center_id uuid,p_profile_id uuid,p_role text)
returns void language plpgsql security definer set search_path to ''
as $$
begin
 if p_role not in ('admin','instructor','ainstructor') or p_role is null then
   raise exception 'Unknown center role' using errcode='22023';
 end if;
 if not app_private.can_manage_center(p_center_id) then
   raise exception 'Not authorized for center' using errcode='42501';
 end if;
 if not exists(select 1 from public.profiles p where p.id=p_profile_id) then
   raise exception 'Profile not found' using errcode='22023';
 end if;
 insert into public.center_role_assignments(center_id,profile_id,role)
 values(p_center_id,p_profile_id,p_role) on conflict do nothing;
end;
$$;
revoke all on function public.assign_center_role(uuid,uuid,text) from public,anon;
grant execute on function public.assign_center_role(uuid,uuid,text) to authenticated;

create or replace function public.remove_center_role(p_center_id uuid,p_profile_id uuid,p_role text)
returns void language plpgsql security definer set search_path to ''
as $$
begin
 if p_role not in ('admin','instructor','ainstructor') or p_role is null then
   raise exception 'Unknown center role' using errcode='22023';
 end if;
 if not app_private.can_manage_center(p_center_id) then
   raise exception 'Not authorized for center' using errcode='42501';
 end if;
 if p_role='admin' and (select count(*) from public.center_role_assignments
   where center_id=p_center_id and role='admin') <= 1 then
   raise exception 'Cannot remove last center administrator' using errcode='23514';
 end if;
 delete from public.center_role_assignments
 where center_id=p_center_id and profile_id=p_profile_id and role=p_role;
end;
$$;
revoke all on function public.remove_center_role(uuid,uuid,text) from public,anon;
grant execute on function public.remove_center_role(uuid,uuid,text) to authenticated;
