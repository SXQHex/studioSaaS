-- Verified Auth-account <-> center-member linking (RBAC #1 completion).
-- Privileged changes are only possible through exact confirmed e-mail matching.
create unique index if not exists members_center_profile_unique
  on public.members(center_id, profile_id) where profile_id is not null;

create table if not exists public.member_account_link_audit (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null,
  center_id uuid not null,
  old_profile_id uuid,
  new_profile_id uuid,
  actor_id uuid not null,
  changed_at timestamptz not null default now(),
  constraint member_account_link_audit_change check (
    old_profile_id is distinct from new_profile_id
  )
);
create index if not exists member_account_link_audit_center_idx
  on public.member_account_link_audit(center_id, changed_at desc);
alter table public.member_account_link_audit enable row level security;
revoke all on public.member_account_link_audit from public, anon, authenticated;
grant select on public.member_account_link_audit to authenticated;
create policy member_account_link_audit_manager_read
  on public.member_account_link_audit for select to authenticated
  using (app_private.can_manage_center(center_id));

-- Restrict member linking to audited RPC calls, not a mutable REST table column.
-- Keep ordinary create/edit/status functions working via column privileges.
revoke insert, update, truncate, references, trigger on public.members
  from anon, authenticated;
grant insert (center_id, full_name, phone, email, notes, is_active)
  on public.members to authenticated;
grant update (full_name, phone, email, notes, is_active)
  on public.members to authenticated;

create or replace function public.lookup_center_account(p_center_id uuid, p_email text)
returns table(profile_id uuid, email text, full_name text, linked_member_id uuid)
language plpgsql stable security definer set search_path to ''
as $function$
begin
  if (select auth.uid()) is null
    or not app_private.can_manage_center(p_center_id) then
    raise exception 'Bu merkez için yönetim yetkiniz yok.' using errcode = '42501';
  end if;
  if p_email is null or length(trim(p_email)) > 254 or length(trim(p_email)) < 3 then
    raise exception 'Geçerli bir hesap e-postası girin.' using errcode = 'P0001';
  end if;

  return query
    select p.id, u.email::text, p.full_name, m.id
    from auth.users u
    join public.profiles p on p.id=u.id
    left join public.members m on m.center_id=p_center_id and m.profile_id=p.id
    where lower(u.email)=lower(trim(p_email))
      and u.email_confirmed_at is not null
    limit 1;
end;
$function$;

create or replace function public.link_member_account(p_member_id uuid, p_account_email text)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare
  v_center uuid;
  v_existing_profile uuid;
  v_member_email text;
  v_profile uuid;
  v_account_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Oturum açmanız gerekiyor.' using errcode='42501';
  end if;
  select m.center_id, m.profile_id, m.email
  into v_center,v_existing_profile,v_member_email
  from public.members m where m.id=p_member_id for update;
  if not found then
    raise exception 'Üye kaydı bulunamadı.' using errcode='P0001';
  end if;
  if not app_private.can_manage_center(v_center) then
    raise exception 'Bu merkezde yetkiniz yok.' using errcode='42501';
  end if;
  if p_account_email is null or length(trim(p_account_email)) not between 3 and 254 then
    raise exception 'Geçerli bir hesap e-postası girin.' using errcode='P0001';
  end if;
  select u.id, u.email::text
  into v_profile,v_account_email
  from auth.users u join public.profiles p on p.id=u.id
  where lower(u.email)=lower(trim(p_account_email)) and u.email_confirmed_at is not null
  limit 1;
  if v_profile is null then
    raise exception 'Onaylanmış bir hesap bulunamadı.' using errcode='P0001';
  end if;
  if v_existing_profile is not null and v_existing_profile <> v_profile then
    raise exception 'Üye önce mevcut hesaptan ayrılmalıdır.' using errcode='P0001';
  end if;
  if v_member_email is not null
    and lower(trim(v_member_email)) <> lower(trim(v_account_email)) then
    raise exception 'Üye e-postası ile giriş hesabı e-postası eşleşmiyor.' using errcode='P0001';
  end if;
  if exists (select 1 from public.members m
    where m.center_id=v_center and m.profile_id=v_profile and m.id<>p_member_id) then
    raise exception 'Bu hesap aynı merkezde başka bir üyeye bağlı.' using errcode='P0001';
  end if;
  if v_existing_profile = v_profile then return v_profile; end if;
  update public.members m
  set profile_id=v_profile, email=coalesce(m.email,v_account_email)
  where m.id=p_member_id;
  insert into public.member_account_link_audit
    (member_id,center_id,old_profile_id,new_profile_id,actor_id)
  values(p_member_id,v_center,v_existing_profile,v_profile,(select auth.uid()));
  return v_profile;
end;
$function$;

create or replace function public.unlink_member_account(p_member_id uuid)
returns void language plpgsql security definer set search_path to ''
as $function$
declare
  v_center uuid;
  v_existing_profile uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Oturum açmanız gerekiyor.' using errcode='42501';
  end if;
  select m.center_id,m.profile_id into v_center,v_existing_profile
  from public.members m where m.id=p_member_id for update;
  if not found then
    raise exception 'Üye kaydı bulunamadı.' using errcode='P0001';
  end if;
  if not app_private.can_manage_center(v_center) then
    raise exception 'Bu merkezde yetkiniz yok.' using errcode='42501';
  end if;
  if v_existing_profile is null then return; end if;
  update public.members m set profile_id=null where m.id=p_member_id;
  insert into public.member_account_link_audit
    (member_id,center_id,old_profile_id,new_profile_id,actor_id)
  values(p_member_id,v_center,v_existing_profile,null,(select auth.uid()));
end;
$function$;

revoke all on function public.lookup_center_account(uuid,text) from public,anon;
revoke all on function public.link_member_account(uuid,text) from public,anon;
revoke all on function public.unlink_member_account(uuid) from public,anon;
grant execute on function public.lookup_center_account(uuid,text) to authenticated;
grant execute on function public.link_member_account(uuid,text) to authenticated;
grant execute on function public.unlink_member_account(uuid) to authenticated;

comment on function public.link_member_account(uuid,text) is
'Requires confirmed exact Auth email, same-center manager, and matching member contact email; writes audit record.';
