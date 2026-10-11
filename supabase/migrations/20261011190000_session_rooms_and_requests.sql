-- Room scheduling and approval workflow.
-- Pending requests are proposals only and never reserve a room or instructor.
-- Existing public.lessons rows are preserved; this app currently uses lessons as class sessions.

create extension if not exists btree_gist;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 160),
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id)
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references public.centers(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  capacity integer not null default 1 check (capacity > 0 and capacity <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (center_id, name),
  unique (id, center_id)
);

alter table public.lessons
  add column if not exists center_id uuid references public.centers(id) on delete restrict,
  add column if not exists room_id uuid references public.rooms(id) on delete restrict,
  add column if not exists expected_attendees integer default null check (expected_attendees is null or expected_attendees between 1 and 500);

alter table public.lessons drop constraint if exists lessons_room_center_fkey;
alter table public.lessons add constraint lessons_room_center_fkey
  foreign key (room_id, center_id) references public.rooms(id, center_id) on delete restrict;
alter table public.lessons drop constraint if exists lessons_room_requires_center;
alter table public.lessons add constraint lessons_room_requires_center check (room_id is null or center_id is not null);
alter table public.lessons drop constraint if exists lessons_room_requires_end;
alter table public.lessons add constraint lessons_room_requires_end check (room_id is null or ends_at is not null);

alter table public.lessons drop constraint if exists lessons_private_expected_attendees;
alter table public.lessons add constraint lessons_private_expected_attendees check (expected_attendees is null or type <> 'private'::public.lesson_type or expected_attendees = 1);

create table if not exists public.session_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  center_id uuid not null references public.centers(id) on delete restrict,
  room_id uuid not null references public.rooms(id) on delete restrict,
  instructor_id uuid not null references public.profiles(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  session_type public.lesson_type not null,
  title text not null check (length(trim(title)) between 1 and 160),
  private_member_id uuid references public.members(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  expected_attendees integer not null default 1 check (expected_attendees between 1 and 500),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  approved_lesson_id uuid references public.lessons(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (session_type <> 'private' or expected_attendees = 1),
  check ((session_type = 'private' and private_member_id is not null) or (session_type = 'group' and private_member_id is null))
);

alter table public.session_requests drop constraint if exists session_requests_room_center_fkey;
alter table public.session_requests add constraint session_requests_room_center_fkey
  foreign key (room_id, center_id) references public.rooms(id, center_id) on delete restrict;
alter table public.session_requests drop constraint if exists session_requests_center_organization_fkey;
alter table public.session_requests add constraint session_requests_center_organization_fkey
  foreign key (center_id, organization_id) references public.centers(id, organization_id) on delete restrict;

create index if not exists session_requests_center_time_idx
  on public.session_requests(center_id, starts_at, ends_at) where status = 'pending';
create index if not exists lessons_room_time_idx
  on public.lessons(room_id, starts_at, ends_at) where status = 'scheduled';
create index if not exists lessons_instructor_time_idx
  on public.lessons(instructor_id, starts_at, ends_at) where status = 'scheduled';

-- Exclusion constraints are concurrency-safe: simultaneous approvals cannot reserve the same room
-- or instructor in overlapping time ranges.
alter table public.lessons
  add constraint lessons_room_no_overlap
  exclude using gist (room_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'scheduled' and room_id is not null and ends_at is not null);
alter table public.lessons
  add constraint lessons_instructor_no_overlap
  exclude using gist (instructor_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'scheduled' and instructor_id is not null and ends_at is not null);

alter table public.organizations enable row level security;
alter table public.centers enable row level security;
alter table public.rooms enable row level security;
alter table public.session_requests enable row level security;

drop policy if exists organizations_admin_manage on public.organizations;
create policy organizations_admin_manage on public.organizations for all to authenticated
  using ((select app_private.current_role()) = 'admin'::public.app_role)
  with check ((select app_private.current_role()) = 'admin'::public.app_role);
drop policy if exists organizations_staff_read on public.organizations;
create policy organizations_staff_read on public.organizations for select to authenticated
  using ((select app_private.current_role()) = any (array['admin'::public.app_role, 'instructor'::public.app_role]));

drop policy if exists centers_admin_manage on public.centers;
create policy centers_admin_manage on public.centers for all to authenticated
  using ((select app_private.current_role()) = 'admin'::public.app_role)
  with check ((select app_private.current_role()) = 'admin'::public.app_role);
drop policy if exists centers_staff_read on public.centers;
create policy centers_staff_read on public.centers for select to authenticated
  using ((select app_private.current_role()) = any (array['admin'::public.app_role, 'instructor'::public.app_role]));

drop policy if exists rooms_admin_manage on public.rooms;
create policy rooms_admin_manage on public.rooms for all to authenticated
  using ((select app_private.current_role()) = 'admin'::public.app_role)
  with check ((select app_private.current_role()) = 'admin'::public.app_role);
drop policy if exists rooms_staff_read on public.rooms;
create policy rooms_staff_read on public.rooms for select to authenticated
  using ((select app_private.current_role()) = any (array['admin'::public.app_role, 'instructor'::public.app_role]));

drop policy if exists session_requests_staff_read on public.session_requests;
create policy session_requests_staff_read on public.session_requests for select to authenticated
  using (
    (select app_private.current_role()) = 'admin'::public.app_role
    or requested_by = (select auth.uid())
    or instructor_id = (select auth.uid())
  );
drop policy if exists session_requests_instructor_create on public.session_requests;
create policy session_requests_instructor_create on public.session_requests for insert to authenticated
  with check (
    (select app_private.current_role()) = 'instructor'::public.app_role
    and requested_by = (select auth.uid())
    and instructor_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and approved_lesson_id is null
    and exists (
      select 1 from public.centers c
      join public.organizations o on o.id = c.organization_id
      where c.id = session_requests.center_id
        and c.organization_id = session_requests.organization_id
        and c.is_active and o.is_active
    )
    and (
      session_requests.room_id is null
      or exists (select 1 from public.rooms r where r.id = session_requests.room_id and r.center_id = session_requests.center_id and r.is_active)
    )
  );
drop policy if exists session_requests_admin_update on public.session_requests;
create policy session_requests_admin_update on public.session_requests for update to authenticated
  using ((select app_private.current_role()) = 'admin'::public.app_role)
  with check ((select app_private.current_role()) = 'admin'::public.app_role);

-- A request never locks a room. Only an approved lesson in scheduled state reserves it.
-- Require an end time for newly room-assigned lessons to make overlap detection reliable.
create or replace function app_private.prevent_session_resource_overlap()
returns trigger language plpgsql set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' and new.status = 'scheduled' then
    if new.room_id is null then raise exception 'Yeni planlanan seans için oda seçilmelidir.'; end if;
    if new.instructor_id is null then raise exception 'Yeni planlanan seans için eğitmen seçilmelidir.'; end if;
  elsif tg_op = 'UPDATE' and new.status = 'scheduled'
    and (new.room_id is distinct from old.room_id
      or new.instructor_id is distinct from old.instructor_id
      or new.starts_at is distinct from old.starts_at
      or new.ends_at is distinct from old.ends_at
      or old.status is distinct from new.status) then
    if new.room_id is null then raise exception 'Planlanan seans için oda seçilmelidir.'; end if;
    if new.instructor_id is null then raise exception 'Planlanan seans için eğitmen seçilmelidir.'; end if;
  end if;
  if new.status = 'scheduled' and new.room_id is not null then
    if new.expected_attendees is null then
      raise exception 'Oda rezervasyonu için katılımcı sayısı zorunludur.';
    end if;
    if new.expected_attendees > (select r.capacity from public.rooms r where r.id = new.room_id) then
      raise exception 'Katılımcı sayısı seçilen odanın kapasitesini aşıyor.';
    end if;
  end if;
  if new.status = 'scheduled' and new.ends_at is not null then
    if new.room_id is not null and exists (
      select 1 from public.lessons l
      where l.id <> new.id and l.status = 'scheduled' and l.room_id = new.room_id
        and l.ends_at is not null
        and tstzrange(l.starts_at, l.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'Bu oda seçilen zaman aralığında başka bir kesinleşmiş seans için ayrılmış.' using errcode = '23P01';
    end if;
    if new.instructor_id is not null and exists (
      select 1 from public.lessons l
      where l.id <> new.id and l.status = 'scheduled' and l.instructor_id = new.instructor_id
        and l.ends_at is not null
        and tstzrange(l.starts_at, l.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'Eğitmen aynı zaman aralığında başka bir kesinleşmiş seansa atanmış.' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists lessons_prevent_session_resource_overlap on public.lessons;
create trigger lessons_prevent_session_resource_overlap
before insert or update of room_id, instructor_id, starts_at, ends_at, status on public.lessons
for each row execute function app_private.prevent_session_resource_overlap();

create or replace function public.review_session_request(p_request_id uuid, p_approve boolean, p_review_note text default null)
returns uuid language plpgsql security invoker set search_path to ''
as $function$
declare
  v_request public.session_requests%rowtype;
  v_lesson_id uuid;
begin
  if (select app_private.current_role()) is distinct from 'admin'::public.app_role then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.' using errcode = '42501';
  end if;

  select * into v_request from public.session_requests where id = p_request_id for update;
  if not found then raise exception 'Seans talebi bulunamadı.'; end if;
  if v_request.status <> 'pending' then raise exception 'Bu talep daha önce değerlendirilmiş.'; end if;

  if not p_approve then
    update public.session_requests
      set status = 'rejected', reviewed_by = (select auth.uid()), reviewed_at = now(), review_note = p_review_note
      where id = p_request_id;
    return null;
  end if;

  if not exists (select 1 from public.centers c where c.id = v_request.center_id and c.organization_id = v_request.organization_id and c.is_active)
    or not exists (select 1 from public.rooms r where r.id = v_request.room_id and r.center_id = v_request.center_id and r.is_active) then
    raise exception 'Merkez veya oda artık kullanılamıyor.';
  end if;
  if v_request.expected_attendees > (select r.capacity from public.rooms r where r.id = v_request.room_id) then
    raise exception 'Katılımcı sayısı seçilen odanın kapasitesini aşıyor.';
  end if;

  insert into public.lessons(type, title, starts_at, ends_at, status, instructor_id, private_member_id, notes, created_by, center_id, room_id, expected_attendees)
  values (v_request.session_type, v_request.title, v_request.starts_at, v_request.ends_at, 'scheduled',
    v_request.instructor_id, v_request.private_member_id, v_request.notes, (select auth.uid()), v_request.center_id, v_request.room_id, v_request.expected_attendees)
  returning id into v_lesson_id;

  update public.session_requests
    set status = 'approved', reviewed_by = (select auth.uid()), reviewed_at = now(),
        review_note = p_review_note, approved_lesson_id = v_lesson_id
    where id = p_request_id;
  return v_lesson_id;
end;
$function$;

grant execute on function public.review_session_request(uuid, boolean, text) to authenticated;
