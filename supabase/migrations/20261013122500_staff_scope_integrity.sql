alter table public.lesson_staff_assignments add column if not exists center_id uuid;
update public.lesson_staff_assignments a set center_id=l.center_id
from public.lessons l where l.id=a.lesson_id and a.center_id is null;
alter table public.lesson_staff_assignments alter column center_id set not null;
alter table public.lesson_staff_assignments
 add constraint lesson_staff_lesson_center_fkey
 foreign key (lesson_id,center_id) references public.lessons(id,center_id) on delete cascade;
alter table public.lesson_staff_assignments
 add constraint lesson_staff_role_center_fkey
 foreign key (center_id,profile_id,role)
 references public.center_role_assignments(center_id,profile_id,role) on delete cascade;

create or replace function app_private.is_assigned_staff(p_lesson uuid)
returns boolean language sql stable security invoker set search_path to ''
as $$
 select exists(select 1 from public.lesson_staff_assignments a
 where a.lesson_id=p_lesson and a.profile_id=(select auth.uid())
 and a.role in ('instructor','ainstructor'))
$$;
revoke all on function app_private.is_assigned_staff(uuid) from public,anon;
grant execute on function app_private.is_assigned_staff(uuid) to authenticated;
