-- Execute after applying the additive scoped role migration.
do $verify$
declare
  table_name text;
begin
  foreach table_name in array array[
    'platform_role_assignments',
    'organization_role_assignments',
    'center_role_assignments',
    'lesson_staff_assignments',
    'lesson_enrollments'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = table_name and c.relrowsecurity
    ) then
      raise exception 'missing RLS for %', table_name;
    end if;
    if has_table_privilege('anon', 'public.' || table_name, 'SELECT') or
       has_table_privilege('authenticated', 'public.' || table_name, 'INSERT') or
       has_table_privilege('authenticated', 'public.' || table_name, 'UPDATE') or
       has_table_privilege('authenticated', 'public.' || table_name, 'DELETE') then
      raise exception 'unexpected anonymous read or authenticated mutation: %', table_name;
    end if;
    if not has_table_privilege('authenticated', 'public.' || table_name, 'SELECT') then
      raise exception 'authenticated self-read grant missing: %', table_name;
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=table_name and cmd='SELECT'
    ) then
      raise exception 'no self-read RLS policy on %', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.lesson_enrollments'::regclass and contype='f'
      and pg_get_constraintdef(oid) like '%(lesson_id, center_id)%'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid='public.lesson_enrollments'::regclass and contype='f'
      and pg_get_constraintdef(oid) like '%(member_id, center_id)%'
  ) then
    raise exception 'cross-center enrollment integrity is not enforced';
  end if;

  if not exists (select 1 from information_schema.columns col
    where col.table_schema='public' and col.table_name='profiles' and col.column_name='role') then
    raise exception 'legacy role was removed before application cutover';
  end if;
end;
$verify$;
