-- Post-cutover invariant checks. Applies only to an isolated test database.
do $checks$
declare name text;
begin
 foreach name in array array[
 'profiles','organizations','centers','rooms','members','lessons',
 'attendance','subscriptions','credit_transactions','session_requests'
 ] loop
   if exists (
    select 1 from pg_policies p
    where p.schemaname='public' and p.tablename=name
      and (coalesce(p.qual,'') ilike '%current_role(%'
        or coalesce(p.with_check,'') ilike '%current_role(%')
   ) then raise exception 'Legacy role reference remained in RLS on %',name; end if;
   if not exists (
    select 1 from pg_policies p where p.schemaname='public' and p.tablename=name
   ) then raise exception 'No RLS policies found for %',name; end if;
 end loop;
 if has_table_privilege('authenticated','public.center_role_assignments','INSERT')
    or has_table_privilege('authenticated','public.organization_role_assignments','INSERT')
    or has_table_privilege('authenticated','public.platform_role_assignments','INSERT') then
   raise exception 'Client can write privileged role assignment table';
 end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='my_scoped_roles') then
   raise exception 'Missing role resolver';
 end if;
 if not exists (select 1 from pg_constraint
   where conrelid='public.lesson_staff_assignments'::regclass
     and conname='lesson_staff_role_center_fkey') then
   raise exception 'Lesson staff may lack center scoped role';
 end if;
end;
$checks$;
