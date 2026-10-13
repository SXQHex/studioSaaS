-- Pending requests and alternatives never reserve a room. Only approval inserts a lesson.
alter table public.session_requests
 add column alternative_starts_at timestamptz,
 add column alternative_ends_at timestamptz,
 add column alternative_note text,
 add column alternative_proposed_by uuid references public.profiles(id) on delete set null,
 add column alternative_proposed_at timestamptz,
 add constraint session_request_alternative_window check (
   (alternative_starts_at is null and alternative_ends_at is null and alternative_proposed_at is null)
   or (status='pending' and alternative_starts_at is not null and alternative_ends_at is not null
     and alternative_proposed_at is not null and alternative_ends_at>alternative_starts_at));

create index session_requests_alternative_actor_idx on public.session_requests(alternative_proposed_by) where alternative_proposed_by is not null;

create table public.session_request_events (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.session_requests(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,
 action text not null check(action in ('created','approved','rejected','withdrawn','alternative_proposed','alternative_accepted','alternative_declined')),
 note text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index session_request_events_request_idx on public.session_request_events(request_id,created_at);
create index session_request_events_actor_idx on public.session_request_events(actor_id) where actor_id is not null;
alter table public.session_request_events enable row level security;
create policy session_request_events_scoped_read on public.session_request_events
 for select to authenticated using(exists(
 select 1 from public.session_requests r where r.id=request_id
 and (r.requested_by=(select auth.uid()) or r.instructor_id=(select auth.uid())
 or app_private.can_manage_center(r.center_id))));
revoke all on public.session_request_events from public,anon,authenticated;
grant select on public.session_request_events to authenticated;
-- No client can mutate workflow state with a crafted REST request or GUC.
revoke insert,update,delete on public.session_requests from public,authenticated,anon;

create or replace function app_private.prevent_session_request_detail_changes()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.organization_id is distinct from old.organization_id
 or new.center_id is distinct from old.center_id or new.room_id is distinct from old.room_id
 or new.instructor_id is distinct from old.instructor_id or new.requested_by is distinct from old.requested_by
 or new.session_type is distinct from old.session_type or new.title is distinct from old.title
 or new.private_member_id is distinct from old.private_member_id
 or new.expected_attendees is distinct from old.expected_attendees or new.notes is distinct from old.notes then
   raise exception 'Talep ayrıntıları değiştirilemez; yeni talep oluşturun.';
 end if;
 if (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at)
 and not (current_setting('app.session_request_alternative_accept',true) is not distinct from 'on'
   and old.status='pending' and new.status='pending'
   and new.starts_at=old.alternative_starts_at and new.ends_at=old.alternative_ends_at) then
   raise exception 'Saat yalnızca önerilen alternatif kabul edilerek değiştirilebilir.';
 end if;
 return new;
end;
$$;

create function app_private.withdraw_session_request(p_request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.session_requests%rowtype;
begin
 select * into r from public.session_requests where id=p_request_id for update;
 if not found or auth.uid() is null or r.requested_by<>auth.uid() then
   raise exception 'Yalnızca kendi talebinizi geri çekebilirsiniz.' using errcode='42501';
 end if;
 if r.status<>'pending' then raise exception 'Yalnızca bekleyen talep geri çekilebilir.'; end if;
 perform set_config('app.session_request_review','on',true);
 update public.session_requests set status='cancelled',reviewed_by=auth.uid(),reviewed_at=now(),
   review_note='Talep sahibi tarafından geri çekildi.',alternative_starts_at=null,
   alternative_ends_at=null,alternative_note=null,alternative_proposed_by=null,alternative_proposed_at=null
 where id=p_request_id;
end;
$$;
create function public.withdraw_session_request(p_request_id uuid)
returns void language sql security invoker set search_path=''
as $$ select app_private.withdraw_session_request(p_request_id); $$;

create function app_private.propose_session_request_alternative(
 p_request_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.session_requests%rowtype;
begin
 select * into r from public.session_requests where id=p_request_id for update;
 if not found or auth.uid() is null or not app_private.can_manage_center(r.center_id) then
   raise exception 'Bu merkezde yönetici yetkiniz yok.' using errcode='42501';
 end if;
 if r.status<>'pending' or r.session_type<>'private' then
   raise exception 'Yalnızca bekleyen özel ders için alternatif önerilebilir.';
 end if;
 if p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at or p_starts_at<=now() then
   raise exception 'Gelecekte başlayan geçerli bir saat aralığı seçin.';
 end if;
 if p_note is null or length(trim(p_note)) not between 1 and 500 then
   raise exception 'Alternatif saat için açıklama girin.';
 end if;
 update public.session_requests set alternative_starts_at=p_starts_at,alternative_ends_at=p_ends_at,
 alternative_note=trim(p_note),alternative_proposed_by=auth.uid(),alternative_proposed_at=clock_timestamp()
 where id=p_request_id;
end;
$$;
create function public.propose_session_request_alternative(
 p_request_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_note text)
returns void language sql security invoker set search_path=''
as $$ select app_private.propose_session_request_alternative(p_request_id,p_starts_at,p_ends_at,p_note); $$;

create function app_private.respond_session_request_alternative(
 p_request_id uuid,p_proposed_at timestamptz,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare r public.session_requests%rowtype;
begin
 select * into r from public.session_requests where id=p_request_id for update;
 if not found or auth.uid() is null or r.requested_by<>auth.uid() then
   raise exception 'Yalnızca kendi talebinize yanıt verebilirsiniz.' using errcode='42501';
 end if;
 if r.status<>'pending' or r.alternative_proposed_at is null
 or p_proposed_at is null or r.alternative_proposed_at<>p_proposed_at then
   raise exception 'Alternatif öneri değişti veya artık geçerli değil. Sayfayı yenileyin.';
 end if;
 if p_accept is null then raise exception 'Yanıt geçersiz.'; end if;
 if p_accept and r.alternative_starts_at<=now() then raise exception 'Önerilen saat geçmişte kaldı.'; end if;
 perform set_config('app.session_request_alternative_accept','on',true);
 perform set_config('app.session_request_alternative_response',case when p_accept then 'accepted' else 'declined' end,true);
 update public.session_requests set
 starts_at=case when p_accept then r.alternative_starts_at else r.starts_at end,
 ends_at=case when p_accept then r.alternative_ends_at else r.ends_at end,
 alternative_starts_at=null,alternative_ends_at=null,alternative_note=null,
 alternative_proposed_by=null,alternative_proposed_at=null where id=p_request_id;
end;
$$;
create function public.respond_session_request_alternative(
 p_request_id uuid,p_proposed_at timestamptz,p_accept boolean)
returns void language sql security invoker set search_path=''
as $$ select app_private.respond_session_request_alternative(p_request_id,p_proposed_at,p_accept); $$;

create or replace function app_private.review_session_request(p_request_id uuid, p_approve boolean, p_review_note text default null)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare
  v_request public.session_requests%rowtype;
  v_lesson_id uuid;
begin
  select * into v_request from public.session_requests where id = p_request_id for update;
  if not found then raise exception 'Seans talebi bulunamadı.'; end if;
  if auth.uid() is null or not (select app_private.can_manage_center(v_request.center_id)) then
    raise exception 'Bu merkezde yönetici yetkiniz yok.' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then raise exception 'Bu talep daha önce değerlendirilmiş.'; end if;
  if p_approve is null then raise exception 'Karar geçersiz.'; end if;
  if p_review_note is not null and length(trim(p_review_note))>500 then raise exception 'Değerlendirme notu çok uzun.'; end if;
  if not p_approve and (p_review_note is null or length(trim(p_review_note))=0) then
    raise exception 'Ret gerekçesi zorunludur.';
  end if;
  if p_approve and v_request.alternative_proposed_at is not null then
    raise exception 'Alternatif saat talep sahibi tarafından yanıtlanmalıdır.';
  end if;
  perform set_config('app.session_request_review', 'on', true);
  if not p_approve then
    update public.session_requests set status = 'rejected', reviewed_by = (select auth.uid()),
      reviewed_at = now(), review_note = trim(p_review_note),
      alternative_starts_at=null,alternative_ends_at=null,alternative_note=null,
      alternative_proposed_by=null,alternative_proposed_at=null where id = p_request_id;
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
  if v_request.starts_at<=now() then raise exception 'Geçmişte başlayan talep kesinleştirilemez.'; end if;
  if not exists(select 1 from public.center_role_assignments a where a.center_id=v_request.center_id
    and a.profile_id=v_request.instructor_id and a.role='instructor') then
    raise exception 'Eğitmen artık bu merkeze atanmış değil.';
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



create or replace function public.review_session_request(p_request_id uuid,p_approve boolean,p_review_note text default null)
returns uuid language sql security invoker set search_path=''
as $$ select app_private.review_session_request(p_request_id,p_approve,p_review_note); $$;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
check(type in ('session_request_created','session_request_approved','session_request_rejected','session_request_updated'));

create function app_private.record_session_request_workflow()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_action text; v_note text; v_details jsonb; v_title text;
begin
 if tg_op='INSERT' then
   v_action:='created'; v_note:=new.notes;
 elsif new.status is distinct from old.status then
   v_action:=case new.status when 'cancelled' then 'withdrawn' when 'approved' then 'approved' when 'rejected' then 'rejected' end;
   v_note:=new.review_note;
 elsif new.alternative_proposed_at is distinct from old.alternative_proposed_at then
   if new.alternative_proposed_at is not null then
     v_action:='alternative_proposed';v_note:=new.alternative_note;
   else
     v_action:=case when current_setting('app.session_request_alternative_response',true)='accepted'
       then 'alternative_accepted' else 'alternative_declined' end;
     v_note:=old.alternative_note;
   end if;
 else return new;
 end if;
 if v_action is null then return new; end if;
 v_details:=jsonb_build_object('starts_at',new.starts_at,'ends_at',new.ends_at,
   'alternative_starts_at',new.alternative_starts_at,'alternative_ends_at',new.alternative_ends_at);
 if tg_op='UPDATE' then
   v_details:=v_details||jsonb_build_object('previous_starts_at',old.starts_at,'previous_ends_at',old.ends_at,
     'previous_alternative_starts_at',old.alternative_starts_at,'previous_alternative_ends_at',old.alternative_ends_at);
 end if;
 insert into public.session_request_events(request_id,actor_id,action,note,details)
 values(new.id,auth.uid(),v_action,v_note,v_details);
 if v_action in ('withdrawn','alternative_proposed','alternative_accepted','alternative_declined') then
   v_title:=case v_action when 'withdrawn' then 'Talep geri çekildi'
     when 'alternative_proposed' then 'Alternatif saat önerildi'
     when 'alternative_accepted' then 'Alternatif kabul edildi; onay bekliyor'
     else 'Alternatif saat kabul edilmedi' end;
   insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href)
   select distinct recipients.id,new.organization_id,new.center_id,'session_request_updated',v_title,
     new.title||' · '||coalesce(v_note,''),'/dashboard/session-requests'
   from (
     select new.requested_by as id union select new.instructor_id
     union select a.profile_id from public.center_role_assignments a where a.center_id=new.center_id and a.role='admin'
     union select a.profile_id from public.organization_role_assignments a where a.organization_id=new.organization_id and a.role='owner'
     union select a.profile_id from public.platform_role_assignments a where a.role='appowner'
   ) recipients where recipients.id is not null and recipients.id is distinct from auth.uid();
 end if;
 return new;
end;
$$;
create trigger session_request_workflow_audit after insert or update on public.session_requests
for each row execute function app_private.record_session_request_workflow();
revoke all on function app_private.record_session_request_workflow() from public,anon,authenticated;

revoke all on function app_private.withdraw_session_request(uuid),app_private.propose_session_request_alternative(uuid,timestamptz,timestamptz,text),
 app_private.respond_session_request_alternative(uuid,timestamptz,boolean),app_private.review_session_request(uuid,boolean,text)
 from public,anon;
grant execute on function app_private.withdraw_session_request(uuid),app_private.propose_session_request_alternative(uuid,timestamptz,timestamptz,text),
 app_private.respond_session_request_alternative(uuid,timestamptz,boolean),app_private.review_session_request(uuid,boolean,text)
 to authenticated;
revoke all on function public.withdraw_session_request(uuid),public.propose_session_request_alternative(uuid,timestamptz,timestamptz,text),
 public.respond_session_request_alternative(uuid,timestamptz,boolean),public.review_session_request(uuid,boolean,text)
 from public,anon;
grant execute on function public.withdraw_session_request(uuid),public.propose_session_request_alternative(uuid,timestamptz,timestamptz,text),
 public.respond_session_request_alternative(uuid,timestamptz,boolean),public.review_session_request(uuid,boolean,text)
 to authenticated;
