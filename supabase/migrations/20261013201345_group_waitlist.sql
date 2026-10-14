
create table public.group_waitlist(
 id uuid primary key default gen_random_uuid(),group_id uuid not null references public.studio_groups(id),member_id uuid not null references public.members(id),
 status text not null default 'waiting' check(status in ('waiting','promoted','cancelled')),created_at timestamptz not null default now(),resolved_at timestamptz);
create unique index group_waitlist_active_unique on public.group_waitlist(group_id,member_id) where status='waiting';
create index group_waitlist_member_idx on public.group_waitlist(member_id);
alter table public.group_waitlist enable row level security;
create policy waitlist_read on public.group_waitlist for select to authenticated using(exists(
 select 1 from public.studio_groups g where g.id=group_id and app_private.can_manage_center(g.center_id))
 or exists(select 1 from public.members m where m.id=member_id and m.profile_id=auth.uid()));
revoke all on public.group_waitlist from public,anon,authenticated;grant select on public.group_waitlist to authenticated;
create function app_private.waitlist_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.studio_groups%rowtype;w public.group_waitlist%rowtype;mid uuid:=(p_data->>'member_id')::uuid;op text:=p_data->>'action';
begin
 select * into g from public.studio_groups where id=(p_data->>'group_id')::uuid for update;
 if not found or auth.uid() is null or not app_private.can_manage_center(g.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if op='promote' then
 select * into w from public.group_waitlist where group_id=g.id and status='waiting' order by created_at,id limit 1 for update;
 if not found then raise exception 'Bekleme listesi boş.';end if;
 perform app_private.groups_command(jsonb_build_object('action','enroll','group_id',g.id,'member_id',w.member_id));
 update public.group_waitlist set status='promoted',resolved_at=now() where id=w.id;
 elsif op in ('waitlist','dequeue') then
 if not exists(select 1 from public.members where id=mid and center_id=g.center_id and is_active) then raise exception 'Üye geçersiz.';end if;
 if op='waitlist' then
 if exists(select 1 from public.studio_group_members where group_id=g.id and member_id=mid) then raise exception 'Öğrenci zaten gruba kayıtlı.';end if;
 insert into public.group_waitlist(group_id,member_id) values(g.id,mid) on conflict do nothing;
 else update public.group_waitlist set status='cancelled',resolved_at=now() where group_id=g.id and member_id=mid and status='waiting';end if;
 else raise exception 'İşlem geçersiz.';end if;return '{}'::jsonb;
end;$$;
create function public.waitlist_command(p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.waitlist_command(p_data);$$;
revoke all on function app_private.waitlist_command(jsonb),public.waitlist_command(jsonb) from public,anon;
grant execute on function app_private.waitlist_command(jsonb),public.waitlist_command(jsonb) to authenticated;
