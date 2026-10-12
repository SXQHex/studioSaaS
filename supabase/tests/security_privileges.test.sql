-- Run after the schema baseline and the internal-function privilege migration.
-- Raise SQL exceptions on failures so psql exits non-zero in CI.
do $verification$
declare
  v_rpc regprocedure := 'public.create_session_request(uuid,uuid,public.lesson_type,text,uuid,timestamptz,timestamptz,integer,text,uuid)'::regprocedure;
begin
  if has_function_privilege('anon', 'app_private.consume_lesson_credit(uuid)', 'execute') then
    raise exception 'anon can execute app_private.consume_lesson_credit(uuid)';
  end if;
  if has_function_privilege('authenticated', 'app_private.consume_lesson_credit(uuid)', 'execute') then
    raise exception 'authenticated can execute app_private.consume_lesson_credit(uuid)';
  end if;
  if has_function_privilege('authenticated', 'app_private.apply_manual_credit_change()', 'execute') then
    raise exception 'authenticated can execute the internal credit-ledger trigger routine';
  end if;
  if not has_function_privilege('authenticated', 'app_private.current_role()', 'execute') then
    raise exception 'authenticated cannot execute current_role for RLS';
  end if;
  if not has_function_privilege('authenticated', 'app_private.is_center_admin(uuid)', 'execute') then
    raise exception 'authenticated cannot execute is_center_admin for RLS';
  end if;
  if not has_function_privilege('authenticated', 'app_private.instructor_can_access_member_center(uuid,uuid)', 'execute') then
    raise exception 'authenticated cannot execute instructor assignment predicate for RLS';
  end if;
  if has_function_privilege('anon', v_rpc, 'execute') then
    raise exception 'anon can execute public.create_session_request';
  end if;
  if not has_function_privilege('authenticated', v_rpc, 'execute') then
    raise exception 'authenticated cannot execute public.create_session_request';
  end if;
  if not exists (
    select 1 from pg_proc p
    where p.oid = v_rpc and p.prosecdef
      and array_position(p.proconfig, 'search_path=""') is not null
  ) then
    raise exception 'create_session_request is not SECURITY DEFINER with an empty search_path';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.members'::regclass) then
    raise exception 'members table does not have RLS enabled';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private' and p.prosecdef
      and p.proname not in ('current_role', 'is_center_admin', 'instructor_can_access_member_center')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  ) then
    raise exception 'unexpected direct EXECUTE grant exists for an internal SECURITY DEFINER function';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity) <> 12 then
    raise exception 'expected all 12 public application tables to have RLS enabled';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public') <> 23 then
    raise exception 'baseline policy count differs from the live schema (expected 23)';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'i') <> 46 then
    raise exception 'baseline public index count differs from live schema (expected 46)';
  end if;
  if (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal) <> 21 then
    raise exception 'baseline public trigger count differs from live schema (expected 21)';
  end if;
end;
$verification$;
