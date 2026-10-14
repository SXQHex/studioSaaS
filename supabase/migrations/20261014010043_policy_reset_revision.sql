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
 if op='reset' then
 insert into public.center_policy_overrides(center_id,key,value,revision) values(cid,k,null,1)
 on conflict(center_id,key) do update set value=null,revision=center_policy_overrides.revision+1,updated_at=now()
 returning to_jsonb(center_policy_overrides.*) into newrow;
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
