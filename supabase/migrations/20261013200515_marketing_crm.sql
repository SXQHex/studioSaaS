
create table public.crm_leads(
 id uuid primary key default gen_random_uuid(),center_id uuid not null references public.centers(id),full_name text not null check(length(trim(full_name)) between 2 and 160),
 email text,phone text,source text not null,interests text,stage text not null default 'new' check(stage in ('new','contacted','trial','followup','converted','lost')),
 trial_at timestamptz,notes text,converted_at timestamptz,converted_member_id uuid references public.members(id),
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(email is not null or phone is not null));
create unique index crm_leads_email_unique on public.crm_leads(center_id,lower(email)) where email is not null;
create unique index crm_leads_phone_unique on public.crm_leads(center_id,phone) where phone is not null;
create index crm_leads_member_idx on public.crm_leads(converted_member_id);
create index crm_leads_creator_idx on public.crm_leads(created_by);
create table public.crm_tasks(
 id uuid primary key default gen_random_uuid(),lead_id uuid not null references public.crm_leads(id),title text not null,
 due_at timestamptz not null,completed_at timestamptz,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now());
create index crm_tasks_lead_idx on public.crm_tasks(lead_id);
create index crm_tasks_due_idx on public.crm_tasks(due_at) where completed_at is null;
create index crm_tasks_creator_idx on public.crm_tasks(created_by);
alter table public.crm_leads enable row level security;alter table public.crm_tasks enable row level security;
create policy crm_leads_manager on public.crm_leads for select to authenticated using(app_private.can_manage_center(center_id));
create policy crm_tasks_manager on public.crm_tasks for select to authenticated using(exists(select 1 from public.crm_leads l where l.id=lead_id and app_private.can_manage_center(l.center_id)));
revoke all on public.crm_leads,public.crm_tasks from public,anon,authenticated;grant select on public.crm_leads,public.crm_tasks to authenticated;
create function app_private.crm_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.crm_leads%rowtype;cid uuid;mid uuid;lid uuid;matches integer;op text:=p_data->>'action';em text;ph text;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 if op='create' then
 cid:=(p_data->>'center_id')::uuid;
 if not app_private.can_manage_center(cid) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 em:=nullif(lower(trim(p_data->>'email')),'');ph:=nullif(regexp_replace(coalesce(p_data->>'phone',''),'[^0-9]','','g'),'');
 if length(coalesce(em,''))>320 or length(coalesce(ph,''))>20 or length(coalesce(p_data->>'source','')) not between 1 and 160 then raise exception 'İletişim veya kaynak geçersiz.';end if;
 insert into public.crm_leads(center_id,full_name,email,phone,source,interests,notes,created_by)
 values(cid,trim(p_data->>'full_name'),em,ph,trim(p_data->>'source'),nullif(trim(p_data->>'interests'),''),nullif(trim(p_data->>'notes'),''),auth.uid()) returning id into lid;
 return jsonb_build_object('id',lid);
 end if;
 select * into l from public.crm_leads where id=(p_data->>'lead_id')::uuid for update;
 if not found or not app_private.can_manage_center(l.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if op='update' then
 if l.converted_member_id is not null then raise exception 'Üyeye dönüşen adayın bilgilerini üye ekranından yönetin.';end if;
 if p_data->>'stage'='converted' then raise exception 'Üyeye dönüştür işlemini kullanın.';end if;
 update public.crm_leads set stage=p_data->>'stage',interests=p_data->>'interests',notes=p_data->>'notes',
 trial_at=nullif(p_data->>'trial_at','')::timestamptz,updated_at=now() where id=l.id;
 elsif op='task' then
 if length(trim(coalesce(p_data->>'title',''))) not between 1 and 160 or nullif(p_data->>'due_at','') is null then raise exception 'Görev başlığı ve tarih zorunlu.';end if;
 insert into public.crm_tasks(lead_id,title,due_at,created_by) values(l.id,trim(p_data->>'title'),(p_data->>'due_at')::timestamptz,auth.uid());
 elsif op='complete_task' then
 update public.crm_tasks set completed_at=coalesce(completed_at,now()) where id=(p_data->>'task_id')::uuid and lead_id=l.id;
 if not found then raise exception 'Görev bulunamadı.';end if;
 elsif op='convert' then
 if l.converted_member_id is not null then return jsonb_build_object('member_id',l.converted_member_id);end if;
 perform pg_advisory_xact_lock(hashtextextended(l.center_id::text||coalesce(l.email,l.phone),0));
 select count(*),min(id::text)::uuid into matches,mid from public.members where center_id=l.center_id and
 ((l.email is not null and lower(trim(email))=l.email) or (l.phone is not null and regexp_replace(phone,'[^0-9]','','g')=l.phone));
 if matches>1 then raise exception 'Birden fazla üye eşleşti; yönetici kayıtları önce incelemeli.';end if;
 if mid is null then
 insert into public.members(center_id,full_name,email,phone,notes) values(l.center_id,l.full_name,l.email,l.phone,l.notes) returning id into mid;
 end if;
 update public.crm_leads set converted_member_id=mid,stage='converted',updated_at=now(),converted_at=now() where id=l.id;
 return jsonb_build_object('member_id',mid);
 else raise exception 'İşlem geçersiz.';end if;
 return '{}'::jsonb;
end;$$;
create function public.crm_command(p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.crm_command(p_data);$$;
revoke all on function app_private.crm_command(jsonb),public.crm_command(jsonb) from public,anon;
grant execute on function app_private.crm_command(jsonb),public.crm_command(jsonb) to authenticated;
