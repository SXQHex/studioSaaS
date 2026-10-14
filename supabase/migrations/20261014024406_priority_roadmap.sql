
-- Resource planning: draft group blocks are informational; only closures are hard blocks.
create table public.resource_hours (
 id uuid primary key default gen_random_uuid(), center_id uuid not null references public.centers,
 resource_kind text not null check(resource_kind in ('center','room','instructor')),
 resource_id uuid, weekday integer not null check(weekday between 1 and 7),
 opens time not null, closes time not null check(closes>opens),
 check((resource_kind='center')=(resource_id is null))
);
create unique index resource_hours_unique on public.resource_hours(center_id,resource_kind,coalesce(resource_id,'00000000-0000-0000-0000-000000000000'::uuid),weekday,opens);
create table public.resource_blocks (
 id uuid primary key default gen_random_uuid(), center_id uuid not null references public.centers,
 resource_kind text not null check(resource_kind in ('center','room','instructor')),
 resource_id uuid, starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at),
 kind text not null check(kind in ('closed','group_draft')), title text not null check(length(title) between 1 and 160),
 check((resource_kind='center')=(resource_id is null))
);
create index resource_blocks_range on public.resource_blocks(center_id,starts_at,ends_at);
alter table public.resource_hours enable row level security;
alter table public.resource_blocks enable row level security;
create policy resource_hours_read on public.resource_hours for select to authenticated using(app_private.can_manage_center(center_id));
create policy resource_blocks_read on public.resource_blocks for select to authenticated using(app_private.can_manage_center(center_id));
revoke all on public.resource_hours,public.resource_blocks from public,anon,authenticated;
grant select on public.resource_hours,public.resource_blocks to authenticated;

create function app_private.check_resource(p_center uuid,p_kind text,p_resource uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_kind='center' and p_resource is null then return;
 elsif p_kind='room' and exists(select 1 from public.rooms where id=p_resource and center_id=p_center and is_active) then return;
 elsif p_kind='instructor' and exists(select 1 from public.center_role_assignments where profile_id=p_resource and center_id=p_center and role='instructor') then return;
 end if;
 raise exception 'Kaynak bu merkezde bulunamadı.';
end;$$;
revoke all on function app_private.check_resource(uuid,text,uuid) from public,anon,authenticated;

create function app_private.resource_available(p_center uuid,p_kind text,p_resource uuid,p_start timestamptz,p_end timestamptz) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.resource_blocks b where b.center_id=p_center and b.resource_kind=p_kind
 and b.resource_id is not distinct from p_resource and b.kind='closed' and b.starts_at<p_end and b.ends_at>p_start)
 and (not exists(select 1 from public.resource_hours h where h.center_id=p_center and h.resource_kind=p_kind and h.resource_id is not distinct from p_resource and h.weekday=extract(isodow from p_start at time zone 'Europe/Istanbul'))
 or exists(select 1 from public.resource_hours h where h.center_id=p_center and h.resource_kind=p_kind and h.resource_id is not distinct from p_resource
 and h.weekday=extract(isodow from p_start at time zone 'Europe/Istanbul')
 and (p_start at time zone 'Europe/Istanbul')::date=(p_end at time zone 'Europe/Istanbul')::date
 and h.opens<=(p_start at time zone 'Europe/Istanbul')::time and h.closes>=(p_end at time zone 'Europe/Istanbul')::time));
$$;
revoke all on function app_private.resource_available(uuid,text,uuid,timestamptz,timestamptz) from public,anon,authenticated;
create function app_private.guard_resource_lesson() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='scheduled' and (tg_op='INSERT' or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or new.room_id is distinct from old.room_id or new.instructor_id is distinct from old.instructor_id or new.status is distinct from old.status) then
 perform pg_advisory_xact_lock(hashtextextended(new.center_id::text,71));
 if not app_private.resource_available(new.center_id,'center',null,new.starts_at,new.ends_at)
 or not app_private.resource_available(new.center_id,'room',new.room_id,new.starts_at,new.ends_at)
 or not app_private.resource_available(new.center_id,'instructor',new.instructor_id,new.starts_at,new.ends_at)
 then raise exception 'Ders çalışma saatleri dışında veya izin/kapanış ile çakışıyor.';end if;
 end if;return new;
end;$$;
create trigger resource_lesson_guard before insert or update on public.lessons for each row execute function app_private.guard_resource_lesson();
revoke all on function app_private.guard_resource_lesson() from public,anon,authenticated;

create function public.planning_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=(p_data->>'center_id')::uuid;rid uuid:=nullif(p_data->>'resource_id','')::uuid;k text:=p_data->>'resource_kind';op text:=p_data->>'action';rec uuid;
begin
 if auth.uid() is null or not app_private.can_manage_center(cid) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(cid::text,71));
 if op in ('delete_hours','delete_block') then
 if op='delete_hours' then delete from public.resource_hours where id=(p_data->>'id')::uuid and center_id=cid;
 else delete from public.resource_blocks where id=(p_data->>'id')::uuid and center_id=cid;end if;
 if not found then raise exception 'Kayıt yok.';end if;return '{}';end if;
 perform app_private.check_resource(cid,k,rid);
 if op='hours' then
 insert into public.resource_hours(center_id,resource_kind,resource_id,weekday,opens,closes) values(cid,k,rid,(p_data->>'weekday')::integer,(p_data->>'opens')::time,(p_data->>'closes')::time) returning id into rec;
 -- New hours cannot invalidate existing confirmed reservations for this resource.
 if exists(select 1 from public.lessons l where l.center_id=cid and l.status='scheduled' and l.starts_at>now()
 and (k='center' or (k='room' and l.room_id=rid) or (k='instructor' and l.instructor_id=rid))
 and not app_private.resource_available(cid,k,rid,l.starts_at,l.ends_at)) then raise exception 'Çalışma saatleri mevcut kesin derslerle çakışıyor. Önce dersleri düzenleyin.';end if;
 elsif op='block' then
 if p_data->>'kind'='closed' and exists(select 1 from public.lessons l where l.center_id=cid and l.status='scheduled'
 and l.starts_at<(p_data->>'ends_at')::timestamptz and l.ends_at>(p_data->>'starts_at')::timestamptz
 and (k='center' or (k='room' and l.room_id=rid) or (k='instructor' and l.instructor_id=rid))) then raise exception 'İzin/kapanış kesin dersle çakışıyor. Önce dersi düzenleyin.';end if;
 insert into public.resource_blocks(center_id,resource_kind,resource_id,starts_at,ends_at,kind,title)
 values(cid,k,rid,(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz,p_data->>'kind',trim(p_data->>'title')) returning id into rec;
 else raise exception 'İşlem geçersiz.';end if;
 return jsonb_build_object('id',rec);
end;$$;
revoke all on function public.planning_command(jsonb) from public,anon;
grant execute on function public.planning_command(jsonb) to authenticated;

create function public.planning_workspace(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a timestamptz:=p_from::timestamp at time zone 'Europe/Istanbul';b timestamptz:=(p_to+1)::timestamp at time zone 'Europe/Istanbul';
begin
 if auth.uid() is null or not exists(select 1 from public.centers c where app_private.can_manage_center(c.id)) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>31 then raise exception 'En fazla 31 günlük aralık seçin.';end if;
 return public.studio_workspace('groups')||jsonb_build_object(
 'lessons',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('room',r.name,'instructor',p.full_name)) from public.lessons l left join public.rooms r on r.id=l.room_id left join public.profiles p on p.id=l.instructor_id where app_private.can_manage_center(l.center_id) and l.starts_at<b and l.ends_at>a),'[]'),
 'requests',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('room',r.name,'instructor',p.full_name)) from public.session_requests s left join public.rooms r on r.id=s.room_id left join public.profiles p on p.id=s.instructor_id where app_private.can_manage_center(s.center_id) and s.status in ('pending','alternative_proposed') and s.starts_at<b and s.ends_at>a),'[]'),
 'hours',coalesce((select jsonb_agg(to_jsonb(h)) from public.resource_hours h where app_private.can_manage_center(h.center_id)),'[]'),
 'blocks',coalesce((select jsonb_agg(to_jsonb(h)) from public.resource_blocks h where app_private.can_manage_center(h.center_id) and h.starts_at<b and h.ends_at>a),'[]'));
end;$$;
revoke all on function public.planning_workspace(date,date) from public,anon;grant execute on function public.planning_workspace(date,date) to authenticated;

-- Include identity in the payment snapshot so student-row shortcuts scope package choices.
alter function app_private.studio_workspace(text) rename to studio_workspace_legacy;
create function app_private.studio_workspace(p_module text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;begin
 r:=app_private.studio_workspace_legacy(p_module);
 if p_module='payments' then
 r:=jsonb_set(r,'{subscriptions}',coalesce((select jsonb_agg(x||jsonb_build_object('member_id',s.member_id)) from jsonb_array_elements(r->'subscriptions') x join public.subscriptions s on s.id=(x->>'id')::uuid),'[]'));
 end if;return r;
end;$$;
revoke all on function app_private.studio_workspace_legacy(text) from public,anon,authenticated;
revoke all on function app_private.studio_workspace(text) from public,anon;
grant execute on function app_private.studio_workspace(text) to authenticated;

-- Immutable policy publications and per-member acceptances.
create table public.registration_policies(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 center_id uuid references public.centers, title text not null check(length(title) between 1 and 160),
 body text not null check(length(body) between 1 and 20000), required boolean not null default true,
 created_by uuid not null references public.profiles, published_at timestamptz not null default now(),
 retired_at timestamptz
);
create index registration_policy_scope on public.registration_policies(organization_id,center_id);
create table public.registration_acceptances(
 member_id uuid not null references public.members, policy_id uuid not null references public.registration_policies,
 accepted_by uuid not null references public.profiles, accepted_at timestamptz not null default now(),
 primary key(member_id,policy_id)
);
create index registration_acceptances_policy on public.registration_acceptances(policy_id);
create index registration_acceptances_actor on public.registration_acceptances(accepted_by);
create table public.registration_details(
 member_id uuid primary key references public.members, phone text not null default '',
 emergency_name text not null default '', emergency_phone text not null default '',
 marketing_opt_in boolean not null default false, updated_at timestamptz not null default now()
);
create table public.registration_documents(
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.members,
 title text not null check(length(title) between 1 and 160),object_path text not null unique,
 uploaded_by uuid not null references public.profiles, created_at timestamptz not null default now()
);
create index registration_documents_member on public.registration_documents(member_id);
create index registration_documents_uploader on public.registration_documents(uploaded_by);
create table public.registration_requirements(
 center_id uuid primary key references public.centers, emergency_contact boolean not null default false,
 document_required boolean not null default false
);
create function app_private.can_access_registration(p_member uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.members m where m.id=p_member and (m.profile_id=auth.uid() or app_private.can_manage_center(m.center_id)));
$$;
revoke all on function app_private.can_access_registration(uuid) from public,anon;grant execute on function app_private.can_access_registration(uuid) to authenticated;
do $$declare t text;begin
 foreach t in array array['registration_policies','registration_acceptances','registration_details','registration_documents','registration_requirements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;end;$$;
grant select on public.registration_documents to authenticated;
create policy registration_documents_read on public.registration_documents for select to authenticated using(app_private.can_access_registration(member_id));
-- Platform Storage exists on hosted/local Supabase, but lightweight SQL contract fixtures can omit it.
do $$begin
 if to_regclass('storage.buckets') is not null then
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('registration-documents','registration-documents',false,5242880,array['application/pdf','image/jpeg','image/png']) on conflict(id) do nothing;
 execute $p$create policy registration_upload on storage.objects for insert to authenticated with check(bucket_id='registration-documents' and split_part(name,'/',1)=auth.uid()::text and app_private.can_access_registration(split_part(name,'/',2)::uuid))$p$;
 execute $p$create policy registration_download on storage.objects for select to authenticated using(bucket_id='registration-documents' and exists(select 1 from public.registration_documents d where d.object_path=name and app_private.can_access_registration(d.member_id)))$p$;
 end if;
end;$$;

create function public.registration_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 return jsonb_build_object(
 'centers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'organization_id',organization_id,'label',name)) from public.centers c where app_private.can_manage_center(c.id)),'[]'),
 'members',coalesce((select jsonb_agg(to_jsonb(m)||coalesce(to_jsonb(d)-'member_id','{}')||jsonb_build_object('label',m.full_name,'organization_id',c.organization_id,'missing',
 concat_ws(' · ',case when nullif(trim(coalesce(d.phone,m.phone)), '') is null then 'Telefon' end,
 case when coalesce(req.emergency_contact,false) and (nullif(trim(d.emergency_name),'') is null or nullif(trim(d.emergency_phone),'') is null) then 'Acil iletişim' end,
 case when coalesce(req.document_required,false) and not exists(select 1 from public.registration_documents doc where doc.member_id=m.id) then 'Belge' end,
 case when exists(select 1 from public.registration_policies p where p.organization_id=c.organization_id and (p.center_id is null or p.center_id=m.center_id) and p.required and p.retired_at is null and not exists(select 1 from public.registration_acceptances a where a.member_id=m.id and a.policy_id=p.id)) then 'Kural kabulü' end)))
 from public.members m join public.centers c on c.id=m.center_id left join public.registration_details d on d.member_id=m.id left join public.registration_requirements req on req.center_id=m.center_id where app_private.can_access_registration(m.id)),'[]'),
 'policies',coalesce((select jsonb_agg(to_jsonb(p)) from public.registration_policies p where p.retired_at is null and (app_private.policy_org_owner(p.organization_id) or exists(select 1 from public.centers c where c.organization_id=p.organization_id and (p.center_id is null or p.center_id=c.id) and app_private.can_manage_center(c.id)) or exists(select 1 from public.members m join public.centers c on c.id=m.center_id where c.organization_id=p.organization_id and (p.center_id is null or p.center_id=m.center_id) and app_private.can_access_registration(m.id)))),'[]'),
 'acceptances',coalesce((select jsonb_agg(to_jsonb(a)) from public.registration_acceptances a where app_private.can_access_registration(a.member_id)),'[]'),
 'documents',coalesce((select jsonb_agg(to_jsonb(d)) from public.registration_documents d where app_private.can_access_registration(d.member_id)),'[]'),
 'requirements',coalesce((select jsonb_agg(to_jsonb(r)) from public.registration_requirements r where app_private.can_manage_center(r.center_id)),'[]'));
end;$$;
revoke all on function public.registration_workspace() from public,anon;grant execute on function public.registration_workspace() to authenticated;

create function public.registration_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare op text:=p_data->>'action';mid uuid:=(p_data->>'member_id')::uuid;cid uuid:=(p_data->>'center_id')::uuid;org uuid;pol public.registration_policies%rowtype;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 if op='publish' then
 if cid is not null then select organization_id into org from public.centers where id=cid;
 else org:=(p_data->>'organization_id')::uuid;end if;
 if (cid is null and not app_private.policy_org_owner(org)) or (cid is not null and not app_private.can_manage_center(cid)) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 -- Publications are new versions. Retiring a version retains every acceptance.
 insert into public.registration_policies(organization_id,center_id,title,body,required,created_by) values(org,cid,trim(p_data->>'title'),trim(p_data->>'body'),coalesce((p_data->>'required')::boolean,true),auth.uid());
 elsif op='retire' then
 select * into pol from public.registration_policies where id=(p_data->>'policy_id')::uuid for update;
 if not found or not (case when pol.center_id is null then app_private.policy_org_owner(pol.organization_id) else app_private.can_manage_center(pol.center_id) end) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 update public.registration_policies set retired_at=coalesce(retired_at,now()) where id=pol.id;
 elsif op='requirements' then
 if not app_private.can_manage_center(cid) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 insert into public.registration_requirements values(cid,(p_data->>'emergency_contact')::boolean,(p_data->>'document_required')::boolean) on conflict(center_id) do update set emergency_contact=excluded.emergency_contact,document_required=excluded.document_required;
 else
 -- Only the linked student can give acceptance/marketing consent or edit self details.
 if not exists(select 1 from public.members where id=mid and profile_id=auth.uid()) then raise exception 'Kendi öğrenci kaydınızı seçin.' using errcode='42501';end if;
 if op='details' then
 if length(trim(coalesce(p_data->>'phone',''))) not between 7 and 40 or length(coalesce(p_data->>'emergency_name',''))>160 or length(coalesce(p_data->>'emergency_phone',''))>40 then raise exception 'İletişim bilgileri geçersiz.';end if;
 insert into public.registration_details(member_id,phone,emergency_name,emergency_phone,marketing_opt_in) values(mid,trim(p_data->>'phone'),trim(p_data->>'emergency_name'),trim(p_data->>'emergency_phone'),coalesce((p_data->>'marketing_opt_in')::boolean,false))
 on conflict(member_id) do update set phone=excluded.phone,emergency_name=excluded.emergency_name,emergency_phone=excluded.emergency_phone,marketing_opt_in=excluded.marketing_opt_in,updated_at=now();
 update public.members set phone=trim(p_data->>'phone') where id=mid;
 elsif op='accept' then
 select * into pol from public.registration_policies p where id=(p_data->>'policy_id')::uuid and retired_at is null;
 if not found or not exists(select 1 from public.members m join public.centers c on c.id=m.center_id where m.id=mid and c.organization_id=pol.organization_id and (pol.center_id is null or pol.center_id=c.id)) then raise exception 'Kural bu öğrenciye ait değil.';end if;
 insert into public.registration_acceptances(member_id,policy_id,accepted_by) values(mid,pol.id,auth.uid()) on conflict do nothing;
 elsif op='document' then
 if p_data->>'object_path' not like auth.uid()::text||'/'||mid::text||'/%' then raise exception 'Belge yolu geçersiz.';end if;
 if to_regclass('storage.objects') is null then raise exception 'Belge deposu bulunamadı.';end if;
 if not exists(select 1 from storage.objects where bucket_id='registration-documents' and name=p_data->>'object_path') then raise exception 'Önce belgeyi yükleyin.';end if;
 insert into public.registration_documents(member_id,title,object_path,uploaded_by) values(mid,trim(p_data->>'title'),p_data->>'object_path',auth.uid()) on conflict(object_path) do nothing;
 else raise exception 'İşlem geçersiz.';end if;
 end if;return '{}';
end;$$;
revoke all on function public.registration_command(jsonb) from public,anon;grant execute on function public.registration_command(jsonb) to authenticated;

-- CRM intake remains private. Only a service-side form can submit through the service_role.
create table public.crm_intake_forms(
 id uuid primary key default gen_random_uuid(),center_id uuid not null references public.centers,
 slug text not null unique check(slug ~ '^[a-z0-9-]{3,60}$'),title text not null check(length(title) between 1 and 160),
 owner_id uuid not null references public.profiles,active boolean not null default true
);
alter table public.crm_leads add column marketing_opt_in boolean not null default false;
alter table public.crm_leads add column trial_outcome text check(trial_outcome in ('attended','cancelled','no_show'));
alter table public.crm_tasks add column assigned_to uuid references public.profiles;
alter table public.crm_tasks add column automation_key text;
create unique index crm_task_automation_unique on public.crm_tasks(lead_id,automation_key) where automation_key is not null;
create index crm_task_assignee on public.crm_tasks(assigned_to);
create index crm_intake_center on public.crm_intake_forms(center_id);
create index crm_intake_owner on public.crm_intake_forms(owner_id);
alter table public.crm_intake_forms enable row level security;
revoke all on public.crm_intake_forms from public,anon,authenticated;
grant select on public.crm_intake_forms to authenticated;
create policy crm_intake_read on public.crm_intake_forms for select to authenticated using(app_private.can_manage_center(center_id));

create function public.crm_intake_submit(p_slug text,p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare f public.crm_intake_forms%rowtype;lid uuid;em text:=nullif(lower(trim(p_data->>'email')),'');ph text:=nullif(regexp_replace(coalesce(p_data->>'phone',''),'[^0-9]','','g'),'');n integer;
begin
 select * into f from public.crm_intake_forms where slug=p_slug and active;
 if not found then raise exception 'Başvuru formu kapalı.';end if;
 if length(trim(coalesce(p_data->>'full_name',''))) not between 2 and 160 or (em is null and ph is null) or length(coalesce(em,''))>320 or length(coalesce(ph,''))>20 or length(coalesce(p_data->>'interests',''))>2000 then raise exception 'Başvuru bilgileri geçersiz.';end if;
 perform pg_advisory_xact_lock(hashtextextended(f.center_id::text,79));
 select count(*),min(id::text)::uuid into n,lid from public.crm_leads where center_id=f.center_id and ((em is not null and lower(email)=em) or (ph is not null and phone=ph));
 if n>1 then raise exception 'İletişim bilgileri birden fazla kayıtla eşleşiyor.';end if;
 if lid is null then
 insert into public.crm_leads(center_id,full_name,email,phone,source,interests,created_by,marketing_opt_in) values(f.center_id,trim(p_data->>'full_name'),em,ph,'Web: '||f.slug,p_data->>'interests',f.owner_id,coalesce((p_data->>'marketing_opt_in')::boolean,false)) returning id into lid;
 end if;
 insert into public.crm_tasks(lead_id,title,due_at,created_by,assigned_to,automation_key) values(lid,'Web başvurusunu takip et',now()+interval '1 day',f.owner_id,f.owner_id,'intake') on conflict do nothing;
end;$$;
revoke all on function public.crm_intake_submit(text,jsonb) from public,anon,authenticated;grant execute on function public.crm_intake_submit(text,jsonb) to service_role;
create function app_private.crm_followup_trigger() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.trial_outcome is not null and (tg_op='INSERT' or new.trial_outcome is distinct from old.trial_outcome) then
 insert into public.crm_tasks(lead_id,title,due_at,created_by,assigned_to,automation_key)
 values(new.id,case new.trial_outcome when 'attended' then 'Deneme sonrası görüşme' when 'cancelled' then 'İptal edilen denemeyi yeniden planla' else 'Denemeye gelmeyen adayı ara' end,
 now()+interval '1 day',auth.uid(),new.created_by,'trial:'||coalesce(new.trial_at::text,'none')||':'||new.trial_outcome) on conflict do nothing;
 end if;return new;
end;$$;
create trigger crm_trial_followup after insert or update on public.crm_leads for each row execute function app_private.crm_followup_trigger();
revoke all on function app_private.crm_followup_trigger() from public,anon,authenticated;
create function public.crm_automation_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare op text:=p_data->>'action';cid uuid:=(p_data->>'center_id')::uuid;l public.crm_leads%rowtype;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 if op='form' then
 if not app_private.can_manage_center(cid) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 insert into public.crm_intake_forms(center_id,slug,title,owner_id) values(cid,p_data->>'slug',p_data->>'title',auth.uid());
 elsif op='toggle_form' then
 update public.crm_intake_forms set active=(p_data->>'active')::boolean where id=(p_data->>'id')::uuid and app_private.can_manage_center(center_id);
 if not found then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 elsif op='trial' then
 select * into l from public.crm_leads where id=(p_data->>'lead_id')::uuid for update;
 if not found or not app_private.can_manage_center(l.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if l.converted_member_id is not null then raise exception 'Üyeye dönüşen aday güncellenemez.';end if;
 update public.crm_leads set trial_outcome=p_data->>'outcome',updated_at=now() where id=l.id;
 elsif op='assign' then
 select l2.* into l from public.crm_tasks t join public.crm_leads l2 on l2.id=t.lead_id where t.id=(p_data->>'task_id')::uuid;
 if not found or not app_private.can_manage_center(l.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if not exists(select 1 from public.center_role_assignments where center_id=l.center_id and profile_id=(p_data->>'assigned_to')::uuid and role='admin')
 and not exists(select 1 from public.organization_role_assignments a join public.centers c on c.organization_id=a.organization_id where c.id=l.center_id and a.profile_id=(p_data->>'assigned_to')::uuid and a.role='owner') then raise exception 'Sorumlu bu merkezin yöneticisi olmalıdır.';end if;
 update public.crm_tasks set assigned_to=(p_data->>'assigned_to')::uuid where id=(p_data->>'task_id')::uuid;
 else raise exception 'İşlem geçersiz.';end if;return '{}';
end;$$;
revoke all on function public.crm_automation_command(jsonb) from public,anon;grant execute on function public.crm_automation_command(jsonb) to authenticated;

-- Versioned-at-sale package terms, retaining legacy enum compatibility.
create table public.package_catalog(
 id uuid primary key default gen_random_uuid(),center_id uuid not null references public.centers,
 name text not null check(length(name) between 1 and 160),lesson_type public.lesson_type not null,
 credits integer not null check(credits between 1 and 1000),price numeric(12,2) not null check(price>=0),
 validity_days integer not null check(validity_days between 1 and 3650),
 freeze_days integer not null default 0 check(freeze_days between 0 and 365),
 freeze_count integer not null default 0 check(freeze_count between 0 and 12),
 active boolean not null default true
);
create index package_catalog_center on public.package_catalog(center_id);
alter table public.package_catalog enable row level security;
create policy package_catalog_read on public.package_catalog for select to authenticated using(app_private.can_manage_center(center_id));
revoke all on public.package_catalog from public,anon,authenticated;grant select on public.package_catalog to authenticated;
alter table public.subscriptions add column catalog_id uuid references public.package_catalog;
alter table public.subscriptions add column catalog_snapshot jsonb;
create index subscriptions_catalog on public.subscriptions(catalog_id);
create table public.subscription_freezes(
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.subscriptions,
 starts_on date not null,ends_on date not null check(ends_on>=starts_on),note text not null check(length(note) between 1 and 500),
 actor_id uuid not null references public.profiles, created_at timestamptz not null default now(),
 exclude using gist(subscription_id with =,daterange(starts_on,ends_on,'[]') with &&)
);
create index subscription_freezes_actor on public.subscription_freezes(actor_id);
alter table public.subscription_freezes enable row level security;
create policy subscription_freezes_read on public.subscription_freezes for select to authenticated using(exists(select 1 from public.subscriptions s join public.members m on m.id=s.member_id where s.id=subscription_id and (app_private.can_manage_center(s.center_id) or m.profile_id=auth.uid())));
revoke all on public.subscription_freezes from public,anon,authenticated;grant select on public.subscription_freezes to authenticated;
create function app_private.subscription_end(p_id uuid) returns date language sql stable security definer set search_path='' as $$
 select s.ends_on+coalesce((select sum(ends_on-starts_on+1)::integer from public.subscription_freezes f where f.subscription_id=s.id),0) from public.subscriptions s where s.id=p_id;
$$;
revoke all on function app_private.subscription_end(uuid) from public,anon,authenticated;
create or replace function app_private.prepare_subscription() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;days integer;p public.package_catalog%rowtype;
begin
 select center_id into cid from public.members where id=new.member_id;
 if cid is null then raise exception 'Üye yok.';end if;
 if new.catalog_id is not null then
 select * into p from public.package_catalog where id=new.catalog_id and center_id=cid and active;
 if not found then raise exception 'Paket bu merkezde satışa açık değil.';end if;
 new.type:=(case when p.lesson_type='group' then 'group_4_weeks' else 'private_credits' end)::public.subscription_type;
 new.credits_purchased:=p.credits;new.amount:=p.price;new.ends_on:=new.starts_on+p.validity_days;
 new.catalog_snapshot:=to_jsonb(p);
 elsif new.type='group_4_weeks' then new.credits_purchased:=4;
 end if;
 new.policy_snapshot:=app_private.policy_snapshot(cid);
 days:=(new.policy_snapshot->(case when new.type='group_4_weeks' then 'group_package_days' else 'private_package_days' end)->>'value')::integer;
 if days>0 then
 if new.ends_on is null then new.ends_on:=new.starts_on+days;
 elsif new.ends_on>new.starts_on+days then raise exception 'Paket geçerliliği azami süreyi aşıyor.';end if;
 end if;
 new.credits_remaining:=new.credits_purchased;return new;
end;$$;
create or replace function app_private.guard_subscription_policy_history() returns trigger language plpgsql set search_path='' as $$
begin
 if new.starts_on is distinct from old.starts_on or new.ends_on is distinct from old.ends_on or new.type is distinct from old.type
 or new.policy_snapshot is distinct from old.policy_snapshot or new.catalog_id is distinct from old.catalog_id or new.catalog_snapshot is distinct from old.catalog_snapshot
 then raise exception 'Paket tarih/politika geçmişi değiştirilemez; yeni paket oluşturun.';end if;
 return new;
end;$$;
create function public.catalog_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare op text:=p_data->>'action';cid uuid:=(p_data->>'center_id')::uuid;m public.members%rowtype;p public.package_catalog%rowtype;s public.subscriptions%rowtype;rec uuid;days integer;cnt integer;a date;b date;maxdays integer;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 if op='create' then
 if not app_private.can_manage_center(cid) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 insert into public.package_catalog(center_id,name,lesson_type,credits,price,validity_days,freeze_days,freeze_count)
 values(cid,trim(p_data->>'name'),(p_data->>'lesson_type')::public.lesson_type,(p_data->>'credits')::integer,(p_data->>'price')::numeric,(p_data->>'validity_days')::integer,(p_data->>'freeze_days')::integer,(p_data->>'freeze_count')::integer) returning id into rec;
 elsif op='archive' then
 update public.package_catalog set active=false where id=(p_data->>'id')::uuid and app_private.can_manage_center(center_id);
 if not found then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 elsif op='sell' then
 select * into m from public.members where id=(p_data->>'member_id')::uuid;
 if not found or not app_private.can_manage_center(m.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if not m.is_active then raise exception 'Pasif öğrenciye paket satılamaz.';end if;
 select * into p from public.package_catalog where id=(p_data->>'catalog_id')::uuid and center_id=m.center_id and active for share;
 if not found then raise exception 'Paket satışa açık değil.';end if;
 rec:=(p_data->>'key')::uuid;
 if exists(select 1 from public.subscriptions where id=rec) then
 if not exists(select 1 from public.subscriptions where id=rec and member_id=m.id and catalog_id=p.id) then raise exception 'İşlem kimliği başka satışta kullanılmış.';end if;
 return jsonb_build_object('id',rec);end if;
 insert into public.subscriptions(id,center_id,member_id,type,starts_on,credits_purchased,credits_remaining,amount,payment_status,created_by,catalog_id)
 values(rec,m.center_id,m.id,'private_credits',(p_data->>'starts_on')::date,1,1,0,'pending',auth.uid(),p.id);
 elsif op='freeze' then
 select * into s from public.subscriptions where id=(p_data->>'subscription_id')::uuid for update;
 if not found or not app_private.can_manage_center(s.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 a:=(p_data->>'starts_on')::date;b:=(p_data->>'ends_on')::date;
 if s.status<>'active' or a<(now() at time zone 'Europe/Istanbul')::date or b<a or a<s.starts_on or a>app_private.subscription_end(s.id) then raise exception 'Dondurma tarihleri geçersiz.';end if;
 select coalesce(sum(ends_on-starts_on+1),0),count(*) into days,cnt from public.subscription_freezes where subscription_id=s.id;
 if s.catalog_snapshot is null or cnt>=coalesce((s.catalog_snapshot->>'freeze_count')::integer,0) or days+b-a+1>coalesce((s.catalog_snapshot->>'freeze_days')::integer,0) then raise exception 'Paket dondurma sınırı aşılıyor.';end if;
 maxdays:=app_private.policy_number(s.center_id,case when s.type='group_4_weeks' then 'group_package_days' else 'private_package_days' end);
 if maxdays>0 and app_private.subscription_end(s.id)+(b-a+1)>s.starts_on+maxdays then raise exception 'Dondurma organizasyon/merkez geçerlilik sınırını aşıyor.';end if;
 if exists(select 1 from public.credit_transactions t join public.lessons l on l.id=t.lesson_id where t.subscription_id=s.id and t.reason='lesson_use' and (l.starts_at at time zone 'Europe/Istanbul')::date between a and b)
 then raise exception 'Kullanılmış kredilerin günleri dondurulamaz.';end if;
 insert into public.subscription_freezes(subscription_id,starts_on,ends_on,note,actor_id) values(s.id,a,b,trim(p_data->>'note'),auth.uid());
 else raise exception 'İşlem geçersiz.';end if;return jsonb_build_object('id',rec);
end;$$;
revoke all on function public.catalog_command(jsonb) from public,anon;grant execute on function public.catalog_command(jsonb) to authenticated;
create function public.catalog_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 return public.studio_workspace('payments')||jsonb_build_object(
 'catalog',coalesce((select jsonb_agg(to_jsonb(p)) from public.package_catalog p where app_private.can_manage_center(p.center_id)),'[]'),
 'freezes',coalesce((select jsonb_agg(to_jsonb(f)) from public.subscription_freezes f join public.subscriptions s on s.id=f.subscription_id where app_private.can_manage_center(s.center_id)),'[]'),
 'subscriptions',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('label',m.full_name||' · '||coalesce(s.catalog_snapshot->>'name',s.type::text),'effective_ends_on',app_private.subscription_end(s.id))) from public.subscriptions s join public.members m on m.id=s.member_id where app_private.can_manage_center(s.center_id)),'[]'));
end;$$;
revoke all on function public.catalog_workspace() from public,anon;grant execute on function public.catalog_workspace() to authenticated;

-- Progress pilot has scoped staff writes and separate visible-to-student notes.
create table public.student_progress(
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.members,center_id uuid not null references public.centers,
 instructor_id uuid not null references public.profiles,lesson_type public.lesson_type not null,
 level text not null check(length(level) between 1 and 80),skill text not null check(length(skill) between 1 and 160),
 score integer not null check(score between 1 and 5),note text not null check(length(note)<=2000),
 student_visible boolean not null default false,created_at timestamptz not null default now()
);
create index student_progress_member on public.student_progress(member_id,created_at);
create index student_progress_center on public.student_progress(center_id);
create index student_progress_instructor on public.student_progress(instructor_id);
alter table public.student_progress enable row level security;
revoke all on public.student_progress from public,anon,authenticated;grant select on public.student_progress to authenticated;
create policy student_progress_read on public.student_progress for select to authenticated using(app_private.can_manage_center(center_id) or instructor_id=auth.uid() or (student_visible and exists(select 1 from public.members where id=member_id and profile_id=auth.uid())));
create function public.progress_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.members%rowtype;
begin
 select * into m from public.members where id=(p_data->>'member_id')::uuid;
 if auth.uid() is null or not found or not(app_private.can_manage_center(m.center_id) or app_private.instructor_can_access_member_center(m.center_id,m.id)) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 insert into public.student_progress(member_id,center_id,instructor_id,lesson_type,level,skill,score,note,student_visible)
 values(m.id,m.center_id,auth.uid(),(p_data->>'lesson_type')::public.lesson_type,trim(p_data->>'level'),trim(p_data->>'skill'),(p_data->>'score')::integer,trim(p_data->>'note'),(p_data->>'student_visible')::boolean);
 return '{}';
end;$$;
revoke all on function public.progress_command(jsonb) from public,anon;grant execute on function public.progress_command(jsonb) to authenticated;
create function public.progress_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 return jsonb_build_object(
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'label',m.full_name)) from public.members m where app_private.can_manage_center(m.center_id) or m.profile_id=auth.uid() or app_private.instructor_can_access_member_center(m.center_id,m.id)),'[]'),
 'progress',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('member',m.full_name,'instructor',(select full_name from public.profiles where id=p.instructor_id))) from public.student_progress p join public.members m on m.id=p.member_id where app_private.can_manage_center(p.center_id) or p.instructor_id=auth.uid() or (p.student_visible and m.profile_id=auth.uid())),'[]'));
end;$$;
revoke all on function public.progress_workspace() from public,anon;grant execute on function public.progress_workspace() to authenticated;

create or replace function app_private.charge_lesson_member(p_lesson uuid,p_member uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.lessons%rowtype;s public.subscriptions%rowtype;d date;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_lesson::text||p_member::text,0));
 if exists(select 1 from public.credit_transactions where lesson_id=p_lesson and member_id=p_member and reason='lesson_use') then return;end if;
 select * into l from public.lessons where id=p_lesson;d:=(l.starts_at at time zone 'Europe/Istanbul')::date;
 select * into s from public.subscriptions where member_id=p_member and center_id=l.center_id and status='active'
 and type=(case when l.type='group' then 'group_4_weeks' else 'private_credits' end)::public.subscription_type
 and starts_on<=d and (app_private.subscription_end(id) is null or app_private.subscription_end(id)>=d) and not exists(select 1 from public.subscription_freezes f where f.subscription_id=public.subscriptions.id and d between f.starts_on and f.ends_on) and credits_remaining>0 order by starts_on,created_at limit 1 for update;
 if not found then raise exception 'Katılımcı için kullanılabilir ders kredisi yok.';end if;
 insert into public.credit_transactions(subscription_id,member_id,lesson_id,amount,reason,note,created_by)
 values(s.id,p_member,p_lesson,-1,'lesson_use','Katılım veya geç iptal/gelmeme kuralı',auth.uid());
 update public.subscriptions set credits_remaining=credits_remaining-1 where id=s.id;
end;$$;
-- Durable transactional email outbox. Existing notifications remain the event source.
create table public.studio_email_outbox(
 id uuid primary key default gen_random_uuid(),notification_id uuid not null unique references public.notifications,
 center_id uuid not null references public.centers,recipient_id uuid not null references public.profiles,
 status text not null default 'pending' check(status in ('pending','processing','sent','delivered','retry','failed','cancelled','bounced','complained')),
 attempts integer not null default 0,provider_id text unique,last_error text,next_attempt_at timestamptz not null default now(),
 first_attempt_at timestamptz,lease_until timestamptz,lease_token uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index studio_email_due on public.studio_email_outbox(next_attempt_at) where status in ('pending','retry','processing');
create index studio_email_center on public.studio_email_outbox(center_id);
create index studio_email_recipient on public.studio_email_outbox(recipient_id);
alter table public.studio_email_outbox enable row level security;
revoke all on public.studio_email_outbox from public,anon,authenticated;grant select on public.studio_email_outbox to authenticated;
create policy studio_email_manager_read on public.studio_email_outbox for select to authenticated using(app_private.can_manage_center(center_id));
create table public.studio_email_events(
 event_id text primary key,provider_id text not null,type text not null,occurred_at timestamptz not null,created_at timestamptz not null default now()
);
alter table public.studio_email_events enable row level security;
revoke all on public.studio_email_events from public,anon,authenticated;
create table app_private.email_worker_config(id boolean primary key default true check(id),token text not null);
alter table app_private.email_worker_config enable row level security;
revoke all on app_private.email_worker_config from public,anon,authenticated;
insert into app_private.email_worker_config(token) values(encode(extensions.gen_random_bytes(32),'hex'));
create function public.verify_email_worker(p_token text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from app_private.email_worker_config where token=p_token);
$$;
revoke all on function public.verify_email_worker(text) from public,anon,authenticated;grant execute on function public.verify_email_worker(text) to service_role;

create function app_private.queue_notification_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.center_id is not null then
 insert into public.studio_email_outbox(notification_id,center_id,recipient_id) values(new.id,new.center_id,new.recipient_id) on conflict do nothing;
 end if;return new;
end;$$;
create trigger notification_email_outbox after insert on public.notifications for each row execute function app_private.queue_notification_email();
revoke all on function app_private.queue_notification_email() from public,anon,authenticated;
create function app_private.cancel_stale_reminder_emails() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.starts_at is distinct from old.starts_at or new.status in ('cancelled','postponed','completed') then
 update public.studio_email_outbox o set status='cancelled',updated_at=now() from public.notifications n where n.id=o.notification_id
 and n.type='studio_lesson_reminder' and n.dedupe_key like 'lesson:'||new.id::text||':%' and o.status in ('pending','retry','processing');
 end if;return new;
end;$$;
create trigger stale_reminder_emails after update on public.lessons for each row execute function app_private.cancel_stale_reminder_emails();
revoke all on function app_private.cancel_stale_reminder_emails() from public,anon,authenticated;

create function public.email_work_scope() returns uuid[] language sql stable security definer set search_path='' as $$
 select coalesce(array_agg(c.id),'{}'::uuid[]) from public.centers c where auth.uid() is not null and app_private.can_manage_center(c.id);
$$;
revoke all on function public.email_work_scope() from public,anon;grant execute on function public.email_work_scope() to authenticated;
create function public.claim_studio_emails(p_centers uuid[] default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 update public.studio_email_outbox set status='failed',last_error='Retry window expired',updated_at=now()
 where status in ('retry','processing') and first_attempt_at<now()-interval '23 hours';
 with due as(
 select o.id from public.studio_email_outbox o where (p_centers is null or o.center_id=any(p_centers)) and (
 (o.status in ('pending','retry') and o.next_attempt_at<=now()) or (o.status='processing' and o.lease_until<now()))
 and o.attempts<5 order by o.created_at for update skip locked limit 10
 ), claimed as (
 update public.studio_email_outbox o set status='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),
 lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid(),updated_at=now() from due where o.id=due.id returning o.*
 )
 select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('email',u.email,'title',n.title,'body',n.body,'href',n.href)),'[]') into r
 from claimed o join auth.users u on u.id=o.recipient_id join public.notifications n on n.id=o.notification_id;
 return r;
end;$$;
revoke all on function public.claim_studio_emails(uuid[]) from public,anon,authenticated;grant execute on function public.claim_studio_emails(uuid[]) to service_role;
create function public.finish_studio_email(p_id uuid,p_lease uuid,p_status text,p_provider text default null,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('sent','retry','failed') then raise exception 'Invalid status';end if;
 update public.studio_email_outbox set status=case when p_status='retry' and attempts>=5 then 'failed' else p_status end,
 provider_id=coalesce(p_provider,provider_id),last_error=left(p_error,500),next_attempt_at=now()+make_interval(mins=>least(120,power(2,attempts)::integer)),lease_until=null,lease_token=null,updated_at=now()
 where id=p_id and status='processing' and lease_token=p_lease;
end;$$;
revoke all on function public.finish_studio_email(uuid,uuid,text,text,text) from public,anon,authenticated;grant execute on function public.finish_studio_email(uuid,uuid,text,text,text) to service_role;
create function public.studio_email_event(p_event_id text,p_provider text,p_type text,p_occurred_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 insert into public.studio_email_events values(p_event_id,p_provider,p_type,p_occurred_at,now()) on conflict do nothing;
 get diagnostics n=row_count;if n=0 then return;end if;
 update public.studio_email_outbox set status=case p_type when 'email.delivered' then 'delivered' when 'email.bounced' then 'bounced' when 'email.complained' then 'complained' when 'email.failed' then 'failed' else status end,
 updated_at=now() where provider_id=p_provider and status not in ('bounced','complained') and (p_type<>'email.failed' or status<>'delivered');
end;$$;
revoke all on function public.studio_email_event(text,text,text,timestamptz) from public,anon,authenticated;grant execute on function public.studio_email_event(text,text,text,timestamptz) to service_role;
create function public.retry_studio_email(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.studio_email_outbox%rowtype;
begin
 select * into o from public.studio_email_outbox where id=p_id for update;
 if not found or auth.uid() is null or not app_private.can_manage_center(o.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if o.status not in ('failed','retry') or o.provider_id is not null then raise exception 'Bu gönderim tekrar denenemez.';end if;
 if o.first_attempt_at is not null and o.first_attempt_at<now()-interval '23 hours' then raise exception 'Çift gönderimi önlemek için deneme süresi dolmuş gönderimi yeniden açamazsınız.';end if;
 update public.studio_email_outbox set status='retry',attempts=0,next_attempt_at=now(),updated_at=now() where id=o.id;
end;$$;
revoke all on function public.retry_studio_email(uuid) from public,anon;grant execute on function public.retry_studio_email(uuid) to authenticated;
create function app_private.dispatch_email_worker() returns void language plpgsql security definer set search_path='' as $$
declare t text;begin
 if not exists(select 1 from public.studio_email_outbox where (status in ('pending','retry','processing') and next_attempt_at<=now()) or (status='sent' and updated_at>now()-interval '7 days')) then return;end if;
 select token into t from app_private.email_worker_config;
 perform net.http_post(url:='https://ysplylnwdfwizmuxvcqg.supabase.co/functions/v1/process-studio-email',
 headers:=jsonb_build_object('Content-Type','application/json','x-studio-worker-token',t),body:='{}',timeout_milliseconds:=10000);
end;$$;
revoke all on function app_private.dispatch_email_worker() from public,anon,authenticated;
do $$begin
 if exists(select 1 from pg_available_extensions where name='pg_net') then create extension if not exists pg_net with schema extensions;end if;
 if exists(select 1 from pg_extension where extname='pg_cron') and exists(select 1 from pg_extension where extname='pg_net') then
 perform cron.schedule('studio-email-worker','* * * * *','select app_private.dispatch_email_worker();');
 end if;
end;$$;

create function public.roadmap_workspace(p_module text,p_from date default current_date-29,p_to date default current_date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;prev jsonb;span integer;
begin
 if p_module='registration' then return public.registration_workspace();
 elsif p_module='catalog' then return public.catalog_workspace();
 elsif p_module='progress' then return public.progress_workspace();
 elsif p_module='planning' then return public.planning_workspace(p_from,p_to);
 elsif p_module='crm-automation' then
 r:=public.studio_workspace('crm');
 return r||jsonb_build_object('forms',coalesce((select jsonb_agg(to_jsonb(f)) from public.crm_intake_forms f where app_private.can_manage_center(f.center_id)),'[]'),
 'managers',coalesce((select jsonb_agg(jsonb_build_object('id',a.profile_id,'center_id',a.center_id,'label',p.full_name)) from public.center_role_assignments a join public.profiles p on p.id=a.profile_id where a.role='admin' and app_private.can_manage_center(a.center_id)),'[]'));
 elsif p_module='communication' then
 if auth.uid() is null or not exists(select 1 from public.centers c where app_private.can_manage_center(c.id)) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 return jsonb_build_object('emails',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('title',n.title)) from public.studio_email_outbox o join public.notifications n on n.id=o.notification_id where app_private.can_manage_center(o.center_id)),'[]'));
 elsif p_module='insights' then
 if p_to-p_from>365 or p_to<p_from or p_from is null or p_to is null then raise exception 'En fazla 366 gün seçin.';end if;
 r:=public.studio_report(p_from,p_to);span:=p_to-p_from+1;prev:=public.studio_report(p_from-span,p_from-1);
 return r||jsonb_build_object('previous',prev,
 'sources',coalesce((select jsonb_agg(to_jsonb(x)) from (select l.source,count(*) leads,count(*) filter(where l.trial_at is not null) trials,count(*) filter(where l.converted_at is not null) conversions from public.crm_leads l where app_private.can_manage_center(l.center_id) and (l.created_at at time zone 'Europe/Istanbul')::date between p_from and p_to group by l.source) x),'[]'),
 'interventions',coalesce((select jsonb_agg(to_jsonb(x)) from (
 select m.id member_id,m.full_name member,'30 gündür katılım yok' reason,'/dashboard/members?q='||m.full_name href from public.members m
 where m.is_active and app_private.can_manage_center(m.center_id) and m.created_at<now()-interval '30 days'
 and not exists(select 1 from public.attendance a join public.lessons l on l.id=a.lesson_id where a.member_id=m.id and a.attended and l.starts_at>now()-interval '30 days')
 union all
 select s.member_id,m.full_name,'Paket yenileme zamanı','/dashboard/catalog?member_id='||s.member_id::text from public.subscriptions s join public.members m on m.id=s.member_id where app_private.can_manage_center(s.center_id) and s.status='active' and (s.credits_remaining<=1 or app_private.subscription_end(s.id) between current_date and current_date+7)
 union all
 select s.member_id,m.full_name,'Kalan borç','/dashboard/payments?action=collect&subscription_id='||s.id::text from public.subscriptions s join public.members m on m.id=s.member_id where app_private.can_manage_center(s.center_id) and s.amount>coalesce((select sum(amount) from public.manual_payments where subscription_id=s.id),0)
 union all
 select l.converted_member_id,l.full_name,'Takip görevi gecikti','/dashboard/crm?action=complete_task&lead_id='||l.id::text from public.crm_tasks t join public.crm_leads l on l.id=t.lead_id where app_private.can_manage_center(l.center_id) and t.completed_at is null and t.due_at<now()
 )x),'[]'),
 'attendance_trend',coalesce((select jsonb_agg(to_jsonb(x) order by x.week) from(select date_trunc('week',l.starts_at at time zone 'Europe/Istanbul')::date week,count(*) marked,count(*) filter(where a.attended) present from public.attendance a join public.lessons l on l.id=a.lesson_id where app_private.can_manage_center(l.center_id) and (l.starts_at at time zone 'Europe/Istanbul')::date between p_from and p_to group by 1)x),'[]'));
 else raise exception 'Modül geçersiz.';end if;
end;$$;
revoke all on function public.roadmap_workspace(text,date,date) from public,anon;grant execute on function public.roadmap_workspace(text,date,date) to authenticated;
create function public.roadmap_command(p_module text,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 case p_module
 when 'planning' then return public.planning_command(p_data);
 when 'registration' then return public.registration_command(p_data);
 when 'catalog' then return public.catalog_command(p_data);
 when 'crm-automation' then return public.crm_automation_command(p_data);
 when 'progress' then return public.progress_command(p_data);
 when 'communication' then perform public.retry_studio_email((p_data->>'id')::uuid);return '{}';
 else raise exception 'Modül geçersiz.';
 end case;
end;$$;
revoke all on function public.roadmap_command(text,jsonb) from public,anon;grant execute on function public.roadmap_command(text,jsonb) to authenticated;
grant all on public.studio_email_outbox,public.studio_email_events,public.crm_intake_forms to service_role;
create function public.pending_email_receipts(p_centers uuid[] default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'provider_id',o.provider_id)),'[]') from public.studio_email_outbox o where o.status='sent' and o.updated_at>now()-interval '7 days' and (p_centers is null or o.center_id=any(p_centers));
$$;
revoke all on function public.pending_email_receipts(uuid[]) from public,anon,authenticated;grant execute on function public.pending_email_receipts(uuid[]) to service_role;
-- Do not send new email to recipients who previously bounced or complained.
create function app_private.suppress_email_recipient() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.studio_email_outbox where recipient_id=new.recipient_id and status in ('bounced','complained')) then new.status:='failed';new.last_error:='Recipient suppressed';end if;return new;
end;$$;
create trigger suppress_email_recipient before insert on public.studio_email_outbox for each row execute function app_private.suppress_email_recipient();
revoke all on function app_private.suppress_email_recipient() from public,anon,authenticated;

create table app_private.crm_intake_limits(
 key text primary key,count integer not null,window_started timestamptz not null
);
alter table app_private.crm_intake_limits enable row level security;
revoke all on app_private.crm_intake_limits from public,anon,authenticated;
create function public.crm_intake_info(p_slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('title',title,'slug',slug) from public.crm_intake_forms where slug=p_slug and active;
$$;
revoke all on function public.crm_intake_info(text) from public,anon,authenticated;grant execute on function public.crm_intake_info(text) to service_role;
create function public.crm_intake_limited(p_slug text,p_data jsonb,p_ip_hash text) returns void language plpgsql security definer set search_path='' as $$
declare k text;n integer;lim integer;
begin
 if not exists(select 1 from public.crm_intake_forms where slug=p_slug and active) then raise exception 'Form kapalı.';end if;
 foreach k in array array['form:'||p_slug,'ip:'||p_ip_hash,'contact:'||p_slug||':'||coalesce(nullif(lower(trim(p_data->>'email')),''),p_data->>'phone')] loop
 lim:=case when k like 'form:%' then 60 when k like 'ip:%' then 20 else 5 end;
 insert into app_private.crm_intake_limits values(k,1,now()) on conflict(key) do update
 set count=case when app_private.crm_intake_limits.window_started<now()-interval '1 hour' then 1 else app_private.crm_intake_limits.count+1 end,
 window_started=case when app_private.crm_intake_limits.window_started<now()-interval '1 hour' then now() else app_private.crm_intake_limits.window_started end returning count into n;
 if n>lim then raise exception 'Başvuru sınırı aşıldı.' using errcode='P0001';end if;
 end loop;
 perform public.crm_intake_submit(p_slug,p_data);
end;$$;
revoke all on function public.crm_intake_limited(text,jsonb,text) from public,anon,authenticated;grant execute on function public.crm_intake_limited(text,jsonb,text) to service_role;

create or replace function app_private.studio_report(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a timestamptz;b timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from public.centers c where app_private.can_manage_center(c.id)) then raise exception 'Yönetici erişimi gerekli.' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from then raise exception 'Tarih aralığı geçersiz.';end if;
 a:=p_from::timestamp at time zone 'Europe/Istanbul';b:=(p_to+1)::timestamp at time zone 'Europe/Istanbul';
 return jsonb_build_object(
 'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'member',m.full_name,'subscription_id',s.id,'amount',p.amount,'kind',p.kind,'method',p.method,'occurred_at',p.occurred_at,'note',p.note,'actor_id',p.actor_id)) from public.manual_payments p join public.subscriptions s on s.id=p.subscription_id join public.members m on m.id=s.member_id where p.occurred_at>=a and p.occurred_at<b and app_private.can_manage_center(p.center_id)),'[]'),
 'balances',coalesce((select jsonb_agg(jsonb_build_object('subscription_id',s.id,'member',m.full_name,'amount',s.amount,'paid',coalesce(p.net,0),'balance',s.amount-coalesce(p.net,0),'ends_on',app_private.subscription_end(s.id),'credits_remaining',s.credits_remaining,'status',s.status)) from public.subscriptions s join public.members m on m.id=s.member_id left join lateral(select sum(amount) net from public.manual_payments where subscription_id=s.id and occurred_at<b) p on true where s.created_at<b and app_private.can_manage_center(s.center_id)),'[]'),
 'renewals',coalesce((select jsonb_agg(jsonb_build_object('subscription_id',s.id,'member',m.full_name,'ends_on',app_private.subscription_end(s.id),'credits_remaining',s.credits_remaining)) from public.subscriptions s join public.members m on m.id=s.member_id where s.status='active' and (app_private.subscription_end(s.id) between p_from and p_to or s.credits_remaining<=1) and app_private.can_manage_center(s.center_id)),'[]'),
 'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'starts_at',l.starts_at,'status',l.status,'room',r.name,'instructor',p.full_name,'capacity',l.expected_attendees,'enrolled',case when l.type='private' then 1 else (select count(*) from public.lesson_enrollments where lesson_id=l.id) end,'attended',(select count(*) from public.attendance where lesson_id=l.id and attended),'hours',extract(epoch from(l.ends_at-l.starts_at))/3600)) from public.lessons l join public.rooms r on r.id=l.room_id left join public.profiles p on p.id=l.instructor_id where l.starts_at>=a and l.starts_at<b and app_private.can_manage_center(l.center_id)),'[]'),
 'usage',coalesce((select jsonb_agg(to_jsonb(x)) from (
 select r.name room,p.full_name instructor,sum(extract(epoch from(l.ends_at-l.starts_at))/3600) hours,count(*) lessons
 from public.lessons l join public.rooms r on r.id=l.room_id left join public.profiles p on p.id=l.instructor_id
 where l.starts_at>=a and l.starts_at<b and l.status in ('scheduled','completed') and app_private.can_manage_center(l.center_id)
 group by r.id,r.name,p.id,p.full_name) x),'[]'),
 'crm',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.full_name,'source',l.source,'stage',l.stage,'created_at',l.created_at,'converted_at',l.converted_at,'member_id',l.converted_member_id)) from public.crm_leads l where l.created_at>=a and l.created_at<b and app_private.can_manage_center(l.center_id)),'[]'));
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
 'Kalan kredi: '||s.credits_remaining::text||coalesce(' · Bitiş: '||app_private.subscription_end(s.id)::text,''),'/dashboard/my-learning','package:'||s.id::text
 from public.subscriptions s join public.members m on m.id=s.member_id join public.centers c on c.id=s.center_id
 where s.status='active' and s.starts_on<=(now() at time zone 'Europe/Istanbul')::date and m.profile_id is not null
 and (s.credits_remaining<=app_private.policy_number(s.center_id,'low_credit_threshold') or app_private.subscription_end(s.id)<=(now() at time zone 'Europe/Istanbul')::date+app_private.policy_number(s.center_id,'package_reminder_days'))
 on conflict do nothing;get diagnostics n=row_count;return total+n;
end;$$;
create function public.my_subscription_terms() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.catalog_snapshot->>'name','ends_on',app_private.subscription_end(s.id),
 'frozen',exists(select 1 from public.subscription_freezes f where f.subscription_id=s.id and (now() at time zone 'Europe/Istanbul')::date between f.starts_on and f.ends_on))),'[]')
 from public.subscriptions s join public.members m on m.id=s.member_id where auth.uid() is not null and m.profile_id=auth.uid();
$$;
revoke all on function public.my_subscription_terms() from public,anon;grant execute on function public.my_subscription_terms() to authenticated;
