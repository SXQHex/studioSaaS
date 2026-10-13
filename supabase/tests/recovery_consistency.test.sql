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

insert into public.subscriptions(id,center_id,member_id,type,starts_on,ends_on,credits_purchased,credits_remaining,amount,created_by) values
('b7000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','group_4_weeks',current_date-10,null,4,4,1000,'b1000000-0000-4000-8000-000000000001'),
('b7000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000003','group_4_weeks',current_date-10,null,4,4,1000,'b1000000-0000-4000-8000-000000000001');
insert into public.lessons(id,center_id,room_id,instructor_id,type,title,starts_at,ends_at,expected_attendees)
values ('b5000000-0000-4000-8000-000000000010','b3000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','group','Absence guard',now()-interval '3 hours',now()-interval '2 hours',2);
insert into public.lesson_enrollments(lesson_id,center_id,member_id)
values ('b5000000-0000-4000-8000-000000000010','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001');
set local role authenticated;
do $$declare denied boolean;before_count integer;k uuid:=gen_random_uuid();p uuid;r jsonb;begin
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
if has_function_privilege('authenticated','app_private.consume_lesson_credit(uuid)','EXECUTE')
or has_function_privilege('anon','app_private.consume_lesson_credit(uuid)','EXECUTE') then raise exception 'Internal credit access remains';end if;
denied:=false;begin
insert into public.attendance(center_id,lesson_id,member_id,attended,checked_in_by)
values('b3000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000010','b4000000-0000-4000-8000-000000000003',true,auth.uid());
exception when others then denied:=true;end;
if not denied then raise exception 'Nonparticipant attendance accepted';end if;
insert into public.attendance(center_id,lesson_id,member_id,attended,checked_in_by,notes)
values('b3000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000010','b4000000-0000-4000-8000-000000000001',false,auth.uid(),'Gelmedi');
if (select status from public.lessons where id='b5000000-0000-4000-8000-000000000010')<>'scheduled' then raise exception 'Absence completed entire group';end if;
if (select credits_remaining from public.subscriptions where id='b7000000-0000-4000-8000-000000000001')<>3 then raise exception 'Absence did not consume one credit';end if;
perform public.lesson_command(jsonb_build_object('action','no_show','lesson_id','b5000000-0000-4000-8000-000000000010','member_id','b4000000-0000-4000-8000-000000000001','note','Retry'));
update public.lessons set status='completed' where id='b5000000-0000-4000-8000-000000000010';
if (select credits_remaining from public.subscriptions where id='b7000000-0000-4000-8000-000000000001')<>3
or (select credits_remaining from public.subscriptions where id='b7000000-0000-4000-8000-000000000002')<>4 then raise exception 'Credit duplicated or leaked';end if;
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000004',true);
select count(*) into before_count from public.notifications where type='studio_lesson_changed';
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
update public.lessons set ends_at=ends_at+interval '15 minutes' where id='b5000000-0000-4000-8000-000000000001';
-- Manager is not a participant; inspect as student below.
r:=public.payments_command(jsonb_build_object('action','collect','subscription_id','b7000000-0000-4000-8000-000000000001','amount',400,'method','cash','key',k,'occurred_at',now(),'note','Nakit'));
p:=(r->>'id')::uuid;
if (select method from public.manual_payments where id=p)<>'cash' then raise exception 'Method not recorded';end if;
denied:=false;begin
perform public.payments_command(jsonb_build_object('action','collect','subscription_id','b7000000-0000-4000-8000-000000000001','amount',400,'method','manual','key',k,'occurred_at',now(),'note','Wrong retry'));
exception when others then denied:=true;end;
if not denied then raise exception 'Retry with changed method accepted';end if;
perform public.payments_command(jsonb_build_object('action','reverse','subscription_id','b7000000-0000-4000-8000-000000000001','entry_id',p,'key',gen_random_uuid(),'occurred_at',now(),'note','Düzeltme'));
if (select method from public.manual_payments where reversed_entry_id=p)<>'cash' then raise exception 'Reversal method lost';end if;
perform public.payments_command(jsonb_build_object('action','collect','subscription_id','b7000000-0000-4000-8000-000000000001','amount',250,'method','cash','key',gen_random_uuid(),'occurred_at',now(),'note','Kısmi'));
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000004',true);
if (select count(*) from public.notifications where type='studio_lesson_changed')<>before_count+1 then raise exception 'End-only change did not notify student';end if;
if (select count(*) from public.my_payment_balances())<>1 or (select balance from public.my_payment_balances())<>750 then raise exception 'Own partial balance wrong or leaked';end if;
if exists(select 1 from public.lessons where id='b5000000-0000-4000-8000-000000000003')=false then raise exception 'Private membership hidden';end if;
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000003',true);
if exists(select 1 from public.my_payment_balances()) then raise exception 'Unlinked assistant read payment balances';end if;
end;$$;
reset role;
set local role authenticated;
do $$declare r jsonb;lid uuid;denied boolean;begin
perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
perform public.lesson_command(jsonb_build_object('action','cancel','lesson_id','b5000000-0000-4000-8000-000000000010','note','Eğitmen iptali'));
if (select credits_remaining from public.subscriptions where id='b7000000-0000-4000-8000-000000000001')<>4 then raise exception 'Absence credit refund failed';end if;
r:=public.lesson_command(jsonb_build_object('action','makeup','lesson_id','b5000000-0000-4000-8000-000000000010','starts_at',now()+interval '20 days','ends_at',now()+interval '20 days 1 hour','note','Telafi'));
lid:=(r->>'id')::uuid;
if not exists(select 1 from public.lesson_enrollments where lesson_id=lid and member_id='b4000000-0000-4000-8000-000000000001') then raise exception 'Makeup roster lost';end if;
perform public.lesson_command(jsonb_build_object('action','reschedule','lesson_id',lid,'starts_at',now()+interval '21 days','ends_at',now()+interval '21 days 1 hour','note','İstisna'));
denied:=false;begin update public.lessons set status='scheduled' where id='b5000000-0000-4000-8000-000000000010';exception when others then denied:=true;end;
if not denied then raise exception 'Cancelled identity reopened';end if;
end;$$;
reset role;
rollback;
