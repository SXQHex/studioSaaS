-- Applied in StudioSaaS (ysplylnwdfwizmuxvcqg) as migration
-- 20261010032120_harden_attendance_and_credit_ledger_writes.
-- This migration intentionally does not rewrite existing user or attendance data.

drop policy if exists attendance_staff_insert on public.attendance;
create policy attendance_staff_insert
on public.attendance
for insert
to authenticated
with check (
  (select app_private.current_role()) = any (array['admin'::app_role, 'instructor'::app_role])
  and exists (
    select 1
    from public.lessons as l
    where l.id = attendance.lesson_id
      and l.status not in ('cancelled'::lesson_status, 'postponed'::lesson_status)
      and (
        l.type = 'group'::lesson_type
        or (
          l.type = 'private'::lesson_type
          and l.private_member_id = attendance.member_id
        )
      )
  )
);

-- No attendance UPDATE interface exists; use admin delete + validated re-insert.
drop policy if exists attendance_admin_manage on public.attendance;

-- Keep credit_transactions as an append-only ledger.
drop policy if exists credit_transactions_admin_manage on public.credit_transactions;
create policy credit_transactions_admin_insert
on public.credit_transactions
for insert
to authenticated
with check (
  (select app_private.current_role()) = 'admin'::app_role
  and reason in ('admin_adjustment', 'refund')
  and exists (
    select 1
    from public.subscriptions as s
    where s.id = credit_transactions.subscription_id
      and s.member_id = credit_transactions.member_id
  )
);

create or replace function app_private.protect_subscription_credit_columns()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin')
    and (
      new.credits_remaining is distinct from old.credits_remaining
      or new.credits_purchased is distinct from old.credits_purchased
    )
  then
    raise exception 'Kredi bakiyesi yalnızca güvenilir veritabanı işlemleriyle değiştirilebilir.';
  end if;

  return new;
end;
$function$;

drop trigger if exists subscriptions_protect_credit_columns on public.subscriptions;
create trigger subscriptions_protect_credit_columns
before update of credits_remaining, credits_purchased
on public.subscriptions
for each row
execute function app_private.protect_subscription_credit_columns();
