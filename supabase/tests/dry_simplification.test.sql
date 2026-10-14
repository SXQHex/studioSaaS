-- Behavioral regressions for bounded lists and shared package eligibility.
begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
 ('d1000000-0000-4000-8000-000000000001','authenticated','authenticated','dry-admin@example.invalid','',now(),'{}','{}'),
 ('d1000000-0000-4000-8000-000000000002','authenticated','authenticated','dry-other@example.invalid','',now(),'{}','{}'),
 ('d1000000-0000-4000-8000-000000000003','authenticated','authenticated','dry-student@example.invalid','',now(),'{}','{}'),
 ('d1000000-0000-4000-8000-000000000004','authenticated','authenticated','dry-instructor@example.invalid','',now(),'{}','{}');
insert into public.organizations(id,name,slug) values('d2000000-0000-4000-8000-000000000001','DRY Org','dry-test-org');
insert into public.centers(id,organization_id,name) values
 ('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','DRY A'),
 ('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','DRY B');
insert into public.center_role_assignments(center_id,profile_id,role) values
 ('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','admin'),
 ('d3000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','admin'),
 ('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000004','instructor');
insert into public.members(id,center_id,full_name,profile_id) values
 ('d4000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','DRY Student','d1000000-0000-4000-8000-000000000003'),
 ('d4000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000002','DRY Secret',null);
insert into public.members(center_id,full_name) select 'd3000000-0000-4000-8000-000000000001', 'DRY Member '||lpad(n::text,3,'0') from generate_series(1,51) n;
insert into public.rooms(id,center_id,name,capacity) values('d6000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','DRY room',10);
insert into public.lessons(id,center_id,room_id,instructor_id,type,title,private_member_id,starts_at,ends_at,expected_attendees) values
 ('d5000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000004','private','DRY extended package','d4000000-0000-4000-8000-000000000001',now()+interval '5 days',now()+interval '5 days 1 hour',1),
 ('d5000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000004','private','DRY frozen package','d4000000-0000-4000-8000-000000000001',now()+interval '1 day',now()+interval '1 day 1 hour',1);
insert into public.subscriptions(id,center_id,member_id,type,starts_on,ends_on,credits_purchased,credits_remaining) values
 ('d7000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001','private_credits',current_date,current_date+2,8,8);
insert into public.subscription_freezes(subscription_id,starts_on,ends_on,note,actor_id) values
 ('d7000000-0000-4000-8000-000000000001',current_date,current_date+3,'DRY freeze','d1000000-0000-4000-8000-000000000001');
insert into public.subscriptions(center_id,member_id,type,starts_on,credits_purchased,credits_remaining)
 select 'd3000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001','group_4_weeks',current_date,4,4 from generate_series(1,1001);
set local role authenticated;
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
do $$declare first_page jsonb; second_page jsonb; n bigint;begin
 first_page:=public.workspace_section('catalog','members',1,'DRY','full_name');
 second_page:=public.workspace_section('catalog','members',2,'DRY','full_name');
 if jsonb_array_length(first_page->'rows')<>25 or (first_page->>'total')::int<>52 then raise exception 'first page must be bounded, count complete';end if;
 if exists(select 1 from jsonb_array_elements(first_page->'rows') a join jsonb_array_elements(second_page->'rows') b on a->>'id'=b->>'id') then raise exception 'pages overlap';end if;
 if exists(select 1 from jsonb_array_elements(first_page->'rows') x where x->>'center_id'<>'d3000000-0000-4000-8000-000000000001') then raise exception 'cross-center leak';end if;
 if (public.subscription_stats()->>'active')::int<>1002 or (public.subscription_stats()->>'remainingCredits')::int<>4012 then raise exception 'stats truncated at API row limit';end if;
 select available_credits into n from public.lesson_package_eligibility('d5000000-0000-4000-8000-000000000001');
 if n<>8 then raise exception 'extended package incorrectly rejected';end if;
 select available_credits into n from public.lesson_package_eligibility('d5000000-0000-4000-8000-000000000002');
 if n<>0 then raise exception 'frozen package incorrectly accepted';end if;
 begin perform public.workspace_section('crm','members');raise exception 'module allowlist bypass';exception when raise_exception then if sqlerrm <> 'Liste parametreleri geçersiz.' then raise;end if;end;
end;$$;
-- Every source query is executed, including empty datasets, so projection regressions fail.
do $$declare m text;s text;r jsonb;begin
 for m,s in select * from (values
('groups','centers'),
('groups','rooms'),
('groups','instructors'),
('groups','members'),
('groups','groups'),
('groups','enrollments'),
('groups','lessons'),
('groups','waitlist'),
('payments','centers'),
('payments','members'),
('payments','subscriptions'),
('payments','payments'),
('lesson-operations','members'),
('lesson-operations','lessons'),
('lesson-operations','outcomes'),
('lesson-operations','changes'),
('crm','centers'),
('crm','leads'),
('crm','tasks'),
('catalog','centers'),
('catalog','members'),
('catalog','catalog'),
('catalog','subscriptions'),
('catalog','freezes'),
('crm-automation','centers'),
('crm-automation','leads'),
('crm-automation','tasks'),
('crm-automation','forms'),
('crm-automation','managers'),
('progress','members'),
('progress','progress'),
('communication','emails'),
('registration','centers'),
('registration','members'),
('registration','policies'),
('registration','documents')
) checks(module,section) loop
 r:=public.workspace_section(m,s);
 if jsonb_typeof(r->'rows')<>'array' or jsonb_array_length(r->'rows')>25 then raise exception 'invalid list contract for %/%',m,s;end if;
 end loop;
 if (public.workspace_section('catalog','members',1,'Member 051')->>'total')::int<>1 then raise exception 'search outside initial page failed';end if;
 if (public.workspace_section('catalog','members',1,'','id',true,'{"center_id":"d3000000-0000-4000-8000-000000000002"}')->>'total')::int<>0 then raise exception 'filter bypassed scope';end if;
end;$$;
-- A student cannot read the manager module or a staff-only eligibility RPC.
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000003',true);
do $$begin
 begin perform public.workspace_section('catalog','members');raise exception 'student manager read succeeded';exception when insufficient_privilege then null;end;
 begin perform public.lesson_package_eligibility('d5000000-0000-4000-8000-000000000001');raise exception 'student staff read succeeded';exception when insufficient_privilege then null;end;
 if jsonb_array_length(public.registration_self_workspace()->'members')<>1 then raise exception 'self registration must exclude other students';end if;
end;$$;
reset role;
-- Eligibility is the same selector used for real credit consumption; duplicate charge is harmless.
select set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
select app_private.charge_lesson_member('d5000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001');
select app_private.charge_lesson_member('d5000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001');
do $$begin
 if (select credits_remaining from public.subscriptions where id='d7000000-0000-4000-8000-000000000001')<>7 then raise exception 'duplicate consumption';end if;
 begin perform app_private.charge_lesson_member('d5000000-0000-4000-8000-000000000002','d4000000-0000-4000-8000-000000000001');raise exception 'frozen credit charged';exception when raise_exception then if sqlerrm <> 'Katılımcı için kullanılabilir ders kredisi yok.' then raise;end if;end;
end;$$;
rollback;
