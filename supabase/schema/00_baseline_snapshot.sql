-- StudioSaaS baseline schema snapshot
--
-- Reconstructed on 2026-10-11 by introspecting the live StudioSaaS project
-- (ysplylnwdfwizmuxvcqg): tables, enums, constraints, indexes, functions, triggers and RLS
-- policies. It already INCLUDES the effect of the migrations in ../migrations
-- (fix_group_lesson_visibility_for_open_ended_packages and harden_attendance_and_credit_ledger_writes),
-- so a fresh database needs this file only for the baseline. Newer room-booking and center-isolation
-- migrations (20261011190000 and 20261011200000) are NOT included in this snapshot and must be tested/applied separately.
--
-- It replaces the three early migrations that were applied from the SQL editor and never saved here:
--   20261009135234 mvp_school_membership_attendance
--   20261009135835 remove_group_28_day_expiry
--   20261009135855 respect_cancelled_group_lessons
--
-- Not captured: Supabase platform objects (event triggers such as ensure_rls, extensions) and
-- role grants beyond the Supabase defaults. Verify with `supabase db diff` before relying on this
-- for production bootstrap.

-- ---------------------------------------------------------------------------
-- Schema and enums
-- ---------------------------------------------------------------------------
create schema if not exists app_private;
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
