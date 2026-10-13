-- Synthetic end-to-end database authorization checks: verified identity,
-- same-center uniqueness, cross-center isolation, audited unlink and concurrent roles.
BEGIN;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
('a1000000-0000-4000-8000-000000000001','authenticated','authenticated','qa-manager-a@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Manager A"}'::jsonb),
('a1000000-0000-4000-8000-000000000002','authenticated','authenticated','qa-manager-b@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Manager B"}'::jsonb),
('a1000000-0000-4000-8000-000000000003','authenticated','authenticated','qa-student@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Student QA"}'::jsonb),
('a1000000-0000-4000-8000-000000000004','authenticated','authenticated','qa-unverified@example.invalid','',null,'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Unverified QA"}'::jsonb);

insert into public.organizations(id,name,slug) values
('a2000000-0000-4000-8000-000000000001','QA Linking A','qa-linking-a'),
('a2000000-0000-4000-8000-000000000002','QA Linking B','qa-linking-b');
insert into public.centers(id,organization_id,name) values
('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','QA Center A'),
('a3000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','QA Center B');
insert into public.center_role_assignments(center_id,profile_id,role) values
('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','admin'),
('a3000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','admin');
insert into public.members(id,center_id,full_name,email) values
('a4000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','Linked Member A','qa-student@example.invalid'),
('a4000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000001','Duplicate Member A','qa-student@example.invalid'),
('a4000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000002','Linked Member B','qa-student@example.invalid'),
('a4000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000001','Other Email','someone-else@example.invalid');

SET LOCAL ROLE authenticated;
DO $qa$
declare
  v_id uuid;
  v_count integer;
  blocked boolean;
begin
  perform set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000001',true);

  select profile_id into v_id from public.lookup_center_account(
    'a3000000-0000-4000-8000-000000000001','QA-STUDENT@example.invalid');
  if v_id <> 'a1000000-0000-4000-8000-000000000003' then
    raise exception 'Exact email lookup failed';
  end if;
  select count(*) into v_count from public.lookup_center_account(
    'a3000000-0000-4000-8000-000000000001','qa-unverified@example.invalid');
  if v_count <> 0 then raise exception 'Unconfirmed account was visible'; end if;

  select public.link_member_account(
    'a4000000-0000-4000-8000-000000000001','QA-STUDENT@example.invalid') into v_id;
  if v_id <> 'a1000000-0000-4000-8000-000000000003' then
    raise exception 'Member A failed to link';
  end if;

  blocked:=false;
  begin
    perform public.link_member_account(
      'a4000000-0000-4000-8000-000000000002','qa-student@example.invalid');
  exception when sqlstate 'P0001' then blocked:=true;
  end;
  if not blocked then raise exception 'Same-center duplicate member link allowed'; end if;

  blocked:=false;
  begin
    perform public.link_member_account(
      'a4000000-0000-4000-8000-000000000004','qa-student@example.invalid');
  exception when sqlstate 'P0001' then blocked:=true;
  end;
  if not blocked then raise exception 'Mismatched member/account email accepted'; end if;

  blocked:=false;
  begin
    perform public.link_member_account(
      'a4000000-0000-4000-8000-000000000003','qa-student@example.invalid');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Cross-center linking accepted'; end if;

  blocked:=false;
  begin
    perform public.lookup_center_account(
      'a3000000-0000-4000-8000-000000000002','qa-student@example.invalid');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Cross-center account lookup accepted'; end if;

  blocked:=false;
  begin
    update public.members set profile_id='a1000000-0000-4000-8000-000000000004'
     where id='a4000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Direct profile_id update was allowed'; end if;

  blocked:=false;
  begin
    insert into public.members(center_id,full_name,email,profile_id) values(
      'a3000000-0000-4000-8000-000000000001','Untrusted direct link','qa-unverified@example.invalid',
      'a1000000-0000-4000-8000-000000000004');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'Direct profile_id insert was allowed'; end if;

  perform public.unlink_member_account('a4000000-0000-4000-8000-000000000001');
  if (select profile_id from public.members where id='a4000000-0000-4000-8000-000000000001') is not null then
    raise exception 'Unlink failed';
  end if;
  select count(*) into v_count from public.member_account_link_audit
    where member_id='a4000000-0000-4000-8000-000000000001';
  if v_count <> 2 then raise exception 'Link/unlink audit was not preserved'; end if;

  perform public.link_member_account('a4000000-0000-4000-8000-000000000001','qa-student@example.invalid');
  perform public.assign_center_role('a3000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003','instructor');

  perform set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000002',true);
  perform public.link_member_account('a4000000-0000-4000-8000-000000000003','qa-student@example.invalid');

  perform set_config('request.jwt.claim.sub','a1000000-0000-4000-8000-000000000003',true);
  select count(*) into v_count from public.members
    where profile_id=(select auth.uid());
  if v_count <> 2 then raise exception 'Student cannot see both center memberships: %',v_count; end if;
  if not app_private.has_center_role('a3000000-0000-4000-8000-000000000001','instructor') then
    raise exception 'Concurrent staff role was lost';
  end if;
  if app_private.has_center_role('a3000000-0000-4000-8000-000000000002','instructor') then
    raise exception 'Teaching role leaked to second center';
  end if;
end;
$qa$;
RESET ROLE;
ROLLBACK;
