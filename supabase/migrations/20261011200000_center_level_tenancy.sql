-- Center-level tenancy and session-scoped instructor access.
-- Organizations are branding/grouping only. Centers are the data-isolation boundary.
-- Do not apply to production until tested against a Supabase branch and reviewed.

begin;

create table if not exists public.center_admins (
  center_id uuid not null references public.centers(id) on delete restrict,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (center_id, profile_id)
);
create index if not exists center_admins_profile_idx on public.center_admins(profile_id, center_id);
alter table public.center_admins enable row level security;

-- Keep all existing records together in a single initial center. New centers are added by admins.
insert into public.organizations (id, name, slug, is_active)
values ('00000000-0000-0000-0000-000000000101', 'FTK Studio', 'ftk-studio', true)
on conflict (slug) do nothing;

insert into public.centers (id, organization_id, name, address, is_active)
select '00000000-0000-0000-0000-000000000102', o.id, 'Merkez', null, true
from public.organizations o where o.slug = 'ftk-studio'
on conflict (id) do nothing;

insert into public.rooms (id, center_id, name, capacity, is_active)
select '00000000-0000-0000-0000-000000000103', c.id, 'Salon 1', 20, true
from public.centers c where c.id = '00000000-0000-0000-0000-000000000102'
on conflict (id) do nothing;

alter table public.members add column if not exists center_id uuid references public.centers(id) on delete restrict;
update public.members set center_id = '00000000-0000-0000-0000-000000000102' where center_id is null;
alter table public.members alter column center_id set not null;
create index if not exists members_center_idx on public.members(center_id, created_at desc);
create unique index if not exists members_id_center_unique on public.members(id, center_id);

-- Existing lessons remain in the initial center. Existing roomless/undated lessons remain roomless;
-- staff can assign rooms after reviewing the current calendar, avoiding invented reservations.
update public.lessons set center_id = '00000000-0000-0000-0000-000000000102' where center_id is null;
alter table public.lessons alter column center_id set not null;
create unique index if not exists lessons_id_center_unique on public.lessons(id, center_id);

alter table public.subscriptions add column if not exists center_id uuid references public.centers(id) on delete restrict;
update public.subscriptions s set center_id = m.center_id from public.members m
where s.member_id = m.id and s.center_id is null;
alter table public.subscriptions alter column center_id set not null;
create index if not exists subscriptions_center_idx on public.subscriptions(center_id, created_at desc);
create unique index if not exists subscriptions_id_center_unique on public.subscriptions(id, center_id);

alter table public.attendance add column if not exists center_id uuid references public.centers(id) on delete restrict;
update public.attendance a set center_id = l.center_id
from public.lessons l where l.id = a.lesson_id and a.center_id is null;
alter table public.attendance alter column center_id set not null;
create index if not exists attendance_center_idx on public.attendance(center_id, checked_in_at desc);

alter table public.credit_transactions add column if not exists center_id uuid references public.centers(id) on delete restrict;
update public.credit_transactions ct set center_id = s.center_id
from public.subscriptions s where s.id = ct.subscription_id and ct.center_id is null;
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

-- Assign current admins to all currently-existing centers. Future centers are assigned by create_center().
insert into public.center_admins(center_id, profile_id)
select c.id, p.id from public.centers c cross join public.profiles p
where p.role = 'admin'::public.app_role
on conflict do nothing;

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

commit;
