-- Reset retains a monotonic revision, preventing stale-screen ABA updates.
alter table public.center_policy_overrides alter column value drop not null;
create or replace function public.policy_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
create or replace function app_private.guard_policy_request() returns trigger language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if new.session_type='private' and (tg_op='INSERT' or new.starts_at is distinct from old.starts_at or (new.status='approved' and old.status is distinct from new.status)) then
  new.policy_snapshot:=app_private.policy_snapshot(new.center_id);
  perform pg_advisory_xact_lock(hashtextextended('request-policy:'||new.center_id::text||new.private_member_id::text,0));
  if new.starts_at<now()+make_interval(hours=>(new.policy_snapshot->'request_min_hours'->>'value')::integer)
  or new.starts_at>now()+make_interval(days=>(new.policy_snapshot->'request_max_days'->>'value')::integer) then raise exception 'Talep tarihi merkez politikasının dışında.';end if;
  if tg_op='INSERT' then
   select count(*) into n from public.session_requests where center_id=new.center_id and private_member_id=new.private_member_id and status='pending';
   if n>=(new.policy_snapshot->'request_pending_limit'->>'value')::integer then raise exception 'Bekleyen talep sınırına ulaşıldı.';end if;
  end if;
  if (new.policy_snapshot->'debt_blocks_requests'->>'value')::boolean and app_private.member_has_debt(new.private_member_id) then raise exception 'Borç nedeniyle yeni talep/onay engellendi.';end if;
 end if;
 return new;
end;$$;
create or replace function app_private.prepare_subscription() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;days integer;
begin
 select center_id into cid from public.members where id=new.member_id;
 if cid is null then raise exception 'Üye yok.';end if;
 new.policy_snapshot:=app_private.policy_snapshot(cid);
 days:=(new.policy_snapshot->(case when new.type='group_4_weeks' then 'group_package_days' else 'private_package_days' end)->>'value')::integer;
 if new.type='group_4_weeks' then new.credits_purchased:=4;end if;
 new.credits_remaining:=new.credits_purchased;
 if days>0 then
  if new.ends_on is null then new.ends_on:=new.starts_on+days;
  elsif new.ends_on>new.starts_on+days then raise exception 'Paket geçerliliği azami süreyi aşıyor.';end if;
 end if;
 return new;
end;$$;
