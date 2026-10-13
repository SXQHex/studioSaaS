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
  v_manager boolean;
  v_instructor boolean;
begin
  v_manager := app_private.can_manage_center(p_center_id);
  v_instructor := app_private.has_center_role(p_center_id,'instructor');
  if not v_manager and not v_instructor then
    raise exception 'Bu merkezde yönetici veya eğitmen yetkiniz yok.' using errcode='42501';
  end if;
  if not v_manager then
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
      select 1 from public.center_role_assignments r
      where r.center_id=p_center_id and r.profile_id=p_instructor_id and r.role='instructor'
    ) then
      raise exception 'Bu merkeze atanmış bir eğitmen seçin.';
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

create or replace function public.review_session_request(p_request_id uuid, p_approve boolean, p_review_note text default null)
returns uuid language plpgsql security invoker set search_path to ''
as $function$
declare
  v_request public.session_requests%rowtype;
  v_lesson_id uuid;
begin
  select * into v_request from public.session_requests where id = p_request_id for update;
  if not found then raise exception 'Seans talebi bulunamadı.'; end if;
  if not (select app_private.can_manage_center(v_request.center_id)) then
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

create or replace function public.list_requestable_members(p_center_id uuid)
returns table(id uuid, full_name text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not (select app_private.has_center_role(p_center_id,'instructor')) then
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