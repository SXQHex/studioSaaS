-- Integration test for center-level RLS using synthetic users and rows only.
-- Run after the baseline and privilege migration in an isolated Supabase database.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test-admin-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Test Admin A"}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test-admin-b@example.invalid', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Test Admin B"}'::jsonb);

update public.profiles set role = 'admin'::public.app_role
where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002');

insert into public.organizations (id, name, slug)
values ('20000000-0000-0000-0000-000000000001', 'Isolation Test A', 'isolation-test-a');
insert into public.centers (id, organization_id, name)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Test Center A'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Test Center B');
insert into public.center_admins (center_id, profile_id)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');
insert into public.members (id, center_id, full_name)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Synthetic Member A'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Synthetic Member B');

set local role authenticated;
do $test$
declare
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
  select count(*) into v_count from public.members;
  if v_count <> 1 then
    raise exception 'center A admin should see exactly one member, saw %', v_count;
  end if;

  begin
    insert into public.members (center_id, full_name)
    values ('30000000-0000-0000-0000-000000000002', 'Cross-center write must fail');
    raise exception 'center A admin unexpectedly inserted a member into center B';
  exception when insufficient_privilege then
    null;
  end;

  perform set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
  select count(*) into v_count from public.members;
  if v_count <> 1 then
    raise exception 'center B admin should see exactly one member, saw %', v_count;
  end if;
end;
$test$;

reset role;
rollback;
