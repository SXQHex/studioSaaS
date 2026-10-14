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

insert into auth.users(id,aud,role,email,email_confirmed_at) values
('b1000000-0000-4000-8000-000000000006','authenticated','authenticated','policy-owner@example.invalid',now());
insert into public.organization_role_assignments(organization_id,profile_id,role)
values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000006','owner');
insert into public.subscriptions(id,member_id,center_id,type,starts_on,credits_purchased,credits_remaining,amount,created_by) values
('b7000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','private_credits',current_date-1,10,10,1000,'b1000000-0000-4000-8000-000000000001'),
('b7000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','group_4_weeks',current_date-1,4,4,0,'b1000000-0000-4000-8000-000000000001');
insert into public.lessons(id,center_id,room_id,instructor_id,type,title,private_member_id,starts_at,ends_at,expected_attendees) values
('b5000000-0000-4000-8000-000000000011','b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','private','12h boundary','b4000000-0000-4000-8000-000000000001',now()+interval '12 hours',now()+interval '13 hours',1),
('b5000000-0000-4000-8000-000000000012','b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','private','11h late','b4000000-0000-4000-8000-000000000001',now()+interval '10 hours',now()+interval '11 hours',1);
set local role authenticated;
do $$declare r jsonb;denied boolean;cid uuid:='b3000000-0000-4000-8000-000000000001';oid uuid:='b2000000-0000-4000-8000-000000000001';begin
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
if has_table_privilege('authenticated','public.organization_policies','UPDATE') or has_table_privilege('authenticated','public.policy_audit','DELETE') then raise exception 'Policy writes/audit deletion exposed';end if;
perform public.policy_command(jsonb_build_object('action','center','center_id',cid,'key','private_cancel_hours','value',10,'expected_revision',0,'reason','Merkez tercihi'));
perform public.policy_command(jsonb_build_object('action','reset','center_id',cid,'key','private_cancel_hours','expected_revision',1,'reason','Varsayılana dön'));
denied:=false;begin
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','private_cancel_hours','mode','mandatory','value',12,'expected_revision',0,'reason','Yetkisiz'));
exception when insufficient_privilege then denied:=true;end;
if not denied then raise exception 'Center admin changed organization policy';end if;
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','private_cancel_hours','mode','recommended','value',12,'min',6,'max',24,'expected_revision',0,'reason','Organizasyon önerisi'));
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
denied:=false;begin
perform public.policy_command(jsonb_build_object('action','center','center_id',cid,'key','private_cancel_hours','value',25,'expected_revision',2,'reason','Sınır aşımı'));
exception when others then denied:=true;end;
if not denied then raise exception 'Out of bounds center value accepted';end if;
perform public.policy_command(jsonb_build_object('action','center','center_id',cid,'key','private_cancel_hours','value',8,'expected_revision',2,'reason','Merkez tercihi'));
denied:=false;begin
perform public.policy_command(jsonb_build_object('action','center','center_id',cid,'key','private_cancel_hours','value',9,'expected_revision',1,'reason','Old reset-era screen'));
exception when others then denied:=true;end;
if not denied then raise exception 'Reset ABA revision bypassed';end if;
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','private_cancel_hours','mode','recommended','value',14,'min',6,'max',24,'expected_revision',1,'reason','Öneri güncelle'));
r:=public.policy_workspace();
if not exists(select 1 from jsonb_array_elements(r->'centers')c where c->>'id'=cid::text and c->'effective'->'private_cancel_hours'->>'value'='8') then raise exception 'Organization default erased center choice';end if;
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','private_cancel_hours','mode','mandatory','value',12,'min',6,'max',24,'expected_revision',2,'reason','Zorunlu'));
denied:=false;begin
perform public.policy_command(jsonb_build_object('action','center','center_id',cid,'key','private_cancel_hours','value',6,'expected_revision',3,'reason','Owner bypass'));
exception when others then denied:=true;end;
if not denied then raise exception 'Owner bypassed mandatory center rule';end if;
denied:=false;begin
perform public.policy_command(jsonb_build_object('action','organization','organization_id','b2000000-0000-4000-8000-000000000002','key','private_cancel_hours','mode','mandatory','value',12,'expected_revision',0,'reason','Cross org'));
exception when insufficient_privilege then denied:=true;end;
if not denied then raise exception 'Cross org policy access';end if;
denied:=false;begin
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','private_cancel_hours','mode','mandatory','value',12,'expected_revision',2,'reason','Stale screen'));
exception when others then denied:=true;end;
if not denied then raise exception 'Stale revision accepted';end if;
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000004',true);
perform public.lesson_command(jsonb_build_object('action','student_cancel','lesson_id','b5000000-0000-4000-8000-000000000011','member_id','b4000000-0000-4000-8000-000000000001','note','Tam 12 saat'));
perform public.lesson_command(jsonb_build_object('action','student_cancel','lesson_id','b5000000-0000-4000-8000-000000000012','member_id','b4000000-0000-4000-8000-000000000001','note','Geç iptal'));
if (select credits_remaining from public.subscriptions where id='b7000000-0000-4000-8000-000000000001')<>9 then raise exception '12 hour boundary wrong';end if;
if (select policy_snapshot->'private_cancel_hours'->>'value' from public.lesson_member_outcomes where lesson_id='b5000000-0000-4000-8000-000000000011')<>'12' then raise exception 'Cancellation snapshot missing';end if;
denied:=false;begin perform public.policy_command(jsonb_build_object('action','center','center_id',cid,'key','private_cancel_hours','value',6,'expected_revision',3,'reason','Student bypass'));exception when insufficient_privilege then denied:=true;end;
if not denied then raise exception 'Student edited policy';end if;
end;$$;
reset role;
-- New packages inherit current policy, existing packages keep their own dated snapshot.
set local role authenticated;
do $$declare oid uuid:='b2000000-0000-4000-8000-000000000001';cid uuid:='b3000000-0000-4000-8000-000000000001';denied boolean;mid uuid:='b4000000-0000-4000-8000-000000000001';req uuid;begin
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','private_package_days','mode','mandatory','value',30,'expected_revision',0,'reason','Yeni paket süresi'));
if (select ends_on-starts_on from public.subscriptions where id='b7000000-0000-4000-8000-000000000001')<>90 then raise exception 'Old package was rewritten';end if;
insert into public.subscriptions(member_id,center_id,type,starts_on,credits_purchased,credits_remaining,amount,created_by)
values(mid,cid,'private_credits',current_date,2,2,0,auth.uid());
if not exists(select 1 from public.subscriptions where member_id=mid and ends_on=current_date+30) then raise exception 'New package policy not applied';end if;
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','request_min_hours','mode','mandatory','value',24,'expected_revision',0,'reason','Talep süresi'));
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','request_max_days','mode','mandatory','value',30,'expected_revision',0,'reason','Talep ufku'));
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','request_pending_limit','mode','mandatory','value',1,'expected_revision',0,'reason','Talep sınırı'));
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
denied:=false;begin perform public.create_session_request(cid,'b6000000-0000-4000-8000-000000000001','private','Too soon',mid,now()+interval '2 hours',now()+interval '3 hours',1,null);exception when others then denied:=true;end;
if not denied then raise exception 'Minimum notice bypassed';end if;
denied:=false;begin perform public.create_session_request(cid,'b6000000-0000-4000-8000-000000000001','private','Too far',mid,now()+interval '40 days',now()+interval '40 days 1 hour',1,null);exception when others then denied:=true;end;
if not denied then raise exception 'Maximum horizon bypassed';end if;
req:=public.create_session_request(cid,'b6000000-0000-4000-8000-000000000001','private','Allowed',mid,now()+interval '2 days',now()+interval '2 days 1 hour',1,null);
denied:=false;begin perform public.create_session_request(cid,'b6000000-0000-4000-8000-000000000001','private','Second',mid,now()+interval '3 days',now()+interval '3 days 1 hour',1,null);exception when others then denied:=true;end;
if not denied then raise exception 'Pending limit bypassed';end if;
perform public.withdraw_session_request(req);
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','debt_blocks_requests','mode','mandatory','value',true,'expected_revision',0,'reason','Borç kontrolü'));
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','debt_blocks_enrollment','mode','mandatory','value',true,'expected_revision',0,'reason','Borç kontrolü'));
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
denied:=false;begin perform public.create_session_request(cid,'b6000000-0000-4000-8000-000000000001','private','Debt blocked',mid,now()+interval '2 days',now()+interval '2 days 1 hour',1,null);exception when others then denied:=true;end;
if not denied then raise exception 'Debt request bypassed';end if;
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
denied:=false;begin insert into public.lesson_enrollments(lesson_id,member_id,center_id) values('b5000000-0000-4000-8000-000000000001',mid,cid);exception when others then denied:=true;end;
if not denied then raise exception 'Owner debt enrollment bypassed';end if;
end;$$;
reset role;
-- A recorded exception is the only owner cancellation bypass; a direct data/GUC bypass does not exist.
insert into public.lessons(id,center_id,room_id,instructor_id,type,title,private_member_id,starts_at,ends_at,expected_attendees)
values('b5000000-0000-4000-8000-000000000013','b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','private','Owner exception','b4000000-0000-4000-8000-000000000001',now()+interval '4 hours',now()+interval '5 hours',1);
set local role authenticated;
do $$declare denied boolean;before_credit integer;begin
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
denied:=false;begin perform public.policy_cancel_exception(jsonb_build_object('operation','student_cancel','lesson_id','b5000000-0000-4000-8000-000000000013','member_id','b4000000-0000-4000-8000-000000000001','overrides',jsonb_build_object('late_cancel_charge',false),'reason','Admin bypass'));exception when insufficient_privilege then denied:=true;end;
if not denied then raise exception 'Admin issued owner exception';end if;
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
select credits_remaining into before_credit from public.subscriptions where id='b7000000-0000-4000-8000-000000000001';
perform public.policy_cancel_exception(jsonb_build_object('operation','student_cancel','lesson_id','b5000000-0000-4000-8000-000000000013','member_id','b4000000-0000-4000-8000-000000000001','overrides',jsonb_build_object('late_cancel_charge',false),'reason','Sağlık nedeniyle istisna'));
if (select credits_remaining from public.subscriptions where id='b7000000-0000-4000-8000-000000000001')<>before_credit then raise exception 'Exception charged credit';end if;
if (select count(*) from public.policy_exceptions)<>1 then raise exception 'Exception audit missing';end if;
if not exists(select 1 from public.lesson_member_outcomes where lesson_id='b5000000-0000-4000-8000-000000000013' and policy_snapshot->'late_cancel_charge'->>'source'='authorized_exception') then raise exception 'Exception snapshot missing';end if;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
select public.policy_command(jsonb_build_object('action','organization','organization_id','b2000000-0000-4000-8000-000000000001','key','debt_blocks_enrollment','mode','mandatory','value',false,'expected_revision',1,'reason','Yeni kayıt tekrar açık'));
reset role;
-- Group cancellations have no refund by default; absent-credit decisions remain stable after rule edits.
insert into public.lessons(id,center_id,room_id,instructor_id,type,title,starts_at,ends_at,expected_attendees) values
('b5000000-0000-4000-8000-000000000014','b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','group','Group cancel',now()+interval '4 days',now()+interval '4 days 1 hour',2),
('b5000000-0000-4000-8000-000000000015','b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','group','No-show waived',now()-interval '3 hours',now()-interval '2 hours',2);
insert into public.lesson_enrollments(lesson_id,center_id,member_id) values
('b5000000-0000-4000-8000-000000000014','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001'),
('b5000000-0000-4000-8000-000000000015','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001');
set local role authenticated;
do $$declare oid uuid:='b2000000-0000-4000-8000-000000000001';denied boolean;begin
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000004',true);
perform public.lesson_command(jsonb_build_object('action','student_cancel','lesson_id','b5000000-0000-4000-8000-000000000014','member_id','b4000000-0000-4000-8000-000000000001','note','Grup erken iptal'));
if (select credits_remaining from public.subscriptions where id='b7000000-0000-4000-8000-000000000002')<>3 then raise exception 'Early group cancel unexpectedly free';end if;
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','no_show_charge','mode','mandatory','value',false,'expected_revision',0,'reason','Gelmeme kuralı'));
perform public.lesson_command(jsonb_build_object('action','no_show','lesson_id','b5000000-0000-4000-8000-000000000015','member_id','b4000000-0000-4000-8000-000000000001','note','Gelmedi'));
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','no_show_charge','mode','mandatory','value',true,'expected_revision',1,'reason','Sonraki işlemler'));
update public.lessons set status='completed' where id='b5000000-0000-4000-8000-000000000015';
if (select credits_remaining from public.subscriptions where id='b7000000-0000-4000-8000-000000000002')<>3 then raise exception 'Old no-show snapshot was repriced';end if;
perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','debt_blocks_attendance','mode','mandatory','value',true,'expected_revision',0,'reason','Katılımda borç'));
denied:=false;begin insert into public.attendance(lesson_id,member_id,center_id,attended,checked_in_by) values('b5000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',true,auth.uid());exception when others then denied:=true;end;
if not denied then raise exception 'Owner bypassed mandatory debt attendance';end if;
denied:=false;begin perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','request_max_days','mode','mandatory','value',1,'expected_revision',1,'reason','Invalid combined interval'));
exception when others then denied:=true;end;
if denied then raise exception 'Valid combined window denied';end if;
denied:=false;begin perform public.policy_command(jsonb_build_object('action','organization','organization_id',oid,'key','request_min_hours','mode','mandatory','value',25,'expected_revision',1,'reason','Contradictory window'));
exception when others then denied:=true;end;
if not denied then raise exception 'Contradictory request window accepted';end if;
end;$$;
reset role;
insert into public.lessons(id,center_id,room_id,instructor_id,type,title,private_member_id,starts_at,ends_at,expected_attendees)
values('b5000000-0000-4000-8000-000000000016','b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','private','Reminder window','b4000000-0000-4000-8000-000000000001',now()+interval '36 hours',now()+interval '37 hours',1);
set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
select public.policy_command(jsonb_build_object('action','organization','organization_id','b2000000-0000-4000-8000-000000000001','key','lesson_reminder_hours','mode','mandatory','value',1,'expected_revision',0,'reason','Dar hatırlatma'));
reset role;
select app_private.enqueue_studio_reminders();
do $$begin if exists(select 1 from public.notifications where dedupe_key like 'lesson:b5000000-0000-4000-8000-000000000016:%') then raise exception 'Reminder sent too early';end if;end;$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000006',true);
select public.policy_command(jsonb_build_object('action','organization','organization_id','b2000000-0000-4000-8000-000000000001','key','lesson_reminder_hours','mode','mandatory','value',48,'expected_revision',1,'reason','Geniş hatırlatma'));
reset role;
select app_private.enqueue_studio_reminders();
select app_private.enqueue_studio_reminders();
do $$begin if (select count(*) from public.notifications where recipient_id='b1000000-0000-4000-8000-000000000004' and dedupe_key like 'lesson:b5000000-0000-4000-8000-000000000016:%')<>1 then raise exception 'Policy reminder missing or duplicated';end if;end;$$;
rollback;
