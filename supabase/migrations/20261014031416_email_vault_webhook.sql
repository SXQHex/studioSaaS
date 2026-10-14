
-- Credentials stay in Supabase Vault and are never available to browser roles.
create function public.studio_email_credentials() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if to_regclass('vault.decrypted_secrets') is null then return '{}';end if;
 return jsonb_build_object(
 'api_key',(select decrypted_secret from vault.decrypted_secrets where name='studiosaas_transactional_resend' limit 1),
 'webhook_key',(select decrypted_secret from vault.decrypted_secrets where name='studiosaas_email_webhook' limit 1));
end;$$;
revoke all on function public.studio_email_credentials() from public,anon,authenticated;
grant execute on function public.studio_email_credentials() to service_role;
-- A provider receipt can arrive before the send response is persisted. Reconcile stored receipts.
create or replace function public.finish_studio_email(p_id uuid,p_lease uuid,p_status text,p_provider text default null,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('sent','retry','failed') then raise exception 'Invalid status';end if;
 update public.studio_email_outbox set status=case when p_status='retry' and attempts>=5 then 'failed' else p_status end,
 provider_id=coalesce(p_provider,provider_id),last_error=left(p_error,500),next_attempt_at=now()+make_interval(mins=>least(120,power(2,attempts)::integer)),lease_until=null,lease_token=null,updated_at=now()
 where id=p_id and status='processing' and lease_token=p_lease;
 if found and p_provider is not null then
 update public.studio_email_outbox o set status=
 case when exists(select 1 from public.studio_email_events e where e.provider_id=p_provider and e.type='email.complained') then 'complained'
 when exists(select 1 from public.studio_email_events e where e.provider_id=p_provider and e.type='email.bounced') then 'bounced'
 when exists(select 1 from public.studio_email_events e where e.provider_id=p_provider and e.type='email.delivered') then 'delivered'
 when exists(select 1 from public.studio_email_events e where e.provider_id=p_provider and e.type='email.failed') then 'failed' else o.status end where o.id=p_id;
 end if;
end;$$;
revoke all on function public.finish_studio_email(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_studio_email(uuid,uuid,text,text,text) to service_role;
