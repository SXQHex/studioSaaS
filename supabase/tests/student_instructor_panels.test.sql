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

set local role authenticated;
do $assert$
declare
  v_count integer;
  v_denied boolean;
  v_student_name text;
  v_role public.app_role;
begin
  if has_column_privilege('authenticated','public.profiles','role','UPDATE') then
    raise exception 'Authenticated clients can update legacy profile roles';
  end if;
  if not has_column_privilege('authenticated','public.profiles','full_name','UPDATE') then
    raise exception 'Profile display name not editable';
  end if;

  perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);
  select count(*) into v_count from public.my_teaching_lessons();
  if v_count<>2 then raise exception 'Instructor should see exactly 2 assigned lessons, saw %', v_count; end if;
  select count(*) into v_count from public.my_lesson_roster('b5000000-0000-4000-8000-000000000001');
  if v_count<>1 then raise exception 'Group roster should show enrolled member: %',v_count; end if;
  select count(*) into v_count from public.my_lesson_roster('b5000000-0000-4000-8000-000000000003');
  if v_count<>1 then raise exception 'Private roster should show private member: %',v_count; end if;
  v_denied:=false;
  begin
    perform public.my_lesson_roster('b5000000-0000-4000-8000-000000000002');
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'Instructor saw a roster at another center'; end if;

  perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000003',true);
  select count(*) into v_count from public.my_teaching_lessons();
  if v_count<>0 then raise exception 'Assistant obtained instructor schedule: %',v_count; end if;
  v_denied:=false;
  begin
    perform public.my_lesson_roster('b5000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'Assistant accessed full instructor roster'; end if;

  perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000004',true);
  select count(*) into v_count from public.members where profile_id=(select auth.uid());
  if v_count<>1 then raise exception 'Student could not see own linked member'; end if;
  select count(*) into v_count from public.lesson_enrollments
    where member_id='b4000000-0000-4000-8000-000000000001';
  if v_count<>1 then raise exception 'Student could not see their enrollment'; end if;
  v_denied:=false;
  begin
    perform public.my_lesson_roster('b5000000-0000-4000-8000-000000000001');
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'Student accessed instructor roster'; end if;

  update public.profiles set full_name='Student Edited Profile'
    where id='b1000000-0000-4000-8000-000000000004';
  select full_name into v_student_name from public.profiles
    where id='b1000000-0000-4000-8000-000000000004';
  if v_student_name<>'Student Edited Profile' then raise exception 'Self profile update failed'; end if;

  v_denied:=false;
  begin
    update public.profiles set full_name='Other Profile' where id='b1000000-0000-4000-8000-000000000002';
    if found then raise exception 'Changed somebody else profile'; end if;
  exception when insufficient_privilege then v_denied:=true;
  end;

  perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
  select count(*) into v_count from public.my_lesson_roster('b5000000-0000-4000-8000-000000000001');
  if v_count<>1 then raise exception 'Manager cannot see own center roster'; end if;
  v_denied:=false;
  begin
    perform public.my_lesson_roster('b5000000-0000-4000-8000-000000000002');
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'Manager accessed foreign center roster'; end if;
end;
$assert$;
reset role;
rollback;
