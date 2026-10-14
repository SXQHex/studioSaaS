
create table public.manual_payments(
 id uuid primary key default gen_random_uuid(),subscription_id uuid not null references public.subscriptions(id),
 center_id uuid not null references public.centers(id),amount numeric(12,2) not null check(amount<>0),
 kind text not null check(kind in ('collection','refund','reversal','legacy')),
 occurred_at timestamptz not null,actor_id uuid references public.profiles(id),note text not null check(length(trim(note)) between 1 and 500),
 reversed_entry_id uuid references public.manual_payments(id),idempotency_key uuid not null unique,
 created_at timestamptz not null default now());
create unique index manual_payments_single_reverse on public.manual_payments(reversed_entry_id) where reversed_entry_id is not null;
create index manual_payments_subscription_idx on public.manual_payments(subscription_id);
create index manual_payments_center_date_idx on public.manual_payments(center_id,occurred_at);
create index manual_payments_actor_idx on public.manual_payments(actor_id);
alter table public.manual_payments enable row level security;
create policy manual_payments_read on public.manual_payments for select to authenticated using(
 app_private.can_manage_center(center_id) or exists(select 1 from public.subscriptions s join public.members m on m.id=s.member_id where s.id=subscription_id and m.profile_id=auth.uid()));
revoke all on public.manual_payments from public,anon,authenticated;grant select on public.manual_payments to authenticated;
-- Existing paid statuses are carried forward as labeled opening entries, without inventing receipt dates.
insert into public.manual_payments(subscription_id,center_id,amount,kind,occurred_at,actor_id,note,idempotency_key)
select id,center_id,amount,'legacy',coalesce(paid_at,created_at),created_by,'Önceki ödeme durumundan aktarılan açılış kaydı',gen_random_uuid()
from public.subscriptions where payment_status='paid' and amount>0;
create function app_private.initial_manual_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.payment_status='paid' and new.amount>0 then
 insert into public.manual_payments(subscription_id,center_id,amount,kind,occurred_at,actor_id,note,idempotency_key)
 values(new.id,new.center_id,new.amount,'collection',coalesce(new.paid_at,now()),new.created_by,'Paket oluşturulurken manuel tahsilat',gen_random_uuid());end if;
 return new;
end;$$;
create trigger subscription_initial_payment after insert on public.subscriptions for each row execute function app_private.initial_manual_payment();
revoke all on function app_private.initial_manual_payment() from public,anon,authenticated;
create function app_private.protect_payment_columns() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user not in ('postgres','service_role','supabase_admin') and
 (new.amount is distinct from old.amount or new.payment_status is distinct from old.payment_status or new.paid_at is distinct from old.paid_at)
 then raise exception 'Ödeme değişikliklerini tahsilat defterinden yapın.';end if;return new;
end;$$;
create trigger protect_subscription_payment before update on public.subscriptions for each row execute function app_private.protect_payment_columns();

create function app_private.payments_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions%rowtype;p public.manual_payments%rowtype;existing public.manual_payments%rowtype;
 a numeric;net numeric;pid uuid;op text:=p_data->>'action';k uuid:=(p_data->>'key')::uuid;t timestamptz:=(p_data->>'occurred_at')::timestamptz;
begin
 select * into s from public.subscriptions where id=(p_data->>'subscription_id')::uuid for update;
 if not found or auth.uid() is null or not app_private.can_manage_center(s.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if k is null or t is null or t>now()+interval '5 minutes' or length(trim(coalesce(p_data->>'note',''))) not between 1 and 500 then raise exception 'İşlem tarihi, açıklama ve işlem anahtarı zorunlu.';end if;
 if op='reverse' then
  select * into p from public.manual_payments where id=(p_data->>'entry_id')::uuid and subscription_id=s.id;
  if not found or p.kind='reversal' then raise exception 'Düzeltilecek işlem geçersiz.';end if;a:=-p.amount;
 elsif op in ('collect','refund') then
  a:=(p_data->>'amount')::numeric;
  if a is null or a<=0 or a<>round(a,2) then raise exception 'Pozitif ve iki ondalıklı tutar girin.';end if;
  if op='refund' then a:=-a;end if;
 else raise exception 'İşlem geçersiz.';end if;
 select * into existing from public.manual_payments where idempotency_key=k;
 if found then
  if existing.subscription_id<>s.id or existing.amount<>a or (op='reverse' and existing.reversed_entry_id is distinct from p.id) or existing.kind<>(case op when 'collect' then 'collection' when 'refund' then 'refund' else 'reversal' end) then raise exception 'İşlem anahtarı başka bir işlemde kullanılmış.';end if;
  return jsonb_build_object('id',existing.id);
 end if;
 select coalesce(sum(amount),0) into net from public.manual_payments where subscription_id=s.id;
 if net+a<0 or net+a>s.amount then raise exception 'Tutar, tahsil edilen tutarı veya kalan borcu aşıyor.';end if;
 insert into public.manual_payments(subscription_id,center_id,amount,kind,occurred_at,actor_id,note,reversed_entry_id,idempotency_key)
 values(s.id,s.center_id,a,case op when 'collect' then 'collection' when 'refund' then 'refund' else 'reversal' end,t,auth.uid(),trim(p_data->>'note'),case when op='reverse' then p.id else null end,k) returning id into pid;
 update public.subscriptions set payment_status=case when net+a>=amount then 'paid'::public.payment_status when net+a=0 and op in ('refund','reverse') then 'refunded'::public.payment_status else 'pending'::public.payment_status end,
 paid_at=case when net+a>=amount then t else null end where id=s.id;
 return jsonb_build_object('id',pid,'paid',net+a,'balance',s.amount-net-a);
end;$$;
create function public.payments_command(p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.payments_command(p_data);$$;
revoke all on function app_private.payments_command(jsonb),public.payments_command(jsonb) from public,anon;
grant execute on function app_private.payments_command(jsonb),public.payments_command(jsonb) to authenticated;
