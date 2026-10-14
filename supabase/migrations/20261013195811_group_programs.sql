
create table public.studio_groups(
 id uuid primary key default gen_random_uuid(),center_id uuid not null references public.centers(id),
 name text not null check(length(trim(name)) between 1 and 160),room_id uuid not null,
 instructor_id uuid not null references public.profiles(id),capacity integer not null check(capacity between 1 and 500),
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 foreign key(room_id,center_id) references public.rooms(id,center_id));
create table public.studio_group_members(
 group_id uuid not null references public.studio_groups(id),member_id uuid not null references public.members(id),
 joined_at timestamptz not null default now(),primary key(group_id,member_id));
alter table public.lessons add column group_id uuid references public.studio_groups(id);
create index lessons_group_idx on public.lessons(group_id);
create index studio_groups_center_idx on public.studio_groups(center_id);
create index studio_groups_room_idx on public.studio_groups(room_id);
create index studio_groups_instructor_idx on public.studio_groups(instructor_id);
create index studio_groups_creator_idx on public.studio_groups(created_by);
create index studio_group_members_member_idx on public.studio_group_members(member_id);
alter table public.studio_groups enable row level security;
alter table public.studio_group_members enable row level security;
create policy groups_read on public.studio_groups for select to authenticated using(
 app_private.can_manage_center(center_id) or instructor_id=auth.uid()
);
-- Keep membership policy independent of group policy to avoid recursive RLS.
create policy group_members_read on public.studio_group_members for select to authenticated using(
 exists(select 1 from public.members m where m.id=member_id and m.profile_id=auth.uid())
 or exists(select 1 from public.studio_groups g where g.id=group_id and (app_private.can_manage_center(g.center_id) or g.instructor_id=auth.uid())));
revoke all on public.studio_groups,public.studio_group_members from public,anon,authenticated;
grant select on public.studio_groups,public.studio_group_members to authenticated;

create function app_private.groups_command(p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.studio_groups%rowtype; gid uuid; lid uuid; m public.members%rowtype;
 v_center uuid; v_start timestamptz; v_end timestamptz; i integer; n integer; cap integer; op text:=p_data->>'action';
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 if op='create' then
   v_center:=(p_data->>'center_id')::uuid;
   if not app_private.can_manage_center(v_center) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
   v_start:=(p_data->>'starts_at')::timestamptz;v_end:=(p_data->>'ends_at')::timestamptz;
   n:=(p_data->>'weeks')::integer;cap:=(p_data->>'capacity')::integer;
   if n is null or n not between 1 and 52 or v_start is null or v_start<=now() or v_end is null or v_end<=v_start then raise exception 'Program süresi veya tekrar sayısı geçersiz.';end if;
   if not exists(select 1 from public.centers c join public.organizations o on o.id=c.organization_id where c.id=v_center and c.is_active and o.is_active)
   or not exists(select 1 from public.rooms where id=(p_data->>'room_id')::uuid and center_id=v_center and is_active and capacity>=cap)
   or not exists(select 1 from public.center_role_assignments where center_id=v_center and profile_id=(p_data->>'instructor_id')::uuid and role='instructor') then raise exception 'Merkez, oda, kapasite veya eğitmen geçersiz.';end if;
   insert into public.studio_groups(center_id,name,room_id,instructor_id,capacity,created_by)
   values(v_center,trim(p_data->>'name'),(p_data->>'room_id')::uuid,(p_data->>'instructor_id')::uuid,cap,auth.uid()) returning id into gid;
   for i in 0..n-1 loop
    insert into public.lessons(center_id,room_id,instructor_id,type,title,starts_at,ends_at,expected_attendees,created_by,group_id)
    values(v_center,(p_data->>'room_id')::uuid,(p_data->>'instructor_id')::uuid,'group',trim(p_data->>'name'),
     v_start+i*interval '7 days',v_end+i*interval '7 days',cap,auth.uid(),gid);
   end loop;
   return jsonb_build_object('id',gid,'lessons',n);
 end if;
 select * into g from public.studio_groups where id=(p_data->>'group_id')::uuid for update;
 if not found or not app_private.can_manage_center(g.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 select * into m from public.members where id=(p_data->>'member_id')::uuid;
 if not found or m.center_id<>g.center_id or (op='enroll' and not m.is_active) then raise exception 'Üye bu merkezde aktif değil.';end if;
 if op='enroll' then
   if exists(select 1 from public.studio_group_members where group_id=g.id and member_id=m.id) then return '{}'::jsonb;end if;
   if (select count(*) from public.studio_group_members where group_id=g.id)>=g.capacity then raise exception 'Grup kontenjanı dolu.';end if;
   insert into public.studio_group_members(group_id,member_id) values(g.id,m.id);
   for lid in select id from public.lessons where group_id=g.id and starts_at>now() and status='scheduled' order by starts_at loop
    insert into public.lesson_enrollments(lesson_id,center_id,member_id) values(lid,g.center_id,m.id) on conflict do nothing;
   end loop;
 elsif op='unenroll' then
   delete from public.lesson_enrollments where member_id=m.id and lesson_id in(select id from public.lessons where group_id=g.id and starts_at>now() and status='scheduled');
   delete from public.studio_group_members where group_id=g.id and member_id=m.id;
 else raise exception 'İşlem geçersiz.';end if;
 return '{}'::jsonb;
end;$$;
create function public.groups_command(p_data jsonb) returns jsonb language sql security invoker set search_path=''
as $$ select app_private.groups_command(p_data);$$;
revoke all on function app_private.groups_command(jsonb),public.groups_command(jsonb) from public,anon;
grant execute on function app_private.groups_command(jsonb),public.groups_command(jsonb) to authenticated;

-- Capacity enforced even for direct, authorized enrollment writes.
create function app_private.enforce_lesson_capacity() returns trigger language plpgsql security definer set search_path='' as $$
declare l public.lessons%rowtype;
begin
 select * into l from public.lessons where id=new.lesson_id for update;
 if l.type<>'group' or l.status<>'scheduled' then raise exception 'Yalnızca planlanmış grup dersine kayıt yapılabilir.';end if;
 if not exists(select 1 from public.members where id=new.member_id and center_id=l.center_id and is_active) then raise exception 'Üye geçersiz.';end if;
 if not exists(select 1 from public.lesson_enrollments where lesson_id=l.id and member_id=new.member_id)
 and (select count(*) from public.lesson_enrollments where lesson_id=l.id)>=l.expected_attendees then raise exception 'Ders kontenjanı dolu.';end if;
 return new;
end;$$;
create trigger enrollment_capacity before insert or update on public.lesson_enrollments for each row execute function app_private.enforce_lesson_capacity();
revoke all on function app_private.enforce_lesson_capacity() from public,anon,authenticated;

create function app_private.planned_group_usage(p_request_ids uuid[])
returns table(request_id uuid,title text,starts_at timestamptz,ends_at timestamptz)
language sql stable security definer set search_path='' as $$
 select r.id,l.title,l.starts_at,l.ends_at from public.session_requests r join public.lessons l
 on l.center_id=r.center_id and l.room_id=r.room_id and l.type='group' and l.status='scheduled'
 and tstzrange(l.starts_at,l.ends_at,'[)')&&tstzrange(r.starts_at,r.ends_at,'[)')
 where r.id=any(p_request_ids) and r.session_type='private' and auth.uid() is not null and app_private.can_manage_center(r.center_id)
 order by l.starts_at;
$$;
create function public.planned_group_usage(p_request_ids uuid[])
returns table(request_id uuid,title text,starts_at timestamptz,ends_at timestamptz)
language sql stable security invoker set search_path='' as $$ select * from app_private.planned_group_usage(p_request_ids);$$;
revoke all on function app_private.planned_group_usage(uuid[]),public.planned_group_usage(uuid[]) from public,anon;
grant execute on function app_private.planned_group_usage(uuid[]),public.planned_group_usage(uuid[]) to authenticated;
