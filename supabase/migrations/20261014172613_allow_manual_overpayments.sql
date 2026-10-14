-- Accept the full cash/manual receipt. A negative signed balance is money owed
-- back to the customer, not lesson credit or an automatic cross-package offset.
create or replace function app_private.payments_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions%rowtype;p public.manual_payments%rowtype;existing public.manual_payments%rowtype;
 a numeric;net numeric;pid uuid;op text:=p_data->>'action';k uuid:=(p_data->>'key')::uuid;t timestamptz:=(p_data->>'occurred_at')::timestamptz;method text:=coalesce(nullif(p_data->>'method',''),'manual');
begin
 select * into s from public.subscriptions where id=(p_data->>'subscription_id')::uuid for update;
 if not found or auth.uid() is null or not app_private.can_manage_center(s.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if k is null or t is null or t>now()+interval '5 minutes' or length(trim(coalesce(p_data->>'note',''))) not between 1 and 500 then raise exception 'İşlem tarihi, açıklama ve işlem anahtarı zorunlu.';end if;
 if method not in ('cash','manual') then raise exception 'Ödeme yöntemi geçersiz.';end if;
 if op='reverse' then
  select * into p from public.manual_payments where id=(p_data->>'entry_id')::uuid and subscription_id=s.id;
  if not found or p.kind='reversal' then raise exception 'Düzeltilecek işlem geçersiz.';end if;a:=-p.amount;method:=p.method;
 elsif op in ('collect','refund') then
  a:=(p_data->>'amount')::numeric;
  if a is null or a<=0 or a<>round(a,2) then raise exception 'Pozitif ve iki ondalıklı tutar girin.';end if;
  if op='refund' then a:=-a;end if;
 else raise exception 'İşlem geçersiz.';end if;
 select * into existing from public.manual_payments where idempotency_key=k;
 if found then
  if existing.subscription_id<>s.id or existing.amount<>a or existing.method<>method or (op='reverse' and existing.reversed_entry_id is distinct from p.id) or existing.kind<>(case op when 'collect' then 'collection' when 'refund' then 'refund' else 'reversal' end) then raise exception 'İşlem anahtarı başka bir işlemde kullanılmış.';end if;
  return jsonb_build_object('id',existing.id);
 end if;
 select coalesce(sum(amount),0) into net from public.manual_payments where subscription_id=s.id;
 if net+a<0 then raise exception 'İade veya düzeltme tutarı net tahsilatı aşıyor.';end if;
 insert into public.manual_payments(subscription_id,center_id,amount,kind,occurred_at,actor_id,note,reversed_entry_id,idempotency_key,method)
 values(s.id,s.center_id,a,case op when 'collect' then 'collection' when 'refund' then 'refund' else 'reversal' end,t,auth.uid(),trim(p_data->>'note'),case when op='reverse' then p.id else null end,k,method) returning id into pid;
 update public.subscriptions set payment_status=case when net+a>=amount then 'paid'::public.payment_status when net+a=0 and op in ('refund','reverse') then 'refunded'::public.payment_status else 'pending'::public.payment_status end,
 paid_at=case when net+a>=amount then t else null end where id=s.id;
 return jsonb_build_object('id',pid,'paid',net+a,'balance',s.amount-net-a,'remaining_debt',greatest(s.amount-net-a,0),'credit_balance',greatest(net+a-s.amount,0));
end;$$;

revoke all on function app_private.payments_command(jsonb) from public,anon;
grant execute on function app_private.payments_command(jsonb) to authenticated;
