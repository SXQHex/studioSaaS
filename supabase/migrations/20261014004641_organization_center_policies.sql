-- Organizational defaults/mandatory rules and bounded center overrides.
create table public.policy_definitions(
 key text primary key,label text not null,category text not null,kind text not null check(kind in ('number','boolean')),
 default_value jsonb not null,min_value integer,max_value integer,revision integer not null default 1);
insert into public.policy_definitions(key,label,category,kind,default_value,min_value,max_value) values
('private_cancel_hours','Özel ders ücretsiz iptal süresi (saat)','İptal / kredi','number','12',0,168),
('group_cancel_refund','Grup dersinde öğrenci iptalinde kredi iadesi','İptal / kredi','boolean','false',null,null),
('late_cancel_charge','Geç iptalde kredi tüket','İptal / kredi','boolean','true',null,null),
('no_show_charge','Gelmedi durumunda kredi tüket','İptal / kredi','boolean','true',null,null),
('request_min_hours','Talep için en az kaç saat önce','Talep zamanları','number','0',0,720),
('request_max_days','En ileri talep tarihi (gün)','Talep zamanları','number','90',1,365),
('request_pending_limit','Kişi başına bekleyen özel ders talebi','Talep zamanları','number','5',1,100),
('private_package_days','Özel ders paketi azami geçerlilik (gün; 0=sınırsız)','Paket geçerliliği','number','90',0,3650),
('group_package_days','Grup paketi azami geçerlilik (gün; 0=sınırsız)','Paket geçerliliği','number','0',0,3650),
('debt_blocks_requests','Borç varsa özel ders talebini engelle','Borçlu katılım','boolean','false',null,null),
('debt_blocks_enrollment','Borç varsa yeni grup kaydını engelle','Borçlu katılım','boolean','false',null,null),
('debt_blocks_attendance','Borç varsa derse katılımı engelle','Borçlu katılım','boolean','false',null,null),
('lesson_reminder_hours','Ders hatırlatması kaç saat önce','Bildirim zamanları','number','24',1,168),
('package_reminder_days','Paket bitiş hatırlatması kaç gün önce','Bildirim zamanları','number','7',1,90),
('low_credit_threshold','Düşük kredi bildirim eşiği','Bildirim zamanları','number','1',0,100);
create table public.organization_policies(
 organization_id uuid not null references public.organizations(id),key text not null references public.policy_definitions(key),
 value jsonb not null,mode text not null check(mode in ('mandatory','recommended')),
 min_value integer,max_value integer,revision integer not null default 1,updated_at timestamptz not null default now(),
 primary key(organization_id,key));
create table public.center_policy_overrides(
 center_id uuid not null references public.centers(id),key text not null references public.policy_definitions(key),
 value jsonb not null,revision integer not null default 1,updated_at timestamptz not null default now(),primary key(center_id,key));
create table public.policy_audit(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 center_id uuid references public.centers(id),key text not null references public.policy_definitions(key),
 actor_id uuid not null references public.profiles(id),action text not null,reason text not null,
 before_value jsonb,after_value jsonb,created_at timestamptz not null default now());
create table public.policy_exceptions(
 id uuid primary key default gen_random_uuid(),center_id uuid not null references public.centers(id),
 lesson_id uuid not null references public.lessons(id),member_id uuid not null references public.members(id),
 actor_id uuid not null references public.profiles(id),reason text not null,
 values_override jsonb not null,policy_snapshot jsonb not null,created_at timestamptz not null default now());
create index policy_audit_center_idx on public.policy_audit(center_id,created_at);
create index policy_audit_org_idx on public.policy_audit(organization_id,created_at);
create index policy_audit_actor_idx on public.policy_audit(actor_id);
create index policy_audit_key_idx on public.policy_audit(key);
create index policy_exceptions_lesson_idx on public.policy_exceptions(lesson_id);
create index policy_exceptions_member_idx on public.policy_exceptions(member_id);
create index policy_exceptions_actor_idx on public.policy_exceptions(actor_id);
create index organization_policies_key_idx on public.organization_policies(key);
create index center_policy_overrides_key_idx on public.center_policy_overrides(key);
alter table public.policy_definitions enable row level security;
alter table public.organization_policies enable row level security;
alter table public.center_policy_overrides enable row level security;
alter table public.policy_audit enable row level security;
alter table public.policy_exceptions enable row level security;
create function app_private.policy_org_owner(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (exists(select 1 from public.platform_role_assignments where profile_id=auth.uid() and role='appowner')
 or exists(select 1 from public.organization_role_assignments where organization_id=p_org and profile_id=auth.uid() and role='owner'));
$$;
revoke all on function app_private.policy_org_owner(uuid) from public,anon;
grant execute on function app_private.policy_org_owner(uuid) to authenticated;
create policy policy_definitions_read on public.policy_definitions for select to authenticated using(true);
create policy org_policies_read on public.organization_policies for select to authenticated using(
 app_private.policy_org_owner(organization_id) or exists(select 1 from public.centers c where c.organization_id=organization_policies.organization_id and app_private.can_manage_center(c.id)));
create policy center_overrides_read on public.center_policy_overrides for select to authenticated using(app_private.can_manage_center(center_id));
create policy policy_audit_read on public.policy_audit for select to authenticated using(app_private.policy_org_owner(organization_id) or app_private.can_manage_center(center_id));
create policy policy_exceptions_read on public.policy_exceptions for select to authenticated using(app_private.can_manage_center(center_id));
revoke all on public.policy_definitions,public.organization_policies,public.center_policy_overrides,public.policy_audit,public.policy_exceptions from public,anon,authenticated;
grant select on public.policy_definitions,public.organization_policies,public.center_policy_overrides,public.policy_audit,public.policy_exceptions to authenticated;

create function app_private.policy_resolve(p_center uuid,p_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d public.policy_definitions%rowtype;o public.organization_policies%rowtype;c public.center_policy_overrides%rowtype;oid uuid;v jsonb;src text;valid boolean;
begin
 select organization_id into oid from public.centers where id=p_center;
 if oid is null then raise exception 'Merkez bulunamadı.';end if;
 select * into d from public.policy_definitions where key=p_key;
 if not found then raise exception 'Ayar geçersiz.';end if;
 select * into o from public.organization_policies where organization_id=oid and key=p_key;
 select * into c from public.center_policy_overrides where center_id=p_center and key=p_key;
 v:=coalesce(o.value,d.default_value);src:=case when o.mode='mandatory' then 'organization_mandatory' else 'organization_default' end;
 valid:=c.value is not null and (d.kind='boolean' or ((c.value#>>'{}')::integer between coalesce(o.min_value,d.min_value) and coalesce(o.max_value,d.max_value)));
 if coalesce(o.mode,'recommended')='recommended' and valid then v:=c.value;src:='center_override';end if;
 return jsonb_build_object('value',v,'source',src,'mode',coalesce(o.mode,'recommended'),
 'definition_revision',d.revision,'organization_revision',coalesce(o.revision,0),'center_revision',coalesce(c.revision,0),
 'min',coalesce(o.min_value,d.min_value),'max',coalesce(o.max_value,d.max_value),
 'override_stored',c.value,'override_active',src='center_override');
end;$$;
create function app_private.policy_snapshot(p_center uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_object_agg(d.key,app_private.policy_resolve(p_center,d.key)) from public.policy_definitions d;
$$;
create function app_private.policy_number(p_center uuid,p_key text) returns integer language sql stable security definer set search_path='' as $$
 select (app_private.policy_resolve(p_center,p_key)->>'value')::integer;
$$;
create function app_private.policy_boolean(p_center uuid,p_key text) returns boolean language sql stable security definer set search_path='' as $$
 select (app_private.policy_resolve(p_center,p_key)->>'value')::boolean;
$$;
revoke all on function app_private.policy_resolve(uuid,text),app_private.policy_snapshot(uuid),app_private.policy_number(uuid,text),app_private.policy_boolean(uuid,text) from public,anon,authenticated;

create function app_private.policy_validate(p_key text,p_value jsonb,p_min integer,p_max integer) returns void
language plpgsql stable security definer set search_path='' as $$
declare d public.policy_definitions%rowtype;n numeric;
begin
 select * into d from public.policy_definitions where key=p_key;
 if not found or p_value is null then raise exception 'Ayar geçersiz.';end if;
 if d.kind='boolean' then
  if jsonb_typeof(p_value)<>'boolean' or p_min is not null or p_max is not null then raise exception 'Evet/hayır ayarı geçersiz.';end if;
 else
  if jsonb_typeof(p_value)<>'number' then raise exception 'Tam sayı girin.';end if;n:=(p_value#>>'{}')::numeric;
  if n<>trunc(n) or n<d.min_value or n>d.max_value or coalesce(p_min,d.min_value)<d.min_value
  or coalesce(p_max,d.max_value)>d.max_value or coalesce(p_min,d.min_value)>coalesce(p_max,d.max_value)
  or n<coalesce(p_min,d.min_value) or n>coalesce(p_max,d.max_value) then raise exception 'Değer izin verilen aralığın dışında.';end if;
 end if;
end;$$;
revoke all on function app_private.policy_validate(text,jsonb,integer,integer) from public,anon,authenticated;
create function public.policy_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare op text:=p_data->>'action';k text:=p_data->>'key';oid uuid;cid uuid;v jsonb:=p_data->'value';old jsonb;newrow jsonb;rev integer;lo integer;hi integer;md text;reason text:=trim(p_data->>'reason');
begin
 if auth.uid() is null or length(coalesce(reason,'')) not between 3 and 500 then raise exception 'Giriş ve açıklama gerekli.' using errcode='42501';end if;
 if op='organization' then
 oid:=(p_data->>'organization_id')::uuid;
 if not app_private.policy_org_owner(oid) then raise exception 'Organizasyon sahibi yetkisi gerekli.' using errcode='42501';end if;
 else
 cid:=(p_data->>'center_id')::uuid;select organization_id into oid from public.centers where id=cid;
 if not app_private.can_manage_center(cid) then raise exception 'Merkez yetkiniz yok.' using errcode='42501';end if;
 end if;
 perform 1 from public.organizations where id=oid for update;
 if not found then raise exception 'Organizasyon yok.';end if;
 if not exists(select 1 from public.policy_definitions where key=k) then raise exception 'Ayar geçersiz.';end if;
 if op='organization' then
 select to_jsonb(o),o.revision into old,rev from public.organization_policies o where organization_id=oid and key=k;
 if coalesce((p_data->>'expected_revision')::integer,-1)<>coalesce(rev,0) then raise exception 'Ayar değişti; sayfayı yenileyin.';end if;
 md:=p_data->>'mode';lo:=(p_data->>'min')::integer;hi:=(p_data->>'max')::integer;
 if md not in ('mandatory','recommended') or md is null then raise exception 'Ayar modu geçersiz.';end if;
 perform app_private.policy_validate(k,v,lo,hi);
 insert into public.organization_policies(organization_id,key,value,mode,min_value,max_value,revision)
 values(oid,k,v,md,lo,hi,1) on conflict(organization_id,key) do update set value=excluded.value,mode=excluded.mode,min_value=excluded.min_value,max_value=excluded.max_value,revision=organization_policies.revision+1,updated_at=now()
 returning to_jsonb(organization_policies.*) into newrow;
 elsif op in ('center','reset') then
 select to_jsonb(c),c.revision into old,rev from public.center_policy_overrides c where center_id=cid and key=k;
 if coalesce((p_data->>'expected_revision')::integer,-1)<>coalesce(rev,0) then raise exception 'Merkez ayarı değişti; sayfayı yenileyin.';end if;
 if op='reset' then delete from public.center_policy_overrides where center_id=cid and key=k;
 else
 select mode,min_value,max_value into md,lo,hi from public.organization_policies where organization_id=oid and key=k;
 if md='mandatory' then raise exception 'Organizasyon bu ayarı zorunlu tutuyor.';end if;
 perform app_private.policy_validate(k,v,lo,hi);
 insert into public.center_policy_overrides(center_id,key,value,revision) values(cid,k,v,1)
 on conflict(center_id,key) do update set value=excluded.value,revision=center_policy_overrides.revision+1,updated_at=now()
 returning to_jsonb(center_policy_overrides.*) into newrow;
 end if;
 else raise exception 'İşlem geçersiz.';end if;
 if k in ('request_min_hours','request_max_days') and exists(select 1 from public.centers cc where cc.organization_id=oid and (cid is null or cc.id=cid)
 and app_private.policy_number(cc.id,'request_min_hours')>24*app_private.policy_number(cc.id,'request_max_days')) then raise exception 'Talep alt süresi ileri tarih sınırını aşıyor.';end if;
 insert into public.policy_audit(organization_id,center_id,key,actor_id,action,reason,before_value,after_value) values(oid,cid,k,auth.uid(),op,reason,old,newrow);
 return '{}'::jsonb;
end;$$;
revoke all on function public.policy_command(jsonb) from public,anon;grant execute on function public.policy_command(jsonb) to authenticated;

create function public.policy_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 return jsonb_build_object(
 'definitions',(select jsonb_agg(to_jsonb(d) order by category,key) from public.policy_definitions d),
 'organizations',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'can_edit',app_private.policy_org_owner(o.id))) from public.organizations o where app_private.policy_org_owner(o.id) or exists(select 1 from public.centers c where c.organization_id=o.id and app_private.can_manage_center(c.id))),'[]'),
 'centers',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'organization_id',c.organization_id,'name',c.name,'effective',app_private.policy_snapshot(c.id))) from public.centers c where app_private.can_manage_center(c.id)),'[]'),
 'organization_policies',coalesce((select jsonb_agg(to_jsonb(p)) from public.organization_policies p where app_private.policy_org_owner(p.organization_id) or exists(select 1 from public.centers c where c.organization_id=p.organization_id and app_private.can_manage_center(c.id))),'[]'),
 'history',coalesce((select jsonb_agg(to_jsonb(x)) from(select * from public.policy_audit a where app_private.policy_org_owner(a.organization_id) or app_private.can_manage_center(a.center_id) order by created_at desc limit 50)x),'[]'),
 'exception_participants',coalesce((select jsonb_agg(jsonb_build_object('lesson_id',l.id,'member_id',m.id,'lesson_label',l.title||' · '||to_char(l.starts_at at time zone 'Europe/Istanbul','DD.MM.YYYY HH24:MI'),'member_name',m.full_name)) from public.lessons l join public.centers c on c.id=l.center_id join public.members m on m.id=l.private_member_id or exists(select 1 from public.lesson_enrollments e where e.lesson_id=l.id and e.member_id=m.id) where l.status in ('scheduled','completed') and app_private.policy_org_owner(c.organization_id)),'[]'),
 'exceptions',coalesce((select jsonb_agg(to_jsonb(x)) from(select * from public.policy_exceptions e where app_private.can_manage_center(e.center_id) order by created_at desc limit 50)x),'[]'));
end;$$;
revoke all on function public.policy_workspace() from public,anon;grant execute on function public.policy_workspace() to authenticated;

alter table public.lesson_member_outcomes add column policy_snapshot jsonb;
alter table public.subscriptions add column policy_snapshot jsonb;
alter table public.session_requests add column policy_snapshot jsonb;
create function app_private.member_has_debt(p_member uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.subscriptions s where member_id=p_member and s.amount>
 coalesce((select sum(amount) from public.manual_payments where subscription_id=s.id),0));
$$;
revoke all on function app_private.member_has_debt(uuid) from public,anon,authenticated;
create function app_private.guard_policy_request() returns trigger language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if new.session_type='private' and (tg_op='INSERT' or new.starts_at is distinct from old.starts_at or (new.status='approved' and old.status is distinct from new.status)) then
  perform pg_advisory_xact_lock(hashtextextended('request-policy:'||new.center_id::text||new.private_member_id::text,0));
  if new.starts_at<now()+make_interval(hours=>app_private.policy_number(new.center_id,'request_min_hours'))
  or new.starts_at>now()+make_interval(days=>app_private.policy_number(new.center_id,'request_max_days')) then raise exception 'Talep tarihi merkez politikasının dışında.';end if;
  if tg_op='INSERT' then
   select count(*) into n from public.session_requests where center_id=new.center_id and private_member_id=new.private_member_id and status='pending';
   if n>=app_private.policy_number(new.center_id,'request_pending_limit') then raise exception 'Bekleyen talep sınırına ulaşıldı.';end if;
  end if;
  if app_private.policy_boolean(new.center_id,'debt_blocks_requests') and app_private.member_has_debt(new.private_member_id) then raise exception 'Borç nedeniyle yeni talep/onay engellendi.';end if;
  new.policy_snapshot:=app_private.policy_snapshot(new.center_id);
 end if;
 return new;
end;$$;
create trigger session_requests_policy_guard before insert or update on public.session_requests for each row execute function app_private.guard_policy_request();
revoke all on function app_private.guard_policy_request() from public,anon,authenticated;

create function app_private.guard_policy_enrollment() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 select center_id into cid from public.lessons where id=new.lesson_id;
 if app_private.policy_boolean(cid,'debt_blocks_enrollment') then
 perform 1 from public.members where id=new.member_id for update;
 if app_private.member_has_debt(new.member_id) then raise exception 'Borç nedeniyle yeni grup kaydı engellendi.';end if;
 end if;return new;
end;$$;
create trigger lesson_enrollment_policy_guard before insert or update on public.lesson_enrollments for each row execute function app_private.guard_policy_enrollment();
revoke all on function app_private.guard_policy_enrollment() from public,anon,authenticated;

create or replace function app_private.prepare_subscription() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;days integer;
begin
 select center_id into cid from public.members where id=new.member_id;
 if cid is null then raise exception 'Üye yok.';end if;
 days:=app_private.policy_number(cid,case when new.type='group_4_weeks' then 'group_package_days' else 'private_package_days' end);
 if new.type='group_4_weeks' then new.credits_purchased:=4;end if;
 new.credits_remaining:=new.credits_purchased;
 if days>0 then
  if new.ends_on is null then new.ends_on:=new.starts_on+days;
  elsif new.ends_on>new.starts_on+days then raise exception 'Paket geçerliliği azami süreyi aşıyor.';end if;
 end if;
 new.policy_snapshot:=app_private.policy_snapshot(cid);
 return new;
end;$$;
revoke all on function app_private.prepare_subscription() from public,anon,authenticated;
create function app_private.guard_subscription_policy_history() returns trigger language plpgsql set search_path='' as $$
begin
 if new.starts_on is distinct from old.starts_on or new.ends_on is distinct from old.ends_on or new.type is distinct from old.type
 or new.policy_snapshot is distinct from old.policy_snapshot then raise exception 'Paket tarih/politika geçmişi değiştirilemez; yeni paket oluşturun.';end if;
 return new;
end;$$;
create trigger subscription_policy_history_guard before update on public.subscriptions for each row execute function app_private.guard_subscription_policy_history();
revoke all on function app_private.guard_subscription_policy_history() from public,anon,authenticated;
create or replace function app_private.lesson_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.lessons%rowtype;m public.members%rowtype;mid uuid;staff boolean;manager boolean;hrs integer;outcome text;lid uuid;op text:=p_data->>'action';s timestamptz;e timestamptz;snap jsonb;ex public.policy_exceptions%rowtype;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 if op='policy' then raise exception 'Kuralları organizasyon / merkez ayarları ekranından yönetin.';end if;
 select * into l from public.lessons where id=(p_data->>'lesson_id')::uuid for update;
 if not found then raise exception 'Ders bulunamadı.';end if;
 manager:=app_private.can_manage_center(l.center_id);
 staff:=manager or exists(select 1 from public.lesson_staff_assignments where lesson_id=l.id and profile_id=auth.uid() and role='instructor');
 if length(trim(coalesce(p_data->>'note',''))) not between 1 and 500 then raise exception 'İşlem açıklaması zorunlu.';end if;
 perform set_config('app.lesson_change_note',trim(p_data->>'note'),true);
 perform set_config('app.lesson_change_action',op,true);
 if op in ('student_cancel','no_show') then
  mid:=(p_data->>'member_id')::uuid;
  select * into m from public.members where id=mid and center_id=l.center_id;
  if not found or not (coalesce(l.private_member_id=mid,false) or exists(select 1 from public.lesson_enrollments where lesson_id=l.id and member_id=mid)) then raise exception 'Bu dersin katılımcısı seçilmelidir.';end if;
  if (op='student_cancel' and not staff and m.profile_id is distinct from auth.uid()) or (op='no_show' and not staff) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
  if op='student_cancel' and (l.status<>'scheduled' or l.starts_at<=now()) then raise exception 'Yalnızca gelecek ders iptal edilebilir.';end if;
  if op='no_show' and exists(select 1 from public.attendance where lesson_id=l.id and member_id=mid and attended) then raise exception 'Katılımı olan öğrenci gelmedi olarak işaretlenemez.';end if;
  if op='no_show' and (l.status not in ('scheduled','completed') or l.starts_at>now()) then raise exception 'Gelmeme kaydı ders başladıktan sonra girilir.';end if;
  if exists(select 1 from public.lesson_member_outcomes where lesson_id=l.id and member_id=mid) then return '{}'::jsonb;end if;

  snap:=app_private.policy_snapshot(l.center_id);
  if nullif(p_data->>'policy_exception_id','') is not null then
   select * into ex from public.policy_exceptions where id=(p_data->>'policy_exception_id')::uuid;
   if not found or ex.lesson_id<>l.id or ex.member_id<>mid or ex.actor_id<>auth.uid()
   or not app_private.policy_org_owner((select organization_id from public.centers where id=l.center_id))
   then raise exception 'Politika istisnası yetkisiz.' using errcode='42501';end if;
   snap:=ex.policy_snapshot;
  end if;
  hrs:=(snap->'private_cancel_hours'->>'value')::integer;
  outcome:=case when op='no_show' then 'no_show'
   when l.type='private' and l.starts_at-now()>=make_interval(hours=>hrs) then 'student_cancel'
   when l.type='group' and (snap->'group_cancel_refund'->>'value')::boolean then 'student_cancel'
   else 'late_cancel' end;
  insert into public.lesson_member_outcomes(lesson_id,member_id,outcome,actor_id,note,policy_snapshot)
  values(l.id,mid,outcome,auth.uid(),trim(p_data->>'note'),snap);
  if outcome in ('no_show','late_cancel') and
   (snap->(case when outcome='no_show' then 'no_show_charge' else 'late_cancel_charge' end)->>'value')::boolean
   then perform app_private.charge_lesson_member(l.id,mid);end if;
  if op='student_cancel' and l.type='private' then
   perform set_config('app.student_cancel','on',true);
   update public.lessons set status='cancelled' where id=l.id;
   perform set_config('app.student_cancel','',true);
  elsif outcome='student_cancel' then
   delete from public.lesson_enrollments where lesson_id=l.id and member_id=mid;
  end if;
  return jsonb_build_object('outcome',outcome);
 end if;
 if not staff then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if op='cancel' then
  if l.status='cancelled' then return '{}'::jsonb;end if;
  update public.lessons set status='cancelled' where id=l.id;
 elsif op='reschedule' then
  if l.status<>'scheduled' then raise exception 'Yalnızca planlanmış ders ertelenebilir.';end if;
  s:=(p_data->>'starts_at')::timestamptz;e:=(p_data->>'ends_at')::timestamptz;
  if s is null or s<=now() or e is null or e<=s then raise exception 'Yeni ders saati geçersiz.';end if;
  update public.lessons set starts_at=s,ends_at=e where id=l.id;
 elsif op='makeup' then
  if not manager or l.status not in ('cancelled','postponed') then raise exception 'Telafiyi yönetici iptal/ertelenen ders için oluşturabilir.';end if;
  if exists(select 1 from public.lessons where makeup_of=l.id) then raise exception 'Bu ders için telafi zaten oluşturuldu.';end if;
  s:=(p_data->>'starts_at')::timestamptz;e:=(p_data->>'ends_at')::timestamptz;
  if s is null or s<=now() or e is null or e<=s then raise exception 'Telafi saati geçersiz.';end if;
  insert into public.lessons(center_id,room_id,instructor_id,type,title,starts_at,ends_at,expected_attendees,private_member_id,created_by,makeup_of,group_id)
  values(l.center_id,l.room_id,l.instructor_id,l.type,l.title||' · Telafi',s,e,l.expected_attendees,l.private_member_id,auth.uid(),l.id,l.group_id) returning id into lid;
  insert into public.lesson_enrollments(lesson_id,center_id,member_id) select lid,l.center_id,member_id from public.lesson_enrollments where lesson_id=l.id;
 else raise exception 'İşlem geçersiz.';end if;
 if op='makeup' then insert into public.lesson_changes(lesson_id,actor_id,action,note,old_starts_at,new_starts_at)
 values(l.id,auth.uid(),op,trim(p_data->>'note'),l.starts_at,s);end if;
 return jsonb_build_object('id',coalesce(lid,l.id));
end;$$;

create function app_private.outcome_should_charge(p_lesson uuid,p_member uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select case outcome when 'student_cancel' then false
  when 'no_show' then coalesce((policy_snapshot->'no_show_charge'->>'value')::boolean,true)
  else coalesce((policy_snapshot->'late_cancel_charge'->>'value')::boolean,true) end
 from public.lesson_member_outcomes where lesson_id=p_lesson and member_id=p_member),true);
$$;
revoke all on function app_private.outcome_should_charge(uuid,uuid) from public,anon,authenticated;
create or replace function app_private.consume_lesson_credit(p_lesson_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.lessons%rowtype;mid uuid;
begin
 select * into l from public.lessons where id=p_lesson_id;
 if not found or l.status<>'completed' then return;end if;
 if l.type='private' then
  if app_private.outcome_should_charge(l.id,l.private_member_id) then perform app_private.charge_lesson_member(l.id,l.private_member_id);end if;
 else
  for mid in select member_id from public.attendance where lesson_id=l.id and attended
    union select member_id from public.lesson_member_outcomes where lesson_id=l.id and outcome in ('late_cancel','no_show')
  loop
   if app_private.outcome_should_charge(l.id,mid) then perform app_private.charge_lesson_member(l.id,mid);end if;
  end loop;
 end if;
end;$$;

create or replace function app_private.validate_attendance_outcome() returns trigger
language plpgsql security definer set search_path='' as $$
declare l public.lessons%rowtype;o text;snap jsonb;
begin
 select * into l from public.lessons where id=new.lesson_id for update;
 if l.status in ('cancelled','postponed') then raise exception 'İptal/ertelenen dersin yoklaması değiştirilemez.';end if;
 if l.type='group' and not exists(select 1 from public.lesson_enrollments where lesson_id=l.id and member_id=new.member_id)
 then raise exception 'Öğrenci önce bu derse kaydedilmelidir.';end if;
 if l.type='private' and l.private_member_id is distinct from new.member_id then raise exception 'Özel ders katılımcısı geçersiz.';end if;
 select outcome into o from public.lesson_member_outcomes where lesson_id=l.id and member_id=new.member_id;
 if new.attended and app_private.policy_boolean(l.center_id,'debt_blocks_attendance') and app_private.member_has_debt(new.member_id) then raise exception 'Borç nedeniyle derse katılım engellendi.';end if;
 if new.attended and o is not null then raise exception 'İptal/gelmeme kaydı olan öğrenci katıldı olarak işaretlenemez.';end if;
 if not new.attended then
  if l.starts_at>now() then raise exception 'Gelmeme kaydı ders başladıktan sonra girilir.';end if;
  if o is null then
   snap:=app_private.policy_snapshot(l.center_id);
   insert into public.lesson_member_outcomes(lesson_id,member_id,outcome,actor_id,note,policy_snapshot)
   values(l.id,new.member_id,'no_show',auth.uid(),coalesce(nullif(trim(new.notes),''),'Yoklama: gelmedi'),snap);
   if (snap->'no_show_charge'->>'value')::boolean then perform app_private.charge_lesson_member(l.id,new.member_id);end if;
  end if;
 end if;
 return new;
end;$$;
create or replace function app_private.enqueue_studio_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;total integer:=0;
begin
 insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href,dedupe_key)
 select distinct r.id,c.organization_id,l.center_id,'studio_lesson_reminder','Dersiniz yaklaşıyor',
 l.title||' · '||to_char(l.starts_at at time zone 'Europe/Istanbul','DD.MM.YYYY HH24:MI'),case when r.id=l.instructor_id then '/dashboard/lessons' else '/dashboard/my-learning' end,'lesson:'||l.id::text||':'||l.starts_at::text
 from public.lessons l join public.centers c on c.id=l.center_id cross join lateral (
 select m.profile_id id from public.members m where m.id=l.private_member_id
 union select m.profile_id from public.lesson_enrollments e join public.members m on m.id=e.member_id where e.lesson_id=l.id
 and not exists(select 1 from public.lesson_member_outcomes o where o.lesson_id=l.id and o.member_id=m.id)
 union select l.instructor_id) r
 where l.status='scheduled' and l.starts_at>now() and l.starts_at<=now()+make_interval(hours=>app_private.policy_number(l.center_id,'lesson_reminder_hours')) and r.id is not null
 on conflict do nothing;get diagnostics n=row_count;total:=total+n;
 insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href,dedupe_key)
 select m.profile_id,c.organization_id,s.center_id,'studio_package_expiry','Paketiniz bitmek üzere',
 'Kalan kredi: '||s.credits_remaining::text||coalesce(' · Bitiş: '||s.ends_on::text,''),'/dashboard/my-learning','package:'||s.id::text
 from public.subscriptions s join public.members m on m.id=s.member_id join public.centers c on c.id=s.center_id
 where s.status='active' and s.starts_on<=(now() at time zone 'Europe/Istanbul')::date and m.profile_id is not null
 and (s.credits_remaining<=app_private.policy_number(s.center_id,'low_credit_threshold') or s.ends_on<=(now() at time zone 'Europe/Istanbul')::date+app_private.policy_number(s.center_id,'package_reminder_days'))
 on conflict do nothing;get diagnostics n=row_count;return total+n;
end;$$;

-- Exception is an explicit owner-only cancellation operation, never an implicit role bypass.
create function public.policy_cancel_exception(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.lessons%rowtype;mid uuid:=(p_data->>'member_id')::uuid;oid uuid;k text;v jsonb;
snap jsonb;eid uuid;reason text:=trim(p_data->>'reason');op text:=p_data->>'operation';
begin
 select * into l from public.lessons where id=(p_data->>'lesson_id')::uuid for update;
 select organization_id into oid from public.centers where id=l.center_id;
 if auth.uid() is null or not app_private.policy_org_owner(oid) then raise exception 'İstisna yalnızca organizasyon sahibi tarafından uygulanabilir.' using errcode='42501';end if;
 if op is null or op not in ('student_cancel','no_show') or length(coalesce(reason,'')) not between 3 and 500
 or jsonb_typeof(p_data->'overrides') is distinct from 'object' or p_data->'overrides'='{}' then raise exception 'İşlem, gerekçe ve istisna değerleri gerekli.';end if;
 if exists(select 1 from public.lesson_member_outcomes where lesson_id=l.id and member_id=mid) then raise exception 'Bu katılımcının iptal/gelmeme işlemi zaten tamamlanmış.';end if;
 snap:=app_private.policy_snapshot(l.center_id);
 for k,v in select * from jsonb_each(p_data->'overrides') loop
  if k not in ('private_cancel_hours','group_cancel_refund','late_cancel_charge','no_show_charge') then raise exception 'Bu ayar için iptal istisnası verilemez.';end if;
  perform app_private.policy_validate(k,v,null,null);
  snap:=jsonb_set(snap,array[k],(snap->k)||jsonb_build_object('value',v,'source','authorized_exception'));
 end loop;
 insert into public.policy_exceptions(center_id,lesson_id,member_id,actor_id,reason,values_override,policy_snapshot)
 values(l.center_id,l.id,mid,auth.uid(),reason,p_data->'overrides',snap) returning id into eid;
 return app_private.lesson_command(jsonb_build_object('action',op,'lesson_id',l.id,'member_id',mid,'note',reason,'policy_exception_id',eid));
end;$$;
revoke all on function public.policy_cancel_exception(jsonb) from public,anon;grant execute on function public.policy_cancel_exception(jsonb) to authenticated;
create or replace function app_private.studio_workspace(p_module text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 if p_module not in ('groups','payments','lesson-operations','crm') then raise exception 'Modül geçersiz.';end if;
 if p_module<>'lesson-operations' and not exists(select 1 from public.centers c where app_private.can_manage_center(c.id)) then raise exception 'Yönetici erişimi gerekli.' using errcode='42501';end if;
 result:=jsonb_build_object(
 'centers',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'label',c.name)) from public.centers c where app_private.can_manage_center(c.id)),'[]'),
 'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'center_id',r.center_id,'label',r.name||' · '||r.capacity::text)) from public.rooms r where r.is_active and app_private.can_manage_center(r.center_id)),'[]'),
 'instructors',coalesce((select jsonb_agg(jsonb_build_object('id',a.profile_id,'center_id',a.center_id,'label',coalesce(nullif(p.full_name,''),u.email))) from public.center_role_assignments a join public.profiles p on p.id=a.profile_id join auth.users u on u.id=p.id where a.role='instructor' and app_private.can_manage_center(a.center_id)),'[]'),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'center_id',m.center_id,'label',m.full_name)) from public.members m where m.is_active and (app_private.can_manage_center(m.center_id) or m.profile_id=auth.uid() or app_private.instructor_can_access_member_center(m.center_id,m.id))),'[]'));
 if p_module='groups' then
 return result||jsonb_build_object(
 'waitlist',coalesce((select jsonb_agg(to_jsonb(w)||jsonb_build_object('group',g.name,'member',m.full_name)) from public.group_waitlist w join public.studio_groups g on g.id=w.group_id join public.members m on m.id=w.member_id where app_private.can_manage_center(g.center_id)),'[]'),
 'groups',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('label',g.name,'enrolled',(select count(*) from public.studio_group_members where group_id=g.id))) from public.studio_groups g where app_private.can_manage_center(g.center_id)),'[]'),
 'enrollments',coalesce((select jsonb_agg(jsonb_build_object('group_id',g.id,'group',g.name,'member',m.full_name,'member_id',m.id)) from public.studio_groups g join public.studio_group_members gm on gm.group_id=g.id join public.members m on m.id=gm.member_id where app_private.can_manage_center(g.center_id)),'[]'),
 'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'group',g.name,'starts_at',l.starts_at,'ends_at',l.ends_at,'status',l.status,'enrolled',(select count(*) from public.lesson_enrollments where lesson_id=l.id),'capacity',l.expected_attendees)) from public.lessons l join public.studio_groups g on g.id=l.group_id where app_private.can_manage_center(l.center_id)),'[]'));
 elsif p_module='payments' then
 return result||jsonb_build_object(
 'subscriptions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'label',m.full_name||' · '||s.type::text,'amount',s.amount,'paid',coalesce(p.total,0),'balance',s.amount-coalesce(p.total,0),'payment_status',s.payment_status)) from public.subscriptions s join public.members m on m.id=s.member_id left join lateral(select sum(amount) total from public.manual_payments where subscription_id=s.id) p on true where app_private.can_manage_center(s.center_id)),'[]'),
 'payments',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('member',m.full_name,'actor',coalesce(nullif(pr.full_name,''),(select email from auth.users where id=p.actor_id),'Aktarılan kayıt'))) from public.manual_payments p join public.subscriptions s on s.id=p.subscription_id join public.members m on m.id=s.member_id left join public.profiles pr on pr.id=p.actor_id where app_private.can_manage_center(p.center_id)),'[]'));
 elsif p_module='crm' then
 return result||jsonb_build_object(
 'leads',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('label',l.full_name)) from public.crm_leads l where app_private.can_manage_center(l.center_id)),'[]'),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('lead',l.full_name)) from public.crm_tasks t join public.crm_leads l on l.id=t.lead_id where app_private.can_manage_center(l.center_id)),'[]'));
 else
 return result||jsonb_build_object(
 'lessons',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('cancellation_hours',app_private.policy_number(l.center_id,'private_cancel_hours'),'label',l.title||' · '||to_char(l.starts_at at time zone 'Europe/Istanbul','DD.MM HH24:MI'))) from public.lessons l where app_private.can_manage_center(l.center_id) or exists(select 1 from public.lesson_staff_assignments a where a.lesson_id=l.id and a.profile_id=auth.uid() and a.role='instructor') or exists(select 1 from public.members m where m.profile_id=auth.uid() and (m.id=l.private_member_id or exists(select 1 from public.lesson_enrollments e where e.lesson_id=l.id and e.member_id=m.id)))),'[]'),
 'outcomes',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('title',l.title,'member',(select full_name from public.members where id=o.member_id))) from public.lesson_member_outcomes o join public.lessons l on l.id=o.lesson_id where app_private.can_manage_center(l.center_id) or exists(select 1 from public.lesson_staff_assignments a where a.lesson_id=l.id and a.profile_id=auth.uid() and a.role='instructor') or exists(select 1 from public.members m where m.id=o.member_id and m.profile_id=auth.uid())),'[]'),
 'changes',coalesce((select jsonb_agg(to_jsonb(ch)||jsonb_build_object('title',l.title)) from public.lesson_changes ch join public.lessons l on l.id=ch.lesson_id where app_private.can_manage_center(l.center_id) or l.instructor_id=auth.uid()),'[]'),
 'policies',coalesce((select jsonb_agg(to_jsonb(p)) from public.studio_policies p where app_private.can_manage_center(p.center_id)),'[]'));
 end if;
end;$$;

-- Stable snapshots and append-only event/exception records have no client mutation privileges.
revoke all on function app_private.lesson_command(jsonb) from public,anon;
revoke all on function app_private.consume_lesson_credit(uuid),app_private.validate_attendance_outcome(),app_private.enqueue_studio_reminders() from public,anon,authenticated;

create function app_private.guard_policy_group_member() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 select center_id into cid from public.studio_groups where id=new.group_id;
 if app_private.policy_boolean(cid,'debt_blocks_enrollment') and app_private.member_has_debt(new.member_id) then raise exception 'Borç nedeniyle gruba kayıt engellendi.';end if;
 return new;
end;$$;
create trigger group_member_policy_guard before insert on public.studio_group_members for each row execute function app_private.guard_policy_group_member();
revoke all on function app_private.guard_policy_group_member() from public,anon,authenticated;
