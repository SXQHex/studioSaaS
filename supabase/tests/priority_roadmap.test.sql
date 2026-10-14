-- Todo 2: scoped instructor rosters, profile edits, student membership isolation.
-- Synthetic fixtures only. Never use the persistent @ftk.com development accounts.
begin;
insert into auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values
 ('b1000000-0000-4000-8000-000000000001','authenticated','authenticated','t2-manager@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('b1000000-0000-4000-8000-000000000002','authenticated','authenticated','t2-instructor@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('b1000000-0000-4000-8000-000000000003','authenticated','authenticated','t2-assistant@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('b1000000-0000-4000-8000-000000000004','authenticated','authenticated','t2-student@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb),
 ('b1000000-0000-4000-8000-000000000005','authenticated','authenticated','t2-other-instructor@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);

insert into public.organizations(id,name,slug) values
 ('b2000000-0000-4000-8000-000000000001','Todo2 Org A','t2-org-a'),
 ('b2000000-0000-4000-8000-000000000002','Todo2 Org B','t2-org-b');
insert into public.centers(id,organization_id,name) values
 ('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','Todo2 Center A'),
 ('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','Todo2 Center B');

insert into public.rooms(id,center_id,name,capacity) values
 ('b6000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','Todo2 Room A',15),
 ('b6000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','Todo2 Room B',15);
insert into public.center_role_assignments(center_id,profile_id,role) values
 ('b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','admin'),
 ('b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','instructor'),
 ('b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','ainstructor'),
 ('b3000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000005','instructor');

insert into public.members(id,center_id,full_name,profile_id,email) values
 ('b4000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','Todo2 Student A','b1000000-0000-4000-8000-000000000004','t2-student@example.invalid'),
 ('b4000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','Todo2 Student B',null,'t2-other-member@example.invalid');

insert into public.lessons(id,center_id,type,title,starts_at,ends_at,status,instructor_id,expected_attendees,room_id) values
 ('b5000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','group','Todo2 Group A',now()+interval '7 days',now()+interval '7 days 1 hour','scheduled','b1000000-0000-4000-8000-000000000002',10,'b6000000-0000-4000-8000-000000000001'),
 ('b5000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','group','Todo2 Group B',now()+interval '8 days',now()+interval '8 days 1 hour','scheduled','b1000000-0000-4000-8000-000000000005',10,'b6000000-0000-4000-8000-000000000002');
insert into public.lessons(id,center_id,type,title,starts_at,ends_at,status,instructor_id,private_member_id,expected_attendees,room_id) values
 ('b5000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000001','private','Todo2 Private A',now()+interval '9 days',now()+interval '9 days 1 hour','scheduled','b1000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000001',1,'b6000000-0000-4000-8000-000000000001');

insert into public.lesson_staff_assignments(lesson_id,center_id,profile_id,role)
values ('b5000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000003','ainstructor');
insert into public.lesson_enrollments(lesson_id,center_id,member_id) values
 ('b5000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001'),
 ('b5000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000002');


insert into public.members(id,center_id,full_name) values('b4000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000001','Second Student');

set local role authenticated;
do $$
declare cid uuid:='b3000000-0000-4000-8000-000000000001';mid uuid:='b4000000-0000-4000-8000-000000000001';cat uuid;sub uuid:=gen_random_uuid();pol uuid;r jsonb;denied boolean;lid uuid;
begin
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
 r:=public.catalog_command(jsonb_build_object('action','create','center_id',cid,'name','6 group pilot','lesson_type','group','credits',6,'price',1200,'validity_days',30,'freeze_days',4,'freeze_count',2));cat:=(r->>'id')::uuid;
 perform public.catalog_command(jsonb_build_object('action','sell','member_id',mid,'catalog_id',cat,'starts_on',current_date,'key',sub));
 perform public.catalog_command(jsonb_build_object('action','sell','member_id',mid,'catalog_id',cat,'starts_on',current_date,'key',sub));
 if (select credits_purchased from public.subscriptions where id=sub)<>6 then raise exception 'Catalog group credits forced to 4';end if;
 perform public.catalog_command(jsonb_build_object('action','freeze','subscription_id',sub,'starts_on',current_date+1,'ends_on',current_date+2,'note','Pilot pause'));
 if (public.catalog_workspace()->'subscriptions') is null then raise exception 'Catalog workspace missing';end if;
 denied:=false;begin perform public.catalog_command(jsonb_build_object('action','freeze','subscription_id',sub,'starts_on',current_date+1,'ends_on',current_date+2,'note','Duplicate'));exception when exclusion_violation then denied:=true;end;
 if not denied then raise exception 'Overlapping freezes allowed';end if;
 perform public.registration_command(jsonb_build_object('action','publish','center_id',cid,'title','Rules v1','body','First rules','required',true));
 select (p->>'id')::uuid into pol from jsonb_array_elements(public.registration_workspace()->'policies') p where p->>'title'='Rules v1';
 denied:=false;begin perform public.registration_command(jsonb_build_object('action','accept','member_id',mid,'policy_id',pol));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Manager accepted on student behalf';end if;
 perform public.crm_automation_command(jsonb_build_object('action','form','center_id',cid,'slug','pilot-form','title','Pilot'));
 perform public.progress_command(jsonb_build_object('action','create','member_id',mid,'lesson_type','group','level','Beginner','skill','Walk','score',3,'note','Private note','student_visible',false));
 perform public.progress_command(jsonb_build_object('action','create','member_id',mid,'lesson_type','group','level','Beginner','skill','Balance','score',4,'note','Visible note','student_visible',true));
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000004',true);
 perform public.registration_command(jsonb_build_object('action','accept','member_id',mid,'policy_id',pol));
 perform public.registration_command(jsonb_build_object('action','accept','member_id',mid,'policy_id',pol));
 perform public.registration_command(jsonb_build_object('action','details','member_id',mid,'phone','5551234567','emergency_name','','emergency_phone','','marketing_opt_in',false));
 if jsonb_array_length(public.registration_workspace()->'acceptances')<>1 then raise exception 'Duplicate acceptance';end if;
 if jsonb_array_length(public.progress_workspace()->'progress')<>1 then raise exception 'Private progress leaked to student';end if;
 denied:=false;begin perform public.roadmap_workspace('communication');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Student reads email outbox';end if;
 denied:=false;begin perform public.catalog_command(jsonb_build_object('action','archive','id',cat));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Student edits catalog';end if;
 denied:=false;begin perform public.crm_intake_submit('pilot-form','{}');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Intake publicly callable';end if;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
 perform public.registration_command(jsonb_build_object('action','publish','center_id',cid,'title','Rules v2','body','Second rules','required',true));
 if not exists(select 1 from jsonb_array_elements(public.registration_workspace()->'members') m where m->>'id'=mid::text and m->>'missing' like '%Kural%') then raise exception 'New version did not require new acceptance';end if;
 r:=public.planning_workspace(current_date,current_date+6);
 if jsonb_array_length(r->'centers')<>1 then raise exception 'Planning cross center leak';end if;
 denied:=false;begin perform public.planning_command(jsonb_build_object('action','block','center_id','b3000000-0000-4000-8000-000000000002','resource_kind','center','resource_id','','starts_at',now()+interval '50 days','ends_at',now()+interval '50 days 1 hour','kind','closed','title','Unauthorized'));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross center planning allowed';end if;
 perform public.planning_command(jsonb_build_object('action','block','center_id',cid,'resource_kind','center','resource_id','','starts_at',now()+interval '50 days','ends_at',now()+interval '50 days 1 hour','kind','closed','title','Closed'));
 denied:=false;begin
 insert into public.lessons(center_id,type,title,starts_at,ends_at,status,instructor_id,expected_attendees,room_id) values(cid,'group','Closed slot',now()+interval '50 days',now()+interval '50 days 1 hour','scheduled','b1000000-0000-4000-8000-000000000002',5,'b6000000-0000-4000-8000-000000000001');
 exception when others then denied:=true;end;
 if not denied then raise exception 'Closed resource booked';end if;
 perform public.planning_command(jsonb_build_object('action','block','center_id',cid,'resource_kind','center','resource_id','','starts_at',now()+interval '51 days','ends_at',now()+interval '51 days 1 hour','kind','group_draft','title','Draft'));
 insert into public.lessons(center_id,type,title,starts_at,ends_at,status,instructor_id,expected_attendees,room_id) values(cid,'group','Draft is soft',now()+interval '51 days',now()+interval '51 days 1 hour','scheduled','b1000000-0000-4000-8000-000000000002',5,'b6000000-0000-4000-8000-000000000001');
 r:=public.roadmap_workspace('insights',current_date-29,current_date);
 if r->'previous' is null then raise exception 'Previous period missing';end if;
end;$$;
reset role;
set local role service_role;
select public.crm_intake_limited('pilot-form','{"full_name":"Web Candidate","email":"candidate@example.invalid","phone":"","interests":"group","marketing_opt_in":false}','hash1');
select public.crm_intake_limited('pilot-form','{"full_name":"Web Candidate","email":"candidate@example.invalid","phone":"","interests":"group","marketing_opt_in":false}','hash1');
reset role;
do $$declare lid uuid;begin
 select id into lid from public.crm_leads where email='candidate@example.invalid';
 if (select count(*) from public.crm_leads where email='candidate@example.invalid')<>1 or (select count(*) from public.crm_tasks where lead_id=lid)<>1 then raise exception 'Intake duplicates lead/task';end if;
end;$$;
set local role authenticated;
do $$declare lid uuid;begin
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
 select id into lid from public.crm_leads where email='candidate@example.invalid';
 perform public.crm_automation_command(jsonb_build_object('action','trial','lead_id',lid,'outcome','attended'));
 perform public.crm_automation_command(jsonb_build_object('action','trial','lead_id',lid,'outcome','attended'));
 if (select count(*) from public.crm_tasks where lead_id=lid and automation_key like 'trial:%')<>1 then raise exception 'Trial duplicate task';end if;
end;$$;
reset role;
insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href,dedupe_key)
values('b1000000-0000-4000-8000-000000000004','b2000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','studio_lesson_changed','Pilot email','Changed','/dashboard/my-learning','pilot-email');
set local role service_role;
do $$declare r jsonb;row jsonb;begin
 r:=public.claim_studio_emails(array['b3000000-0000-4000-8000-000000000001'::uuid]);
 select x into row from jsonb_array_elements(r) x where x->>'title'='Pilot email';
 if row is null then raise exception 'Notification not queued';end if;
 if jsonb_array_length(public.claim_studio_emails(array['b3000000-0000-4000-8000-000000000001'::uuid]))<>0 then raise exception 'Live lease claimed twice';end if;
 perform public.finish_studio_email((row->>'id')::uuid,gen_random_uuid(),'sent','wrong',null);
 if (select status from public.studio_email_outbox where id=(row->>'id')::uuid)<>'processing' then raise exception 'Wrong lease changed email';end if;
 perform public.finish_studio_email((row->>'id')::uuid,(row->>'lease_token')::uuid,'sent','provider-pilot',null);
 perform public.studio_email_event('event-pilot','provider-pilot','email.delivered',now());
 perform public.studio_email_event('event-pilot','provider-pilot','email.delivered',now());
 if (select status from public.studio_email_outbox where id=(row->>'id')::uuid)<>'delivered' or (select count(*) from public.studio_email_events where event_id='event-pilot')<>1 then raise exception 'Receipt not idempotent';end if;
end;$$;
reset role;
rollback;
