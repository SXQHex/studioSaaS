-- Todo 2: a user's own display name is editable, but roles are never self-editable.
-- Keep role assignments and the legacy role column out of all client write paths.
revoke update on public.profiles from public, anon, authenticated;
grant update (full_name) on public.profiles to authenticated;
drop policy if exists profiles_update_own_display_name on public.profiles;
create policy profiles_update_own_display_name on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Return an exact lesson roster, never a broad center contact directory.
-- A full instructor must be assigned to this exact lesson; teaching in another
-- center or being only an assistant elsewhere does not grant roster access.
create or replace function public.my_teaching_lessons()
returns table (
  id uuid, center_id uuid, title text, type public.lesson_type,
  starts_at timestamptz, status public.lesson_status, expected_attendees integer
)
language sql stable security definer set search_path = ''
as $$
  select l.id, l.center_id, l.title, l.type, l.starts_at, l.status, l.expected_attendees
  from public.lessons l
  where (select auth.uid()) is not null
    and (
      app_private.can_manage_center(l.center_id)
      or exists (
        select 1 from public.lesson_staff_assignments a
        where a.lesson_id = l.id and a.center_id = l.center_id
          and a.profile_id = (select auth.uid()) and a.role = 'instructor'
      )
    )
  order by l.starts_at desc, l.id
$$;

create or replace function public.my_lesson_roster(p_lesson_id uuid)
returns table (
  member_id uuid, full_name text, email text, phone text,
  source text, attended boolean, checked_in_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_center_id uuid;
begin
  if (select auth.uid()) is null or p_lesson_id is null then
    raise exception 'Giriş yapmanız ve ders seçmeniz gerekiyor.' using errcode = '42501';
  end if;
  select l.center_id into v_center_id from public.lessons l where l.id = p_lesson_id;
  if not found or not (
    app_private.can_manage_center(v_center_id)
    or exists (
      select 1 from public.lesson_staff_assignments a
      where a.lesson_id = p_lesson_id and a.center_id = v_center_id
        and a.profile_id = (select auth.uid()) and a.role = 'instructor'
    )
  ) then
    raise exception 'Bu dersteki öğrencileri görme yetkiniz yok.' using errcode = '42501';
  end if;
  return query
    with linked_members as (
      select l.private_member_id as id from public.lessons l
      where l.id = p_lesson_id and l.private_member_id is not null
      union
      select e.member_id from public.lesson_enrollments e
      where e.lesson_id = p_lesson_id and e.center_id = v_center_id
      union
      select a.member_id from public.attendance a
      where a.lesson_id = p_lesson_id and a.center_id = v_center_id
    )
    select m.id, m.full_name, m.email, m.phone,
      case
        when l.private_member_id = m.id then 'private'::text
        when e.member_id is not null then 'enrolled'::text
        else 'attendance'::text
      end as source,
      a.attended, a.checked_in_at
    from linked_members x
    join public.members m on m.id = x.id and m.center_id = v_center_id
    join public.lessons l on l.id = p_lesson_id and l.center_id = v_center_id
    left join public.lesson_enrollments e on
      e.lesson_id = p_lesson_id and e.member_id = m.id and e.center_id = v_center_id
    left join public.attendance a on
      a.lesson_id = p_lesson_id and a.member_id = m.id and a.center_id = v_center_id
    order by m.full_name, m.id;
end;
$$;

revoke all on function public.my_teaching_lessons() from public, anon;
revoke all on function public.my_lesson_roster(uuid) from public, anon;
grant execute on function public.my_teaching_lessons() to authenticated;
grant execute on function public.my_lesson_roster(uuid) to authenticated;

comment on function public.my_lesson_roster(uuid) is
'Read-only roster: authorized center manager or full instructor of the exact lesson only, no assistant-only access.';
