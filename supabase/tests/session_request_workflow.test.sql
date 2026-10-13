-- Todo 3: scoped instructor rosters, profile edits, student membership isolation.
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


insert into public.rooms(id,center_id,name,capacity) values ('b6000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000001','Second Room',15);

set local role authenticated;
do $assert$
declare
 r1 uuid; r2 uuid; r3 uuid; r4 uuid; r5 uuid; r6 uuid; proposal timestamptz;
 denied boolean; lesson uuid; n integer; t timestamptz:=now()+interval '14 days';
begin
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
 r1:=public.create_session_request('b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','private','Request A','b4000000-0000-4000-8000-000000000001',t,t+interval '1 hour',1,null);
 r2:=public.create_session_request('b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','private','Request B','b4000000-0000-4000-8000-000000000001',t,t+interval '1 hour',1,null);
 if exists(select 1 from public.lessons where title in ('Request A','Request B')) then raise exception 'Pending requests reserved resources'; end if;

 -- Ownership and client bypass checks.
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000005',true);
 denied:=false;begin perform public.withdraw_session_request(r1);exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Other instructor withdrew request';end if;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
 if has_table_privilege('authenticated','public.session_requests','UPDATE') then raise exception 'Direct REST mutation still allowed';end if;
 denied:=false;begin perform public.review_session_request(r2,false,null);exception when others then denied:=true;end;
 if not denied then raise exception 'Rejection without reason accepted';end if;
 perform public.propose_session_request_alternative(r1,t+interval '1 day',t+interval '1 day 1 hour','Grup programına öncelik');
 select alternative_proposed_at into proposal from public.session_requests where id=r1;
 denied:=false;begin perform public.review_session_request(r1,true,null);exception when others then denied:=true;end;
 if not denied then raise exception 'Unanswered alternative was approved';end if;
 if (select starts_at from public.session_requests where id=r1)<>t then raise exception 'Proposal silently changed request';end if;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000005',true);
 denied:=false;begin perform public.propose_session_request_alternative(r1,t+interval '2 days',t+interval '2 days 1 hour','Unauthorized');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-center proposal allowed';end if;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
 denied:=false;begin perform public.respond_session_request_alternative(r1,proposal-interval '1 second',true);exception when others then denied:=true;end;
 if not denied then raise exception 'Stale alternative accepted';end if;
 perform public.respond_session_request_alternative(r1,proposal,true);
 if (select starts_at from public.session_requests where id=r1)<>t+interval '1 day'
 or (select status from public.session_requests where id=r1)<>'pending'
 or exists(select 1 from public.lessons where title='Request A') then raise exception 'Alternative acceptance reserved a lesson';end if;
 perform public.withdraw_session_request(r2);
 denied:=false;begin perform public.withdraw_session_request(r2);exception when others then denied:=true;end;
 if not denied then raise exception 'Repeated withdrawal accepted';end if;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
 perform public.propose_session_request_alternative(r1,t+interval '2 days',t+interval '2 days 1 hour','Başka saat');
 select alternative_proposed_at into proposal from public.session_requests where id=r1;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
 perform public.respond_session_request_alternative(r1,proposal,false);
 if (select starts_at from public.session_requests where id=r1)<>t+interval '1 day'
 or (select alternative_proposed_at from public.session_requests where id=r1) is not null then raise exception 'Declined proposal changed agreed window';end if;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
 lesson:=public.review_session_request(r1,true,'Uygun');
 if lesson is null or (select approved_lesson_id from public.session_requests where id=r1)<>lesson then raise exception 'Approval did not link lesson';end if;
 denied:=false;begin perform public.review_session_request(r1,true,null);exception when others then denied:=true;end;
 if not denied then raise exception 'Double approval accepted';end if;
 denied:=false;begin perform public.review_session_request(r2,true,null);exception when others then denied:=true;end;
 if not denied then raise exception 'Withdrawn request approved';end if;

 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
 r3:=public.create_session_request('b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','private','Rejected Request','b4000000-0000-4000-8000-000000000001',t,t+interval '1 hour',1,null);
 r4:=public.create_session_request('b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','private','Competing A','b4000000-0000-4000-8000-000000000001',t+interval '3 days',t+interval '3 days 1 hour',1,null);
 r5:=public.create_session_request('b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','private','Competing B','b4000000-0000-4000-8000-000000000001',t+interval '3 days',t+interval '3 days 1 hour',1,null);
 r6:=public.create_session_request('b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000003','private','Instructor Conflict','b4000000-0000-4000-8000-000000000001',t+interval '3 days',t+interval '3 days 1 hour',1,null);
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
 perform public.review_session_request(r3,false,'Grup dersi planlanıyor');
 if (select review_note from public.session_requests where id=r3)<>'Grup dersi planlanıyor' then raise exception 'Rejection reason lost';end if;
 perform public.review_session_request(r4,true,null);
 denied:=false;begin perform public.review_session_request(r5,true,null);exception when exclusion_violation then denied:=true;end;
 if not denied or (select status from public.session_requests where id=r5)<>'pending' then raise exception 'Room overlap approval succeeded or mutated pending status';end if;
 denied:=false;begin perform public.review_session_request(r6,true,null);exception when exclusion_violation then denied:=true;end;
 if not denied then raise exception 'Instructor overlap across rooms approved';end if;
 select count(*) into n from public.session_request_events where request_id=r1;
 if n<>6 then raise exception 'Expected six history events, got %',n;end if;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000005',true);
 if exists(select 1 from public.session_request_events where request_id=r1) then raise exception 'Cross-center history leaked';end if;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
 if not exists(select 1 from public.session_request_events where request_id=r2 and action='withdrawn') then raise exception 'Requester cannot see withdrawal history';end if;
end;
$assert$;
rollback;
