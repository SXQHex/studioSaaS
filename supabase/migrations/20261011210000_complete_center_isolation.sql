-- Tighten center-level isolation and instructor authorization to actual assigned sessions.
-- A pending request is a proposal, not an authorization grant to a member.
begin;

create or replace function app_private.instructor_can_access_member_center(p_center_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1
    from public.lessons l
    where l.center_id = p_center_id
      and l.instructor_id = (select auth.uid())
      and l.status in ('scheduled'::public.lesson_status, 'completed'::public.lesson_status)
      and (
        l.private_member_id = p_member_id
        or exists (
          select 1
          from public.attendance a
          where a.lesson_id = l.id
            and a.center_id = l.center_id
            and a.member_id = p_member_id
        )
      )
  )
$function$;
revoke all on function app_private.instructor_can_access_member_center(uuid, uuid) from public, anon;
grant execute on function app_private.instructor_can_access_member_center(uuid, uuid) to authenticated;

-- Profile names are global identity metadata; instructors may read only their own profile.
-- Admins can list profiles to assign instructors to a specific session and delegate center access.
drop policy if exists profiles_read_self_or_staff on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select app_private.current_role()) = 'admin'::public.app_role
);

-- Only return members already connected to a scheduled/completed session assigned to this instructor.
-- The center ID supplied by the client is a filter, never proof of authorization.
create or replace function public.list_requestable_members(p_center_id uuid)
returns table(id uuid, full_name text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if (select app_private.current_role()) is distinct from 'instructor'::public.app_role then
    raise exception 'Bu liste yalnızca eğitmenler içindir.' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.centers c
    join public.organizations o on o.id = c.organization_id
    where c.id = p_center_id and c.is_active and o.is_active
  ) then
    raise exception 'Merkez bulunamadı veya pasif.' using errcode = '42501';
  end if;

  return query
    select m.id, m.full_name
    from public.members m
    where m.center_id = p_center_id
      and m.is_active
      and (select app_private.instructor_can_access_member_center(p_center_id, m.id))
    order by m.full_name
    limit 1000;
end;
$function$;
revoke all on function public.list_requestable_members(uuid) from public, anon;
grant execute on function public.list_requestable_members(uuid) to authenticated;

-- A pending request must not grant member-data access. Members are visible to an instructor
-- only when connected to a scheduled/completed lesson assigned to that instructor.
drop policy if exists members_read_own_or_assigned_session on public.members;
create policy members_read_own_or_assigned_session on public.members
for select to authenticated
using (
  profile_id = (select auth.uid())
  or (select app_private.is_center_admin(center_id))
  or (
    (select app_private.current_role()) = 'instructor'::public.app_role
    and (select app_private.instructor_can_access_member_center(center_id, id))
  )
);

-- Validate session-scoped member access for instructors while preserving manager-created group proposals.
drop function if exists public.create_session_request(uuid, uuid, public.lesson_type, text, uuid, timestamptz, timestamptz, integer, text);
create or replace function public.create_session_request(
  p_center_id uuid,
  p_room_id uuid,
  p_session_type public.lesson_type,
  p_title text,
  p_private_member_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_expected_attendees integer,
  p_notes text,
  p_instructor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_organization_id uuid;
  v_request_id uuid;
  v_instructor_id uuid;
  v_role public.app_role;
begin
  v_role := (select app_private.current_role());
  if v_role is distinct from 'instructor'::public.app_role
    and v_role is distinct from 'admin'::public.app_role then
    raise exception 'Bu işlem için yönetici veya eğitmen yetkisi gerekir.' using errcode = '42501';
  end if;

  if v_role = 'instructor'::public.app_role then
    if p_session_type <> 'private'::public.lesson_type then
      raise exception 'Eğitmenler özel ders talebi oluşturabilir; grup dersini yönetici planlar.';
    end if;
    v_instructor_id := (select auth.uid());
  else
    if p_session_type <> 'group'::public.lesson_type then
      raise exception 'Yönetici bu akışta grup dersi taslağı oluşturabilir; özel ders talebini eğitmen oluşturur.';
    end if;
    if not (select app_private.is_center_admin(p_center_id)) then
      raise exception 'Bu merkezde yönetici yetkiniz yok.' using errcode = '42501';
    end if;
    if p_instructor_id is null or not exists (
      select 1 from public.profiles p
      where p.id = p_instructor_id and p.role = 'instructor'::public.app_role
    ) then
      raise exception 'Grup dersi için bir eğitmen atayın.';
    end if;
    v_instructor_id := p_instructor_id;
  end if;

  if p_title is null or length(trim(p_title)) not between 1 and 160 then
    raise exception 'Seans adı geçersiz.';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'Bitiş başlangıçtan sonra olmalıdır.';
  end if;
  if p_expected_attendees is null or p_expected_attendees < 1 or p_expected_attendees > 500 then
    raise exception 'Katılımcı sayısı geçersiz.';
  end if;
  if p_session_type = 'private'::public.lesson_type
    and (p_private_member_id is null or p_expected_attendees <> 1) then
    raise exception 'Özel ders için bir üye ve bir katılımcı gerekir.';
  end if;
  if p_session_type = 'group'::public.lesson_type and p_private_member_id is not null then
    raise exception 'Grup dersi için özel üye seçilemez.';
  end if;

  select c.organization_id into v_organization_id
  from public.centers c
  join public.organizations o on o.id = c.organization_id
  where c.id = p_center_id and c.is_active and o.is_active;
  if v_organization_id is null then
    raise exception 'Merkez bulunamadı veya pasif.';
  end if;

  if not exists (
    select 1 from public.rooms r
    where r.id = p_room_id and r.center_id = p_center_id and r.is_active
  ) then
    raise exception 'Oda bu merkeze ait değil veya kullanılamıyor.';
  end if;
  if p_expected_attendees > (select r.capacity from public.rooms r where r.id = p_room_id) then
    raise exception 'Katılımcı sayısı oda kapasitesini aşıyor.';
  end if;

  if p_session_type = 'private'::public.lesson_type then
    if not exists (
      select 1 from public.members m
      where m.id = p_private_member_id and m.center_id = p_center_id and m.is_active
    ) then
      raise exception 'Üye seçilen merkeze ait değil veya aktif değil.';
    end if;
    if not (select app_private.instructor_can_access_member_center(p_center_id, p_private_member_id)) then
      raise exception 'Özel ders talebi yalnızca eğitmene atanmış seanslardaki üyeler için oluşturulabilir.';
    end if;
  end if;

  insert into public.session_requests(
    organization_id, center_id, room_id, instructor_id, requested_by, session_type, title,
    private_member_id, starts_at, ends_at, expected_attendees, notes, status
  ) values (
    v_organization_id, p_center_id, p_room_id, v_instructor_id, (select auth.uid()), p_session_type,
    trim(p_title), p_private_member_id, p_starts_at, p_ends_at, p_expected_attendees,
    nullif(trim(p_notes), ''), 'pending'
  ) returning id into v_request_id;

  return v_request_id;
end;
$function$;
revoke all on function public.create_session_request(uuid, uuid, public.lesson_type, text, uuid, timestamptz, timestamptz, integer, text, uuid) from public, anon;
grant execute on function public.create_session_request(uuid, uuid, public.lesson_type, text, uuid, timestamptz, timestamptz, integer, text, uuid) to authenticated;

commit;
