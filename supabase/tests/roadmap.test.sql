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
declare g uuid; r jsonb; denied boolean; n integer;
begin
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
 r:=public.groups_command(jsonb_build_object('action','create','center_id','b3000000-0000-4000-8000-000000000001','room_id','b6000000-0000-4000-8000-000000000001','instructor_id','b1000000-0000-4000-8000-000000000002','name','Weekly Programme','capacity',1,'weeks',3,'starts_at',now()+interval '30 days','ends_at',now()+interval '30 days 1 hour'));
 g:=(r->>'id')::uuid;
 if (select count(*) from public.lessons where group_id=g)<>3 then raise exception 'Weekly lessons missing';end if;
 perform public.groups_command(jsonb_build_object('action','enroll','group_id',g,'member_id','b4000000-0000-4000-8000-000000000001'));
 perform public.groups_command(jsonb_build_object('action','enroll','group_id',g,'member_id','b4000000-0000-4000-8000-000000000001'));
 if (select count(*) from public.lesson_enrollments e join public.lessons l on l.id=e.lesson_id where l.group_id=g)<>3 then raise exception 'Enrollment not propagated/idempotent';end if;
 denied:=false;begin perform public.groups_command(jsonb_build_object('action','enroll','group_id',g,'member_id','b4000000-0000-4000-8000-000000000003'));exception when others then denied:=true;end;
 if not denied then raise exception 'Capacity bypass';end if;
 denied:=false;begin perform public.groups_command(jsonb_build_object('action','create','center_id','b3000000-0000-4000-8000-000000000001','room_id','b6000000-0000-4000-8000-000000000001','instructor_id','b1000000-0000-4000-8000-000000000002','name','Conflicting','capacity',1,'weeks',3,'starts_at',now()+interval '30 days','ends_at',now()+interval '30 days 1 hour'));exception when exclusion_violation then denied:=true;end;
 if not denied or exists(select 1 from public.studio_groups where name='Conflicting') then raise exception 'Series rollback failed';end if;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000005',true);
 denied:=false;begin perform public.groups_command(jsonb_build_object('action','unenroll','group_id',g,'member_id','b4000000-0000-4000-8000-000000000001'));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross center write';end if;
end;$$;
reset role;

insert into public.subscriptions(id,center_id,member_id,type,starts_on,ends_on,credits_purchased,credits_remaining,amount,created_by)
values('b7000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','private_credits',current_date,current_date+90,4,4,1000,'b1000000-0000-4000-8000-000000000001');
set local role authenticated;
do $$
declare r jsonb;pid uuid;denied boolean;
begin
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
 r:=public.payments_command(jsonb_build_object('action','collect','subscription_id','b7000000-0000-4000-8000-000000000001','amount',400,'key','b8000000-0000-4000-8000-000000000001','occurred_at',now(),'note','Nakit kısmi tahsilat'));pid:=(r->>'id')::uuid;
 perform public.payments_command(jsonb_build_object('action','collect','subscription_id','b7000000-0000-4000-8000-000000000001','amount',400,'key','b8000000-0000-4000-8000-000000000001','occurred_at',now(),'note','Tekrar'));
 if (select count(*) from public.manual_payments where subscription_id='b7000000-0000-4000-8000-000000000001')<>1 then raise exception 'Duplicate payment';end if;
 denied:=false;begin perform public.payments_command(jsonb_build_object('action','collect','subscription_id','b7000000-0000-4000-8000-000000000001','amount',601,'key',gen_random_uuid(),'occurred_at',now(),'note','Aşım'));exception when others then denied:=true;end;
 if not denied then raise exception 'Overpayment allowed';end if;
 perform public.payments_command(jsonb_build_object('action','refund','subscription_id','b7000000-0000-4000-8000-000000000001','amount',100,'key',gen_random_uuid(),'occurred_at',now(),'note','İade'));
 if (select sum(amount) from public.manual_payments where subscription_id='b7000000-0000-4000-8000-000000000001')<>300 then raise exception 'Refund balance incorrect';end if;
 if has_table_privilege('authenticated','public.manual_payments','DELETE') then raise exception 'Ledger deletable';end if;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000005',true);
 denied:=false;begin perform public.payments_command(jsonb_build_object('action','collect','subscription_id','b7000000-0000-4000-8000-000000000001','amount',1,'key',gen_random_uuid(),'occurred_at',now(),'note','Foreign'));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross center collection';end if;
end;$$;
reset role;

-- Both participants have group packages; attendance must charge only the attendee.
insert into public.subscriptions(id,center_id,member_id,type,credits_purchased,credits_remaining,amount,starts_on,created_by) values
('b7000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','group_4_weeks',4,4,100,current_date,'b1000000-0000-4000-8000-000000000001'),
('b7000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000003','group_4_weeks',4,4,100,current_date,'b1000000-0000-4000-8000-000000000001');
insert into public.lessons(id,center_id,room_id,instructor_id,type,title,starts_at,ends_at,expected_attendees) values
('b5000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','group','Credit scope',now()+interval '12 days',now()+interval '12 days 1 hour',2);
insert into public.lesson_enrollments(lesson_id,center_id,member_id) values('b5000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001');
set local role authenticated;
do $$
declare before_credit integer;n integer;
begin
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
 insert into public.attendance(center_id,lesson_id,member_id,attended,checked_in_by)
 values('b3000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000004','b4000000-0000-4000-8000-000000000001',true,auth.uid());
 if (select credits_remaining from public.subscriptions where id='b7000000-0000-4000-8000-000000000002')<>3
 or (select credits_remaining from public.subscriptions where id='b7000000-0000-4000-8000-000000000003')<>4 then raise exception 'Group credit leaked to nonattendee';end if;
 perform public.lesson_command(jsonb_build_object('action','cancel','lesson_id','b5000000-0000-4000-8000-000000000004','note','Eğitmen iptali'));
 perform public.lesson_command(jsonb_build_object('action','cancel','lesson_id','b5000000-0000-4000-8000-000000000004','note','Tekrar'));
 if (select credits_remaining from public.subscriptions where id='b7000000-0000-4000-8000-000000000002')<>4 then raise exception 'Cancellation refund not restored';end if;
 if (select count(*) from public.credit_transactions where lesson_id='b5000000-0000-4000-8000-000000000004' and reason='refund')<>1 then raise exception 'Duplicate credit refund';end if;
 perform public.lesson_command(jsonb_build_object('action','student_cancel','lesson_id','b5000000-0000-4000-8000-000000000003','member_id','b4000000-0000-4000-8000-000000000001','note','Erken iptal'));
 if exists(select 1 from public.credit_transactions where lesson_id='b5000000-0000-4000-8000-000000000003' and reason='lesson_use') then raise exception 'Early cancel charged';end if;
end;$$;
reset role;

-- Scheduled reminder jobs do not duplicate messages.
insert into public.lessons(id,center_id,room_id,instructor_id,type,title,starts_at,ends_at,expected_attendees,private_member_id)
values('b5000000-0000-4000-8000-000000000005','b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','private','Upcoming',now()+interval '8 hours',now()+interval '9 hours',1,'b4000000-0000-4000-8000-000000000001');
select app_private.enqueue_studio_reminders();
select app_private.enqueue_studio_reminders();
do $$begin
if (select count(*) from public.notifications where recipient_id='b1000000-0000-4000-8000-000000000004' and dedupe_key like 'lesson:b5000000-0000-4000-8000-000000000005:%')<>1 then raise exception 'Duplicate/missing reminder';end if;
end;$$;
set local role authenticated;
do $$
declare lead uuid;r jsonb;mid uuid;denied boolean;
begin
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
r:=public.crm_command(jsonb_build_object('action','create','center_id','b3000000-0000-4000-8000-000000000001','full_name','Existing Student','email','T2-STUDENT@example.invalid','source','Instagram'));lead:=(r->>'id')::uuid;
r:=public.crm_command(jsonb_build_object('action','convert','lead_id',lead));mid:=(r->>'member_id')::uuid;
if mid<>'b4000000-0000-4000-8000-000000000001' then raise exception 'CRM duplicated matching member';end if;
r:=public.crm_command(jsonb_build_object('action','convert','lead_id',lead));
if (r->>'member_id')::uuid<>mid then raise exception 'CRM conversion not idempotent';end if;
perform public.crm_command(jsonb_build_object('action','task','lead_id',lead,'title','Paket yenileme takibi','due_at',now()+interval '1 day'));
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
if exists(select 1 from public.crm_leads) then raise exception 'Instructor reads CRM';end if;
denied:=false;begin perform public.studio_workspace('crm');exception when insufficient_privilege then denied:=true;end;
if not denied then raise exception 'CRM snapshot leaked';end if;
denied:=false;begin perform public.crm_command(jsonb_build_object('action','convert','lead_id',lead));exception when insufficient_privilege then denied:=true;end;
if not denied then raise exception 'Instructor converted CRM';end if;
end;$$;
reset role;
insert into public.manual_payments(subscription_id,center_id,amount,kind,occurred_at,actor_id,note,idempotency_key)
select 'b7000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001',0.01,'collection',now(),'b1000000-0000-4000-8000-000000000001','Export fixture',gen_random_uuid() from generate_series(1,1001);
set local role authenticated;
do $$declare r jsonb;denied boolean;begin
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
r:=public.studio_report(current_date-1,current_date+1);
if jsonb_array_length(r->'payments')<>1003 then raise exception 'Export truncated at 1000: %',jsonb_array_length(r->'payments');end if;
if jsonb_array_length(r->'crm')<>1 then raise exception 'CRM cohort missing';end if;
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000005',true);
denied:=false;begin perform public.studio_report(current_date-1,current_date+1);exception when insufficient_privilege then denied:=true;end;
if not denied then raise exception 'Nonmanager report access';end if;
end;$$;
reset role;

set local role authenticated;
do $$declare g uuid;denied boolean;begin
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
select id into g from public.studio_groups where name='Weekly Programme';
perform public.waitlist_command(jsonb_build_object('action','waitlist','group_id',g,'member_id','b4000000-0000-4000-8000-000000000003'));
denied:=false;begin perform public.waitlist_command(jsonb_build_object('action','promote','group_id',g));exception when others then denied:=true;end;
if not denied or (select status from public.group_waitlist where group_id=g and member_id='b4000000-0000-4000-8000-000000000003')<>'waiting' then raise exception 'Full group queue changed';end if;
perform public.groups_command(jsonb_build_object('action','unenroll','group_id',g,'member_id','b4000000-0000-4000-8000-000000000001'));
perform public.waitlist_command(jsonb_build_object('action','promote','group_id',g));
if (select status from public.group_waitlist where group_id=g and member_id='b4000000-0000-4000-8000-000000000003')<>'promoted' then raise exception 'Queue promotion failed';end if;
end;$$;
reset role;

rollback;
