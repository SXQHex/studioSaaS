-- Run against an isolated database after scoped migrations. All fixtures roll back.
begin;
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
('91000000-0000-0000-0000-000000000001','authenticated','authenticated','rbac-owner@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
('91000000-0000-0000-0000-000000000002','authenticated','authenticated','rbac-admin@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
('91000000-0000-0000-0000-000000000003','authenticated','authenticated','rbac-student@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);
insert into public.organizations(id,name,slug) values
('92000000-0000-0000-0000-000000000001','RBAC Organization A','rbac-org-a'),
('92000000-0000-0000-0000-000000000002','RBAC Organization B','rbac-org-b');
insert into public.centers(id,organization_id,name) values
('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','RBAC Center A'),
('93000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000002','RBAC Center B');
insert into public.organization_role_assignments(organization_id,profile_id,role) values
('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','owner');
insert into public.center_role_assignments(center_id,profile_id,role) values
('93000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002','admin'),
('93000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002','instructor');

set local role authenticated;
do $assert$
declare n integer;
begin
 perform set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
 if not app_private.is_org_owner('92000000-0000-0000-0000-000000000001') then
   raise exception 'Organization A owner lost owned organization access';
 end if;
 if app_private.is_org_owner('92000000-0000-0000-0000-000000000002') then
   raise exception 'Owner unexpectedly gained another organization';
 end if;
 if not app_private.can_manage_center('93000000-0000-0000-0000-000000000001') then
   raise exception 'Owner cannot manage their own center';
 end if;
 if app_private.can_manage_center('93000000-0000-0000-0000-000000000002') then
   raise exception 'Owner can manage another organization center';
 end if;

 perform set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
 if not app_private.has_center_role('93000000-0000-0000-0000-000000000001','admin')
    or not app_private.has_center_role('93000000-0000-0000-0000-000000000001','instructor') then
   raise exception 'Concurrent roles are not preserved';
 end if;
 if app_private.is_center_admin('93000000-0000-0000-0000-000000000002') then
   raise exception 'Center A manager unexpectedly can manage B';
 end if;
 select count(*) into n from public.centers
   where id in ('93000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000002');
 if n <> 1 then raise exception 'Manager visibility leaked centers: %',n; end if;

 perform set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000003',true);
 if app_private.is_center_admin('93000000-0000-0000-0000-000000000001')
    or app_private.is_org_owner('92000000-0000-0000-0000-000000000001') then
   raise exception 'Student gained staff or ownership role';
 end if;
end;
$assert$;
reset role;
rollback;
