create or replace function public.create_center(p_organization_id uuid, p_name text, p_address text default null)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare v_center_id uuid;
begin
  if not (select app_private.is_org_owner(p_organization_id)) then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.' using errcode = '42501';
  end if;
  if length(trim(p_name)) not between 1 and 160 then raise exception 'Merkez adı geçersiz.'; end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.is_active) then
    raise exception 'Organizasyon bulunamadı veya pasif.';
  end if;
  insert into public.centers(organization_id, name, address, is_active)
  values (p_organization_id, trim(p_name), nullif(trim(p_address), ''), true)
  returning id into v_center_id;
  insert into public.center_role_assignments(center_id, profile_id, role) values (v_center_id, (select auth.uid()), 'admin');
  return v_center_id;
end;
$function$;

create or replace function public.grant_center_admin(p_center_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not (select app_private.can_manage_center(p_center_id)) then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.' using errcode = '42501';
  end if;
  if not (select app_private.can_manage_center(p_center_id)) then
    raise exception 'Bu merkezde yönetici yetkiniz yok.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_profile_id) then
    raise exception 'Profil bulunamadı.';
  end if;
  insert into public.center_role_assignments(center_id, profile_id, role) values (p_center_id, p_profile_id, 'admin')
  on conflict do nothing;
end;
$function$;

create or replace function public.revoke_center_admin(p_center_id uuid, p_profile_id uuid)
returns void language plpgsql security definer set search_path to ''
as $function$
declare v_count integer;
begin
  if not (select app_private.can_manage_center(p_center_id)) then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.' using errcode = '42501';
  end if;
  if not (select app_private.can_manage_center(p_center_id)) then
    raise exception 'Bu merkezde yönetici yetkiniz yok.' using errcode = '42501';
  end if;
  select count(*) into v_count from public.center_role_assignments where center_id = p_center_id and role = 'admin';
  if not exists (select 1 from public.center_role_assignments where center_id = p_center_id and role = 'admin' and profile_id = p_profile_id) then
    raise exception 'Bu yönetici seçilen merkezde yetkili değil.';
  end if;
  if v_count <= 1 then raise exception 'Merkezin en az bir yöneticisi kalmalıdır.'; end if;
  delete from public.center_role_assignments where center_id = p_center_id and role = 'admin' and profile_id = p_profile_id;
end;
$function$;