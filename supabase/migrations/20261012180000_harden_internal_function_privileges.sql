-- Internal SECURITY DEFINER routines must not be callable as an API by arbitrary roles.
-- Keep only the helper functions that RLS policies call directly executable by authenticated.
begin;

revoke execute on all functions in schema app_private from public, anon, authenticated;
alter default privileges in schema app_private revoke execute on functions from public;

grant execute on function app_private.current_role() to authenticated;
grant execute on function app_private.is_center_admin(uuid) to authenticated;
grant execute on function app_private.instructor_can_access_member_center(uuid, uuid) to authenticated;

-- These checks make the intended privilege boundary explicit and fail the migration if drift exists.
do $verification$
begin
  if has_function_privilege('anon', 'app_private.consume_lesson_credit(uuid)', 'execute') then
    raise exception 'anon must not execute app_private.consume_lesson_credit(uuid)';
  end if;
  if has_function_privilege('authenticated', 'app_private.consume_lesson_credit(uuid)', 'execute') then
    raise exception 'authenticated must not execute app_private.consume_lesson_credit(uuid)';
  end if;
  if not has_function_privilege('authenticated', 'app_private.current_role()', 'execute') then
    raise exception 'authenticated must execute app_private.current_role() for RLS';
  end if;
  if not has_function_privilege('authenticated', 'app_private.is_center_admin(uuid)', 'execute') then
    raise exception 'authenticated must execute app_private.is_center_admin(uuid) for RLS';
  end if;
  if not has_function_privilege('authenticated', 'app_private.instructor_can_access_member_center(uuid,uuid)', 'execute') then
    raise exception 'authenticated must execute app_private.instructor_can_access_member_center(uuid,uuid) for RLS';
  end if;
end;
$verification$;

commit;
