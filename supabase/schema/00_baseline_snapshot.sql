-- StudioSaaS complete live schema baseline
-- Project: ysplylnwdfwizmuxvcqg (PostgreSQL 17); captured 2026-10-12.
-- Reconstructs the current live schema, including center-level isolation, room/session
-- requests, notifications, RLS policies, triggers, constraints, indexes, and functions.
-- This is schema-only: no auth users, profile/member/lesson rows, tenant seed data,
-- credentials, API keys, or secrets are included.
--
-- Apply only to a new isolated Supabase database. Never run against production.
-- The Supabase Auth schema/roles and the btree_gist extension must be available.
-- After this baseline, apply the forward-only privilege hardening migration in ../migrations.
-- Three early migrations were applied through SQL Editor and their original SQL was not
-- retained; their resulting schema is represented by the reconstructed initial snapshot.

-- ---------------------------------------------------------------------------
-- Schema and enums
-- ---------------------------------------------------------------------------
create schema if not exists app_private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
grant usage on schema app_private to authenticated;

create type public.app_role as enum ('admin', 'instructor', 'student');
create type public.lesson_status as enum ('scheduled', 'completed', 'cancelled', 'postponed');
create type public.lesson_type as enum ('private', 'group');
create type public.payment_status as enum ('pending', 'paid', 'refunded');
create type public.subscription_status as enum ('active', 'expired', 'cancelled');
create type public.subscription_type as enum ('private_credits', 'group_4_weeks');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default ''::text,
  role public.app_role not null default 'student'::public.app_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  profile_id uuid unique references public.profiles (id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  type public.subscription_type not null,
  starts_on date not null default current_date,
  ends_on date,
  credits_purchased integer not null check (credits_purchased > 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  amount numeric not null default 0 check (amount >= 0::numeric),
  payment_status public.payment_status not null default 'pending'::public.payment_status,
  paid_at timestamptz,
  status public.subscription_status not null default 'active'::public.subscription_status,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (credits_remaining <= credits_purchased)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  type public.lesson_type not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.lesson_status not null default 'scheduled'::public.lesson_status,
  instructor_id uuid references public.profiles (id) on delete set null,
  private_member_id uuid references public.members (id) on delete restrict,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at),
  check (
    (type = 'private'::public.lesson_type and private_member_id is not null)
    or (type = 'group'::public.lesson_type and private_member_id is null)
  )
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete restrict,
  member_id uuid not null references public.members (id) on delete restrict,
  attended boolean not null default true,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique (lesson_id, member_id)
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete restrict,
  member_id uuid not null references public.members (id) on delete restrict,
  lesson_id uuid references public.lessons (id) on delete restrict,
  amount integer not null check (amount <> 0),
  reason text not null check (reason = any (array['purchase'::text, 'lesson_use'::text, 'admin_adjustment'::text, 'refund'::text])),
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes (besides primary keys and unique constraints above)
-- ---------------------------------------------------------------------------
create index attendance_checked_in_by_idx on public.attendance using btree (checked_in_by);
create index attendance_member_idx on public.attendance using btree (member_id, created_at desc);
create index credit_transactions_created_by_idx on public.credit_transactions using btree (created_by);
create index credit_transactions_lesson_idx on public.credit_transactions using btree (lesson_id);
create index credit_transactions_member_idx on public.credit_transactions using btree (member_id, created_at desc);
create unique index credit_transactions_one_lesson_use
  on public.credit_transactions using btree (subscription_id, lesson_id)
  where (reason = 'lesson_use'::text and lesson_id is not null);
create index lessons_created_by_idx on public.lessons using btree (created_by);
create index lessons_instructor_idx on public.lessons using btree (instructor_id, starts_at);
create index lessons_private_member_idx on public.lessons using btree (private_member_id);
create index lessons_starts_at_idx on public.lessons using btree (starts_at);
create index subscriptions_created_by_idx on public.subscriptions using btree (created_by);
create index subscriptions_member_active_idx on public.subscriptions using btree (member_id, status, type, starts_on, ends_on);

-- ---------------------------------------------------------------------------
-- Functions (app_private)
-- ---------------------------------------------------------------------------
create or replace function app_private."current_role"()
returns public.app_role
language sql
stable security definer
set search_path to ''
as $function$
  select p.role from public.profiles p where p.id = (select auth.uid())
$function$;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'student')
  on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function app_private.prepare_subscription()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.type = 'group_4_weeks' then
    new.credits_purchased := 4;
    new.credits_remaining := 4;
    -- Group packs expire by credit usage, not by a fixed 28-day calendar window.
    new.ends_on := null;
  else
    if new.ends_on is null then
      raise exception 'Özel ders paketleri için bitiş tarihi girilmelidir.';
    end if;
    new.credits_remaining := new.credits_purchased;
  end if;
  return new;
end;
$function$;

create or replace function app_private.protect_subscription_credit_columns()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
    and (
      new.credits_remaining is distinct from old.credits_remaining
      or new.credits_purchased is distinct from old.credits_purchased
    )
  then
    raise exception 'Kredi bakiyesi yalnızca güvenilir veritabanı işlemleriyle değiştirilebilir.';
  end if;

  return new;
end;
$function$;

create or replace function app_private.record_subscription_purchase()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.credit_transactions(subscription_id, member_id, amount, reason, note, created_by)
  values (new.id, new.member_id, new.credits_purchased, 'purchase', 'Paket satın alındı', new.created_by);
  return new;
end;
$function$;

create or replace function app_private.apply_manual_credit_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.reason in ('admin_adjustment', 'refund') then
    update public.subscriptions
       set credits_remaining = credits_remaining + new.amount
     where id = new.subscription_id
       and credits_remaining + new.amount between 0 and credits_purchased;
    if not found then
      raise exception 'Kredi bakiyesi bu işlem için uygun değil.';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function app_private.consume_lesson_credit(p_lesson_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_lesson public.lessons%rowtype;
  v_sub public.subscriptions%rowtype;
  v_rows integer;
  v_lesson_date date;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found or v_lesson.status <> 'completed' then
    return;
  end if;

  v_lesson_date := (v_lesson.starts_at at time zone 'Europe/Istanbul')::date;

  if v_lesson.type = 'private' then
    for v_sub in
      select * from public.subscriptions
      where member_id = v_lesson.private_member_id
        and type = 'private_credits'
        and status = 'active'
        and starts_on <= v_lesson_date
        and (ends_on is null or ends_on >= v_lesson_date)
        and credits_remaining > 0
      order by starts_on, created_at
      limit 1
      for update
    loop
      insert into public.credit_transactions(subscription_id, member_id, lesson_id, amount, reason, note)
      values (v_sub.id, v_sub.member_id, v_lesson.id, -1, 'lesson_use', 'Özel ders yapıldı')
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        update public.subscriptions set credits_remaining = credits_remaining - 1 where id = v_sub.id;
      end if;
    end loop;
  elsif v_lesson.type = 'group' then
    for v_sub in
      select * from public.subscriptions
      where type = 'group_4_weeks'
        and status = 'active'
        and starts_on <= v_lesson_date
        and (ends_on is null or ends_on >= v_lesson_date)
        and credits_remaining > 0
      order by member_id, starts_on, created_at
      for update
    loop
      insert into public.credit_transactions(subscription_id, member_id, lesson_id, amount, reason, note)
      values (v_sub.id, v_sub.member_id, v_lesson.id, -1, 'lesson_use', 'Grup dersi yapıldı')
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        update public.subscriptions set credits_remaining = credits_remaining - 1 where id = v_sub.id;
      end if;
    end loop;
  end if;
end;
$function$;

create or replace function app_private.on_lesson_completed()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      perform app_private.consume_lesson_credit(new.id);
    end if;
  elsif new.status = 'completed' and old.status is distinct from new.status then
    perform app_private.consume_lesson_credit(new.id);
  end if;
  return new;
end;
$function$;

create or replace function app_private.on_group_attendance_added()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_lesson public.lessons%rowtype;
begin
  select * into v_lesson from public.lessons where id = new.lesson_id;

  if v_lesson.type = 'group' then
    -- Explicit cancellation/postponement takes precedence over an accidental attendance row.
    if v_lesson.status in ('cancelled', 'postponed') then
      return new;
    end if;

    -- For an otherwise scheduled group lesson, an attendance row means the lesson took place.
    update public.lessons
       set status = 'completed', updated_at = now()
     where id = new.lesson_id and status <> 'completed';

    perform app_private.consume_lesson_credit(new.lesson_id);
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function app_private.set_updated_at();
create trigger members_set_updated_at before update on public.members
  for each row execute function app_private.set_updated_at();
create trigger lessons_set_updated_at before update on public.lessons
  for each row execute function app_private.set_updated_at();

create trigger subscriptions_prepare_before_insert before insert on public.subscriptions
  for each row execute function app_private.prepare_subscription();
create trigger subscriptions_protect_credit_columns
  before update of credits_remaining, credits_purchased on public.subscriptions
  for each row execute function app_private.protect_subscription_credit_columns();
create trigger subscriptions_record_purchase after insert on public.subscriptions
  for each row execute function app_private.record_subscription_purchase();

create trigger credit_transactions_apply_manual_change after insert on public.credit_transactions
  for each row execute function app_private.apply_manual_credit_change();

create trigger lessons_consume_credit after insert or update of status on public.lessons
  for each row execute function app_private.on_lesson_completed();

create trigger attendance_group_consumes_credit after insert on public.attendance
  for each row execute function app_private.on_group_attendance_added();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.lessons enable row level security;
alter table public.attendance enable row level security;
alter table public.credit_transactions enable row level security;

-- profiles: students can read only themselves and cannot update anything (no student UPDATE policy),
-- so a user can never change their own role.
create policy profiles_admin_manage on public.profiles
  for all to authenticated
  using ((select app_private."current_role"()) = 'admin'::public.app_role)
  with check ((select app_private."current_role"()) = 'admin'::public.app_role);
create policy profiles_read_self_or_staff on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select app_private."current_role"()) = any (array['admin'::public.app_role, 'instructor'::public.app_role])
  );

-- members
create policy members_admin_manage on public.members
  for all to authenticated
  using ((select app_private."current_role"()) = 'admin'::public.app_role)
  with check ((select app_private."current_role"()) = 'admin'::public.app_role);
create policy members_staff_all_student_own on public.members
  for select to authenticated
  using (
    (select app_private."current_role"()) = any (array['admin'::public.app_role, 'instructor'::public.app_role])
    or profile_id = (select auth.uid())
  );

-- subscriptions
create policy subscriptions_admin_manage on public.subscriptions
  for all to authenticated
  using ((select app_private."current_role"()) = 'admin'::public.app_role)
  with check ((select app_private."current_role"()) = 'admin'::public.app_role);
create policy subscriptions_staff_all_student_own on public.subscriptions
  for select to authenticated
  using (
    (select app_private."current_role"()) = any (array['admin'::public.app_role, 'instructor'::public.app_role])
    or member_id in (select m.id from public.members as m where m.profile_id = (select auth.uid()))
  );

-- lessons
create policy lessons_admin_manage on public.lessons
  for all to authenticated
  using ((select app_private."current_role"()) = 'admin'::public.app_role)
  with check ((select app_private."current_role"()) = 'admin'::public.app_role);
create policy lessons_staff_all_student_own on public.lessons
  for select to authenticated
  using (
    (select app_private."current_role"()) = any (array['admin'::public.app_role, 'instructor'::public.app_role])
    or private_member_id in (select m.id from public.members as m where m.profile_id = (select auth.uid()))
    or (
      type = 'group'::public.lesson_type
      and exists (
        select 1
        from public.subscriptions as s
        join public.members as m on m.id = s.member_id
        where m.profile_id = (select auth.uid())
          and s.type = 'group_4_weeks'::public.subscription_type
          and s.status = 'active'::public.subscription_status
          and s.starts_on <= (lessons.starts_at at time zone 'Europe/Istanbul')::date
          and (s.ends_on is null or s.ends_on >= (lessons.starts_at at time zone 'Europe/Istanbul')::date)
      )
    )
  );

-- attendance
create policy attendance_staff_read on public.attendance
  for select to authenticated
  using (
    (select app_private."current_role"()) = any (array['admin'::public.app_role, 'instructor'::public.app_role])
    or member_id in (select m.id from public.members as m where m.profile_id = (select auth.uid()))
  );
create policy attendance_staff_insert on public.attendance
  for insert to authenticated
  with check (
    (select app_private."current_role"()) = any (array['admin'::public.app_role, 'instructor'::public.app_role])
    and exists (
      select 1
      from public.lessons as l
      where l.id = attendance.lesson_id
        and l.status not in ('cancelled'::public.lesson_status, 'postponed'::public.lesson_status)
        and (
          l.type = 'group'::public.lesson_type
          or (l.type = 'private'::public.lesson_type and l.private_member_id = attendance.member_id)
        )
    )
  );
create policy attendance_admin_delete on public.attendance
  for delete to authenticated
  using ((select app_private."current_role"()) = 'admin'::public.app_role);

-- credit_transactions: append-only for clients; only the admin can insert manual rows.
create policy credit_transactions_staff_read_student_own on public.credit_transactions
  for select to authenticated
  using (
    (select app_private."current_role"()) = any (array['admin'::public.app_role, 'instructor'::public.app_role])
    or member_id in (select m.id from public.members as m where m.profile_id = (select auth.uid()))
  );
create policy credit_transactions_admin_insert on public.credit_transactions
  for insert to authenticated
  with check (
    (select app_private."current_role"()) = 'admin'::public.app_role
    and reason in ('admin_adjustment', 'refund')
    and exists (
      select 1
      from public.subscriptions as s
      where s.id = credit_transactions.subscription_id
        and s.member_id = credit_transactions.member_id
    )
  );


-- ---------------------------------------------------------------------------
-- Captured live change: 20261011190000_session_rooms_and_requests.sql
-- ---------------------------------------------------------------------------
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


-- ---------------------------------------------------------------------------
-- Captured live change: 20261011200000_center_level_tenancy.sql
-- ---------------------------------------------------------------------------
-- Center-level tenancy and session-scoped instructor access.
-- Organizations are branding/grouping only. Centers are the data-isolation boundary.
-- Do not apply to production until tested against a Supabase branch and reviewed.


create table if not exists public.center_admins (
  center_id uuid not null references public.centers(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (center_id, profile_id)
);
create index if not exists center_admins_profile_idx on public.center_admins(profile_id, center_id);
alter table public.center_admins enable row level security;

alter table public.members add column if not exists center_id uuid references public.centers(id) on delete restrict;
alter table public.members alter column center_id set not null;
create index if not exists members_center_idx on public.members(center_id, created_at desc);
create unique index if not exists members_id_center_unique on public.members(id, center_id);

-- A fresh baseline has no lesson rows to backfill; future records must supply a valid center.
alter table public.lessons alter column center_id set not null;
create unique index if not exists lessons_id_center_unique on public.lessons(id, center_id);

alter table public.subscriptions add column if not exists center_id uuid references public.centers(id) on delete restrict;
alter table public.subscriptions alter column center_id set not null;
create index if not exists subscriptions_center_idx on public.subscriptions(center_id, created_at desc);
create unique index if not exists subscriptions_id_center_unique on public.subscriptions(id, center_id);

alter table public.attendance add column if not exists center_id uuid references public.centers(id) on delete restrict;
alter table public.attendance alter column center_id set not null;
create index if not exists attendance_center_idx on public.attendance(center_id, checked_in_at desc);

alter table public.credit_transactions add column if not exists center_id uuid references public.centers(id) on delete restrict;
alter table public.credit_transactions alter column center_id set not null;
create index if not exists credit_transactions_center_idx on public.credit_transactions(center_id, created_at desc);

-- Composite FKs prevent records from linking to a member, lesson or subscription from another center.
alter table public.subscriptions drop constraint if exists subscriptions_member_center_fkey;
alter table public.subscriptions add constraint subscriptions_member_center_fkey
  foreign key (member_id, center_id) references public.members(id, center_id) on delete restrict;
alter table public.attendance drop constraint if exists attendance_member_center_fkey;
alter table public.attendance add constraint attendance_member_center_fkey
  foreign key (member_id, center_id) references public.members(id, center_id) on delete restrict;
alter table public.attendance drop constraint if exists attendance_lesson_center_fkey;
alter table public.attendance add constraint attendance_lesson_center_fkey
  foreign key (lesson_id, center_id) references public.lessons(id, center_id) on delete restrict;
alter table public.credit_transactions drop constraint if exists credit_transactions_subscription_center_fkey;
alter table public.credit_transactions add constraint credit_transactions_subscription_center_fkey
  foreign key (subscription_id, center_id) references public.subscriptions(id, center_id) on delete restrict;
alter table public.credit_transactions drop constraint if exists credit_transactions_member_center_fkey;
alter table public.credit_transactions add constraint credit_transactions_member_center_fkey
  foreign key (member_id, center_id) references public.members(id, center_id) on delete restrict;
alter table public.credit_transactions drop constraint if exists credit_transactions_lesson_center_fkey;
alter table public.credit_transactions add constraint credit_transactions_lesson_center_fkey
  foreign key (lesson_id, center_id) references public.lessons(id, center_id) on delete restrict;

-- Center ownership is immutable after a row is created; moving data requires an explicit migration.
create or replace function app_private.prevent_center_reassignment()
returns trigger language plpgsql set search_path to ''
as $function$
begin
  if new.center_id is distinct from old.center_id then
    raise exception 'Kayıt oluşturulduktan sonra merkez değiştirilemez.';
  end if;
  return new;
end;
$function$;
drop trigger if exists members_center_immutable on public.members;
create trigger members_center_immutable before update of center_id on public.members
for each row execute function app_private.prevent_center_reassignment();
drop trigger if exists lessons_center_immutable on public.lessons;
create trigger lessons_center_immutable before update of center_id on public.lessons
for each row execute function app_private.prevent_center_reassignment();
drop trigger if exists rooms_center_immutable on public.rooms;
create trigger rooms_center_immutable before update of center_id on public.rooms
for each row execute function app_private.prevent_center_reassignment();

create or replace function app_private.prevent_session_request_direct_review()
returns trigger language plpgsql set search_path to ''
as $function$
begin
  if new.status is distinct from old.status
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.review_note is distinct from old.review_note
    or new.approved_lesson_id is distinct from old.approved_lesson_id then
    if current_setting('app.session_request_review', true) is distinct from 'on' then
      raise exception 'Talepler yalnızca yönetici onay fonksiyonu üzerinden değerlendirilebilir.';
    end if;
  end if;
  return new;
end;
$function$;
drop trigger if exists session_requests_review_guard on public.session_requests;
create trigger session_requests_review_guard before update on public.session_requests
for each row execute function app_private.prevent_session_request_direct_review();

create or replace function app_private.prevent_session_request_detail_changes()
returns trigger language plpgsql set search_path to ''
as $function$
begin
  if new.organization_id is distinct from old.organization_id
    or new.center_id is distinct from old.center_id
    or new.room_id is distinct from old.room_id
    or new.instructor_id is distinct from old.instructor_id
    or new.requested_by is distinct from old.requested_by
    or new.session_type is distinct from old.session_type
    or new.title is distinct from old.title
    or new.private_member_id is distinct from old.private_member_id
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.expected_attendees is distinct from old.expected_attendees
    or new.notes is distinct from old.notes then
    raise exception 'Talep ayrıntıları değiştirilemez; yeni talep oluşturun.';
  end if;
  return new;
end;
$function$;
drop trigger if exists session_requests_details_immutable on public.session_requests;
create trigger session_requests_details_immutable before update on public.session_requests
for each row execute function app_private.prevent_session_request_detail_changes();

alter table public.session_requests drop constraint if exists session_requests_private_member_center_fkey;
alter table public.session_requests add constraint session_requests_private_member_center_fkey
  foreign key (private_member_id, center_id) references public.members(id, center_id) on delete restrict;

-- Legacy subscriptions/transactions are center-inherited on writes, never trusted from client input.
create or replace function app_private.set_subscription_center()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare v_center uuid;
begin
  select m.center_id into v_center from public.members m where m.id = new.member_id;
  if v_center is null then raise exception 'Üye bulunamadı.'; end if;
  if new.center_id is not null and new.center_id <> v_center then
    raise exception 'Abonelik ve üye aynı merkeze ait olmalıdır.';
  end if;
  new.center_id := v_center;
  return new;
end;
$function$;
drop trigger if exists subscriptions_set_center on public.subscriptions;
create trigger subscriptions_set_center before insert or update of member_id, center_id on public.subscriptions
for each row execute function app_private.set_subscription_center();

create or replace function app_private.set_attendance_center()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare v_lesson_center uuid; v_member_center uuid;
begin
  select l.center_id into v_lesson_center from public.lessons l where l.id = new.lesson_id;
  select m.center_id into v_member_center from public.members m where m.id = new.member_id;
  if v_lesson_center is null or v_member_center is null or v_lesson_center <> v_member_center then
    raise exception 'Yoklama, üye ve ders aynı merkeze ait olmalıdır.';
  end if;
  if new.center_id is not null and new.center_id <> v_lesson_center then
    raise exception 'Yoklama farklı bir merkeze taşınamaz.';
  end if;
  new.center_id := v_lesson_center;
  return new;
end;
$function$;
drop trigger if exists attendance_set_center on public.attendance;
create trigger attendance_set_center before insert or update of lesson_id, member_id, center_id on public.attendance
for each row execute function app_private.set_attendance_center();

create or replace function app_private.set_credit_transaction_center()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare v_subscription_center uuid; v_subscription_member uuid; v_member_center uuid; v_lesson_center uuid;
begin
  select s.center_id, s.member_id into v_subscription_center, v_subscription_member
    from public.subscriptions s where s.id = new.subscription_id;
  if v_subscription_center is null then raise exception 'Abonelik bulunamadı.'; end if;
  if new.member_id is distinct from v_subscription_member then
    raise exception 'Kredi işlemi aboneliğin üyesiyle eşleşmiyor.';
  end if;
  select m.center_id into v_member_center from public.members m where m.id = new.member_id;
  if v_member_center is null or v_member_center <> v_subscription_center then
    raise exception 'Kredi işlemi, abonelik ve üye aynı merkeze ait olmalıdır.';
  end if;
  if new.lesson_id is not null then
    select l.center_id into v_lesson_center from public.lessons l where l.id = new.lesson_id;
    if v_lesson_center is null or v_lesson_center <> v_subscription_center then
      raise exception 'Kredi işlemi ve ders aynı merkeze ait olmalıdır.';
    end if;
  end if;
  if new.center_id is not null and new.center_id <> v_subscription_center then
    raise exception 'Kredi işlemi farklı bir merkeze taşınamaz.';
  end if;
  new.center_id := v_subscription_center;
  return new;
end;
$function$;
drop trigger if exists credit_transactions_set_center on public.credit_transactions;
create trigger credit_transactions_set_center before insert or update of subscription_id, member_id, lesson_id, center_id on public.credit_transactions
for each row execute function app_private.set_credit_transaction_center();

create or replace function app_private.is_center_admin(p_center_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $function$
  select exists (
    select 1 from public.center_admins ca
    join public.profiles p on p.id = ca.profile_id
    where ca.center_id = p_center_id
      and ca.profile_id = (select auth.uid())
      and p.role = 'admin'::public.app_role
  )
$function$;
grant execute on function app_private.is_center_admin(uuid) to authenticated;

create or replace function public.create_center(p_organization_id uuid, p_name text, p_address text default null)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare v_center_id uuid;
begin
  if (select app_private.current_role()) is distinct from 'admin'::public.app_role then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.' using errcode = '42501';
  end if;
  if length(trim(p_name)) not between 1 and 160 then raise exception 'Merkez adı geçersiz.'; end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.is_active) then
    raise exception 'Organizasyon bulunamadı veya pasif.';
  end if;
  insert into public.centers(organization_id, name, address, is_active)
  values (p_organization_id, trim(p_name), nullif(trim(p_address), ''), true)
  returning id into v_center_id;
  insert into public.center_admins(center_id, profile_id) values (v_center_id, (select auth.uid()));
  return v_center_id;
end;
$function$;
revoke all on function public.create_center(uuid, text, text) from public, anon;
grant execute on function public.create_center(uuid, text, text) to authenticated;

create or replace function public.grant_center_admin(p_center_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if (select app_private.current_role()) is distinct from 'admin'::public.app_role then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.' using errcode = '42501';
  end if;
  if not (select app_private.is_center_admin(p_center_id)) then
    raise exception 'Bu merkezde yönetici yetkiniz yok.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_profile_id and p.role = 'admin'::public.app_role) then
    raise exception 'Yalnızca yönetici rolündeki profillere merkez yetkisi verilebilir.';
  end if;
  insert into public.center_admins(center_id, profile_id) values (p_center_id, p_profile_id)
  on conflict do nothing;
end;
$function$;
revoke all on function public.grant_center_admin(uuid, uuid) from public, anon;
grant execute on function public.grant_center_admin(uuid, uuid) to authenticated;

create or replace function public.revoke_center_admin(p_center_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path to ''
as $function$
declare v_count integer;
begin
  if (select app_private.current_role()) is distinct from 'admin'::public.app_role then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.' using errcode = '42501';
  end if;
  if not (select app_private.is_center_admin(p_center_id)) then
    raise exception 'Bu merkezde yönetici yetkiniz yok.' using errcode = '42501';
  end if;
  select count(*) into v_count from public.center_admins where center_id = p_center_id;
  if not exists (select 1 from public.center_admins where center_id = p_center_id and profile_id = p_profile_id) then
    raise exception 'Bu yönetici seçilen merkezde yetkili değil.';
  end if;
  if v_count <= 1 then raise exception 'Merkezin en az bir yöneticisi kalmalıdır.'; end if;
  delete from public.center_admins where center_id = p_center_id and profile_id = p_profile_id;
end;
$function$;
revoke all on function public.revoke_center_admin(uuid, uuid) from public, anon;
grant execute on function public.revoke_center_admin(uuid, uuid) to authenticated;

create or replace function app_private.protect_room_capacity()
returns trigger language plpgsql set search_path to ''
as $function$
begin
  if exists (
    select 1 from public.lessons l where l.room_id = old.id and l.status = 'scheduled'
      and l.expected_attendees is not null and l.expected_attendees > new.capacity
  ) then
    raise exception 'Kapasite, kesinleşmiş bir seansın katılımcı sayısından düşük olamaz.';
  end if;
  return new;
end;
$function$;
drop trigger if exists rooms_protect_scheduled_capacity on public.rooms;
create trigger rooms_protect_scheduled_capacity before update of capacity on public.rooms
for each row execute function app_private.protect_room_capacity();

-- Session request member options expose only ID/name for one explicitly chosen active center.
create or replace function public.list_requestable_members(p_center_id uuid)
returns table(id uuid, full_name text)
language plpgsql stable security definer set search_path to ''
as $function$
begin
  if (select app_private.current_role()) is distinct from 'instructor'::public.app_role then
    raise exception 'Bu liste yalnızca eğitmenler içindir.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.centers c where c.id = p_center_id and c.is_active) then
    raise exception 'Merkez bulunamadı veya pasif.';
  end if;
  return query select m.id, m.full_name from public.members m
    where m.center_id = p_center_id and m.is_active order by m.full_name limit 1000;
end;
$function$;
revoke all on function public.list_requestable_members(uuid) from public, anon;
grant execute on function public.list_requestable_members(uuid) to authenticated;

drop function if exists public.create_session_request(uuid, uuid, public.lesson_type, text, uuid, timestamptz, timestamptz, integer, text);
create function public.create_session_request(
  p_center_id uuid, p_room_id uuid, p_session_type public.lesson_type, p_title text,
  p_private_member_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_expected_attendees integer, p_notes text, p_instructor_id uuid default null
)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare
  v_organization_id uuid;
  v_request_id uuid;
  v_instructor_id uuid;
  v_role public.app_role;
begin
  v_role := (select app_private.current_role());
  if v_role is distinct from 'instructor'::public.app_role and v_role is distinct from 'admin'::public.app_role then
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
      select 1 from public.profiles p where p.id = p_instructor_id and p.role = 'instructor'::public.app_role
    ) then
      raise exception 'Grup dersi için bir eğitmen atayın.';
    end if;
    v_instructor_id := p_instructor_id;
  end if;

  if p_ends_at <= p_starts_at then raise exception 'Bitiş başlangıçtan sonra olmalıdır.'; end if;
  if p_expected_attendees < 1 or p_expected_attendees > 500 then raise exception 'Katılımcı sayısı geçersiz.'; end if;
  if p_session_type = 'private'::public.lesson_type and (p_private_member_id is null or p_expected_attendees <> 1) then
    raise exception 'Özel ders için bir üye ve bir katılımcı gerekir.';
  end if;
  if p_session_type = 'group'::public.lesson_type and p_private_member_id is not null then
    raise exception 'Grup dersi için özel üye seçilemez.';
  end if;
  select c.organization_id into v_organization_id from public.centers c
    join public.organizations o on o.id = c.organization_id
    where c.id = p_center_id and c.is_active and o.is_active;
  if v_organization_id is null then raise exception 'Merkez bulunamadı veya pasif.'; end if;
  if not exists (select 1 from public.rooms r where r.id = p_room_id and r.center_id = p_center_id and r.is_active) then
    raise exception 'Oda bu merkeze ait değil veya kullanılamıyor.';
  end if;
  if p_expected_attendees > (select r.capacity from public.rooms r where r.id = p_room_id) then
    raise exception 'Katılımcı sayısı oda kapasitesini aşıyor.';
  end if;
  if p_session_type = 'private'::public.lesson_type and not exists (
    select 1 from public.members m where m.id = p_private_member_id and m.center_id = p_center_id and m.is_active
  ) then raise exception 'Üye seçilen merkeze ait değil veya aktif değil.'; end if;

  insert into public.session_requests(
    organization_id, center_id, room_id, instructor_id, requested_by, session_type, title,
    private_member_id, starts_at, ends_at, expected_attendees, notes, status
  ) values (
    v_organization_id, p_center_id, p_room_id, v_instructor_id, (select auth.uid()), p_session_type,
    trim(p_title), p_private_member_id, p_starts_at, p_ends_at, p_expected_attendees, nullif(trim(p_notes), ''), 'pending'
  ) returning id into v_request_id;
  return v_request_id;
end;
$function$;

revoke all on function public.create_session_request(uuid, uuid, public.lesson_type, text, uuid, timestamptz, timestamptz, integer, text, uuid) from public, anon;
grant execute on function public.create_session_request(uuid, uuid, public.lesson_type, text, uuid, timestamptz, timestamptz, integer, text, uuid) to authenticated;

-- Credit consumption must never cross the center boundary.
create or replace function app_private.consume_lesson_credit(p_lesson_id uuid)
returns void language plpgsql security definer set search_path to ''
as $function$
declare
  v_lesson public.lessons%rowtype;
  v_sub public.subscriptions%rowtype;
  v_rows integer;
  v_lesson_date date;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id;
  if not found or v_lesson.status <> 'completed' then return; end if;
  v_lesson_date := (v_lesson.starts_at at time zone 'Europe/Istanbul')::date;

  if v_lesson.type = 'private' then
    for v_sub in
      select * from public.subscriptions
      where center_id = v_lesson.center_id and member_id = v_lesson.private_member_id
        and type = 'private_credits' and status = 'active'
        and starts_on <= v_lesson_date and (ends_on is null or ends_on >= v_lesson_date)
        and credits_remaining > 0
      order by starts_on, created_at limit 1 for update
    loop
      insert into public.credit_transactions(subscription_id, member_id, lesson_id, amount, reason, note)
      values (v_sub.id, v_sub.member_id, v_lesson.id, -1, 'lesson_use', 'Özel ders yapıldı')
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then update public.subscriptions set credits_remaining = credits_remaining - 1 where id = v_sub.id; end if;
    end loop;
  elsif v_lesson.type = 'group' then
    for v_sub in
      select * from public.subscriptions
      where center_id = v_lesson.center_id and type = 'group_4_weeks'
        and status = 'active' and starts_on <= v_lesson_date
        and (ends_on is null or ends_on >= v_lesson_date) and credits_remaining > 0
      order by member_id, starts_on, created_at for update
    loop
      insert into public.credit_transactions(subscription_id, member_id, lesson_id, amount, reason, note)
      values (v_sub.id, v_sub.member_id, v_lesson.id, -1, 'lesson_use', 'Grup dersi yapıldı')
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then update public.subscriptions set credits_remaining = credits_remaining - 1 where id = v_sub.id; end if;
    end loop;
  end if;
end;
$function$;

create or replace function app_private.instructor_can_access_member_center(p_center_id uuid, p_member_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $function$
  select exists (
    select 1 from public.lessons l
    where l.center_id = p_center_id and l.instructor_id = (select auth.uid())
      and (
        l.private_member_id = p_member_id
        or exists (select 1 from public.attendance a where a.lesson_id = l.id and a.member_id = p_member_id)
      )
  )
$function$;
revoke all on function app_private.instructor_can_access_member_center(uuid, uuid) from public, anon;
grant execute on function app_private.instructor_can_access_member_center(uuid, uuid) to authenticated;

-- Replace existing broad policies with center-scoped policies.
drop policy if exists profiles_admin_manage on public.profiles;
drop policy if exists center_admins_self_read on public.center_admins;
create policy center_admins_self_read on public.center_admins for select to authenticated
using (profile_id = (select auth.uid()));

drop policy if exists organizations_admin_manage on public.organizations;
create policy organizations_admin_manage on public.organizations for all to authenticated
using ((select app_private.current_role()) = 'admin'::public.app_role)
with check ((select app_private.current_role()) = 'admin'::public.app_role);
drop policy if exists organizations_staff_read on public.organizations;
create policy organizations_staff_read on public.organizations for select to authenticated
using ((select app_private.current_role()) = any (array['admin'::public.app_role, 'instructor'::public.app_role]));

drop policy if exists centers_admin_manage on public.centers;
create policy centers_admin_manage on public.centers for all to authenticated
using ((select app_private.is_center_admin(id)))
with check ((select app_private.is_center_admin(id)));
drop policy if exists centers_staff_read on public.centers;
create policy centers_staff_read on public.centers for select to authenticated
using (
  (select app_private.current_role()) = 'instructor'::public.app_role
  or (select app_private.is_center_admin(id))
);

drop policy if exists rooms_admin_manage on public.rooms;
create policy rooms_admin_manage on public.rooms for all to authenticated
using ((select app_private.is_center_admin(center_id)))
with check ((select app_private.is_center_admin(center_id)));
drop policy if exists rooms_staff_read on public.rooms;
create policy rooms_staff_read on public.rooms for select to authenticated
using (
  (select app_private.current_role()) = 'instructor'::public.app_role
  or (select app_private.is_center_admin(center_id))
);

drop policy if exists members_admin_manage on public.members;
drop policy if exists members_staff_all_student_own on public.members;
create policy members_admin_manage on public.members for all to authenticated
using ((select app_private.is_center_admin(center_id)))
with check ((select app_private.is_center_admin(center_id)));
create policy members_read_own_or_assigned_session on public.members for select to authenticated
using (
  profile_id = (select auth.uid())
  or (select app_private.is_center_admin(center_id))
  or (
    (select app_private.current_role()) = 'instructor'::public.app_role
    and (
      exists (select 1 from public.lessons l where l.center_id = members.center_id and l.instructor_id = (select auth.uid()) and l.private_member_id = members.id)
      or exists (select 1 from public.session_requests sr where sr.center_id = members.center_id and sr.instructor_id = (select auth.uid()) and sr.private_member_id = members.id)
    )
  )
);

drop policy if exists subscriptions_admin_manage on public.subscriptions;
drop policy if exists subscriptions_staff_all_student_own on public.subscriptions;
create policy subscriptions_admin_manage on public.subscriptions for all to authenticated
using ((select app_private.is_center_admin(center_id)))
with check ((select app_private.is_center_admin(center_id)));
create policy subscriptions_read_own_or_assigned_session on public.subscriptions for select to authenticated
using (
  member_id in (select m.id from public.members m where m.profile_id = (select auth.uid()) and m.center_id = subscriptions.center_id)
  or (select app_private.is_center_admin(center_id))
  or (
    (select app_private.current_role()) = 'instructor'::public.app_role
    and (select app_private.instructor_can_access_member_center(subscriptions.center_id, subscriptions.member_id))
  )
);

drop policy if exists lessons_admin_manage on public.lessons;
drop policy if exists lessons_staff_all_student_own on public.lessons;
create policy lessons_admin_manage on public.lessons for all to authenticated
using ((select app_private.is_center_admin(center_id)))
with check ((select app_private.is_center_admin(center_id)));
create policy lessons_read_assigned_or_own on public.lessons for select to authenticated
using (
  instructor_id = (select auth.uid())
  or (select app_private.is_center_admin(center_id))
  or private_member_id in (select m.id from public.members m where m.profile_id = (select auth.uid()) and m.center_id = lessons.center_id)
  or (
    type = 'group'::public.lesson_type
    and exists (
      select 1 from public.subscriptions s join public.members m on m.id = s.member_id and m.center_id = s.center_id
      where s.center_id = lessons.center_id and m.profile_id = (select auth.uid())
        and s.type = 'group_4_weeks'::public.subscription_type and s.status = 'active'
        and s.starts_on <= (lessons.starts_at at time zone 'Europe/Istanbul')::date
        and (s.ends_on is null or s.ends_on >= (lessons.starts_at at time zone 'Europe/Istanbul')::date)
    )
  )
);

drop policy if exists attendance_staff_read on public.attendance;
drop policy if exists attendance_staff_insert on public.attendance;
drop policy if exists attendance_admin_delete on public.attendance;
create policy attendance_read_center_or_own on public.attendance for select to authenticated
using (
  member_id in (select m.id from public.members m where m.profile_id = (select auth.uid()) and m.center_id = attendance.center_id)
  or (select app_private.is_center_admin(center_id))
  or (
    (select app_private.current_role()) = 'instructor'::public.app_role
    and exists (select 1 from public.lessons l where l.id = attendance.lesson_id and l.center_id = attendance.center_id and l.instructor_id = (select auth.uid()))
  )
);
create policy attendance_insert_assigned_session on public.attendance for insert to authenticated
with check (
  (
    (select app_private.is_center_admin(center_id))
    or (
      (select app_private.current_role()) = 'instructor'::public.app_role
      and exists (select 1 from public.lessons l where l.id = attendance.lesson_id and l.center_id = attendance.center_id and l.instructor_id = (select auth.uid()))
    )
  )
  and exists (
    select 1 from public.lessons l where l.id = attendance.lesson_id and l.center_id = attendance.center_id
      and l.status not in ('cancelled'::public.lesson_status, 'postponed'::public.lesson_status)
      and (l.type = 'group'::public.lesson_type or (l.type = 'private'::public.lesson_type and l.private_member_id = attendance.member_id))
  )
);
create policy attendance_admin_delete_center on public.attendance for delete to authenticated
using ((select app_private.is_center_admin(center_id)));

drop policy if exists credit_transactions_staff_read_student_own on public.credit_transactions;
drop policy if exists credit_transactions_admin_insert on public.credit_transactions;
create policy credit_transactions_read_center_or_own on public.credit_transactions for select to authenticated
using (
  member_id in (select m.id from public.members m where m.profile_id = (select auth.uid()) and m.center_id = credit_transactions.center_id)
  or (select app_private.is_center_admin(center_id))
  or (
    (select app_private.current_role()) = 'instructor'::public.app_role
    and exists (select 1 from public.lessons l where l.id = credit_transactions.lesson_id and l.center_id = credit_transactions.center_id and l.instructor_id = (select auth.uid()))
  )
);
create policy credit_transactions_admin_insert_center on public.credit_transactions for insert to authenticated
with check (
  (select app_private.is_center_admin(center_id))
  and reason in ('admin_adjustment', 'refund')
  and exists (
    select 1 from public.subscriptions s where s.id = credit_transactions.subscription_id
      and s.member_id = credit_transactions.member_id and s.center_id = credit_transactions.center_id
  )
);

drop policy if exists session_requests_staff_read on public.session_requests;
drop policy if exists session_requests_admin_update on public.session_requests;
create policy session_requests_read_center_or_own on public.session_requests for select to authenticated
using (
  requested_by = (select auth.uid())
  or instructor_id = (select auth.uid())
  or (select app_private.is_center_admin(center_id))
);
drop policy if exists session_requests_instructor_create on public.session_requests;
create policy session_requests_admin_review_center on public.session_requests for update to authenticated
using ((select app_private.is_center_admin(center_id)))
with check ((select app_private.is_center_admin(center_id)));

-- Ensure every approved session belongs to the same center as its room and private member.
alter table public.lessons drop constraint if exists lessons_private_member_center_fkey;
alter table public.lessons add constraint lessons_private_member_center_fkey
  foreign key (private_member_id, center_id) references public.members(id, center_id) on delete restrict;


-- The approval function is redefined after the center authorization helper exists.
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
  if not (select app_private.is_center_admin(v_request.center_id)) then
    raise exception 'Bu merkezde yönetici yetkiniz yok.' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then raise exception 'Bu talep daha önce değerlendirilmiş.'; end if;
  perform set_config('app.session_request_review', 'on', true);
  if not p_approve then
    update public.session_requests set status = 'rejected', reviewed_by = (select auth.uid()),
      reviewed_at = now(), review_note = p_review_note where id = p_request_id;
    return null;
  end if;
  if not exists (
      select 1 from public.centers c join public.organizations o on o.id = c.organization_id
      where c.id = v_request.center_id and c.organization_id = v_request.organization_id and c.is_active and o.is_active
    ) or not exists (
      select 1 from public.rooms r where r.id = v_request.room_id and r.center_id = v_request.center_id and r.is_active
    ) then
    raise exception 'Merkez veya oda artık kullanılamıyor.';
  end if;
  if v_request.session_type = 'private'::public.lesson_type and not exists (
    select 1 from public.members m where m.id = v_request.private_member_id and m.center_id = v_request.center_id and m.is_active
  ) then
    raise exception 'Özel ders üyesi artık bu merkezde aktif değil.';
  end if;
  if v_request.expected_attendees > (select r.capacity from public.rooms r where r.id = v_request.room_id) then
    raise exception 'Katılımcı sayısı seçilen odanın kapasitesini aşıyor.';
  end if;
  insert into public.lessons(type, title, starts_at, ends_at, status, instructor_id, private_member_id, notes, created_by, center_id, room_id, expected_attendees)
  values (v_request.session_type, v_request.title, v_request.starts_at, v_request.ends_at, 'scheduled',
    v_request.instructor_id, v_request.private_member_id, v_request.notes, (select auth.uid()),
    v_request.center_id, v_request.room_id, v_request.expected_attendees)
  returning id into v_lesson_id;
  update public.session_requests set status = 'approved', reviewed_by = (select auth.uid()),
    reviewed_at = now(), review_note = p_review_note, approved_lesson_id = v_lesson_id where id = p_request_id;
  return v_lesson_id;
end;
$function$;
revoke all on function public.review_session_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_session_request(uuid, boolean, text) to authenticated;


-- ---------------------------------------------------------------------------
-- Captured live change: 20261011210000_complete_center_isolation.sql
-- ---------------------------------------------------------------------------
-- Tighten center-level isolation and instructor authorization to actual assigned sessions.
-- A pending request is a proposal, not an authorization grant to a member.

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


-- ---------------------------------------------------------------------------
-- Captured live change: 20261012033035_notifications_reporting.sql
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  center_id uuid references public.centers(id) on delete cascade,
  type text not null check (type in ('session_request_created', 'session_request_approved', 'session_request_rejected')),
  title text not null check (length(title) between 1 and 160),
  body text not null check (length(body) between 1 and 500),
  href text not null default '/dashboard/notifications',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(recipient_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated using (recipient_id = (select auth.uid()));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
revoke all privileges on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function app_private.notify_session_request_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_center_name text;
  v_title text;
  v_body text;
  v_type text;
begin
  select c.name into v_center_name from public.centers c where c.id = new.center_id;
  if tg_op = 'INSERT' then
    v_title := 'Yeni seans talebi';
    v_body := coalesce(new.title, 'Seans') || ' · ' || coalesce(v_center_name, 'Merkez') || ' için değerlendirme bekliyor.';
    v_type := 'session_request_created';
    insert into public.notifications (recipient_id, organization_id, center_id, type, title, body, href)
      select p.id, new.organization_id, new.center_id, v_type, v_title, v_body, '/dashboard/session-requests'
      from public.profiles p
      join public.center_admins ca on ca.profile_id = p.id and ca.center_id = new.center_id
      where p.role = 'admin'::public.app_role;
    return new;
  end if;

  if old.status is distinct from new.status and new.status in ('approved', 'rejected') then
    v_type := case when new.status = 'approved' then 'session_request_approved' else 'session_request_rejected' end;
    v_title := case when new.status = 'approved' then 'Seans talebi onaylandı' else 'Seans talebi reddedildi' end;
    v_body := coalesce(new.title, 'Seans') || ' · ' || coalesce(v_center_name, 'Merkez') || case when new.status = 'approved' then ' talebiniz onaylandı.' else ' talebiniz reddedildi.' end;
    insert into public.notifications (recipient_id, organization_id, center_id, type, title, body, href)
      select distinct recipients.id, new.organization_id, new.center_id, v_type, v_title, v_body, '/dashboard/session-requests'
      from (values (new.requested_by), (new.instructor_id)) as recipients(id)
      where recipients.id is not null;
  end if;
  return new;
end;
$function$;
revoke all on function app_private.notify_session_request_changes() from public, anon, authenticated;
drop trigger if exists session_request_notification_insert on public.session_requests;
create trigger session_request_notification_insert after insert on public.session_requests for each row execute function app_private.notify_session_request_changes();
drop trigger if exists session_request_notification_review on public.session_requests;
create trigger session_request_notification_review after update of status on public.session_requests for each row execute function app_private.notify_session_request_changes();


-- ---------------------------------------------------------------------------
-- Captured live change: 20261012033207_harden_notification_updates.sql
-- ---------------------------------------------------------------------------
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;


-- ---------------------------------------------------------------------------
-- Captured live change: 20261012033310_restrict_notification_privileges.sql
-- ---------------------------------------------------------------------------
revoke all privileges on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;


-- ---------------------------------------------------------------------------
-- Captured live change: 20261012034617_route_session_request_notifications_to_correct_recipients.sql
-- ---------------------------------------------------------------------------
create or replace function app_private.notify_session_request_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_center_name text;
  v_requester_role public.app_role;
  v_title text;
  v_body text;
  v_type text;
begin
  select c.name into v_center_name
  from public.centers c
  where c.id = new.center_id;

  if tg_op = 'INSERT' then
    select p.role into v_requester_role
    from public.profiles p
    where p.id = new.requested_by;

    if v_requester_role = 'admin'::public.app_role then
      v_title := 'Yeni seans planlama talebi';
      v_body := coalesce(new.title, 'Seans') || ' · ' ||
        coalesce(v_center_name, 'Merkez') || ' için size bir ders planlama talebi gönderildi.';
      v_type := 'session_request_created';
      insert into public.notifications
        (recipient_id, organization_id, center_id, type, title, body, href)
      select p.id, new.organization_id, new.center_id, v_type, v_title, v_body,
        '/dashboard/session-requests'
      from public.profiles p
      where p.id = new.instructor_id
        and p.role = 'instructor'::public.app_role;
    else
      v_title := 'Yeni seans talebi';
      v_body := coalesce(new.title, 'Seans') || ' · ' ||
        coalesce(v_center_name, 'Merkez') || ' için değerlendirme bekliyor.';
      v_type := 'session_request_created';
      insert into public.notifications
        (recipient_id, organization_id, center_id, type, title, body, href)
      select p.id, new.organization_id, new.center_id, v_type, v_title, v_body,
        '/dashboard/session-requests'
      from public.profiles p
      join public.center_admins ca
        on ca.profile_id = p.id and ca.center_id = new.center_id
      where p.role = 'admin'::public.app_role;
    end if;
    return new;
  end if;

  if old.status is distinct from new.status
    and new.status in ('approved', 'rejected') then
    v_type := case when new.status = 'approved'
      then 'session_request_approved' else 'session_request_rejected' end;
    v_title := case when new.status = 'approved'
      then 'Seans talebi onaylandı' else 'Seans talebi reddedildi' end;
    v_body := coalesce(new.title, 'Seans') || ' · ' ||
      coalesce(v_center_name, 'Merkez') ||
      case when new.status = 'approved'
        then ' talebiniz onaylandı.' else ' talebiniz reddedildi.' end;
    insert into public.notifications
      (recipient_id, organization_id, center_id, type, title, body, href)
    select distinct recipients.id, new.organization_id, new.center_id,
      v_type, v_title, v_body, '/dashboard/session-requests'
    from (values (new.requested_by), (new.instructor_id)) as recipients(id)
    where recipients.id is not null;
  end if;

  return new;
end;
$function$;

revoke all on function app_private.notify_session_request_changes()
  from public, anon, authenticated;
