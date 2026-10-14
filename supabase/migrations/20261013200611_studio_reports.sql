
create function app_private.studio_workspace(p_module text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 if p_module not in ('groups','payments','lesson-operations','crm') then raise exception 'Modül geçersiz.';end if;
 if p_module<>'lesson-operations' and not exists(select 1 from public.centers c where app_private.can_manage_center(c.id)) then raise exception 'Yönetici erişimi gerekli.' using errcode='42501';end if;
 result:=jsonb_build_object(
 'centers',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'label',c.name)) from public.centers c where app_private.can_manage_center(c.id)),'[]'),
 'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'center_id',r.center_id,'label',r.name||' · '||r.capacity::text)) from public.rooms r where r.is_active and app_private.can_manage_center(r.center_id)),'[]'),
 'instructors',coalesce((select jsonb_agg(jsonb_build_object('id',a.profile_id,'center_id',a.center_id,'label',coalesce(nullif(p.full_name,''),u.email))) from public.center_role_assignments a join public.profiles p on p.id=a.profile_id join auth.users u on u.id=p.id where a.role='instructor' and app_private.can_manage_center(a.center_id)),'[]'),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'center_id',m.center_id,'label',m.full_name)) from public.members m where m.is_active and (app_private.can_manage_center(m.center_id) or m.profile_id=auth.uid() or app_private.instructor_can_access_member_center(m.center_id,m.id))),'[]'));
 if p_module='groups' then
 return result||jsonb_build_object(
 'waitlist',coalesce((select jsonb_agg(to_jsonb(w)||jsonb_build_object('group',g.name,'member',m.full_name)) from public.group_waitlist w join public.studio_groups g on g.id=w.group_id join public.members m on m.id=w.member_id where app_private.can_manage_center(g.center_id)),'[]'),
 'groups',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('label',g.name,'enrolled',(select count(*) from public.studio_group_members where group_id=g.id))) from public.studio_groups g where app_private.can_manage_center(g.center_id)),'[]'),
 'enrollments',coalesce((select jsonb_agg(jsonb_build_object('group_id',g.id,'group',g.name,'member',m.full_name,'member_id',m.id)) from public.studio_groups g join public.studio_group_members gm on gm.group_id=g.id join public.members m on m.id=gm.member_id where app_private.can_manage_center(g.center_id)),'[]'),
 'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'group',g.name,'starts_at',l.starts_at,'ends_at',l.ends_at,'status',l.status,'enrolled',(select count(*) from public.lesson_enrollments where lesson_id=l.id),'capacity',l.expected_attendees)) from public.lessons l join public.studio_groups g on g.id=l.group_id where app_private.can_manage_center(l.center_id)),'[]'));
 elsif p_module='payments' then
 return result||jsonb_build_object(
 'subscriptions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'label',m.full_name||' · '||s.type::text,'amount',s.amount,'paid',coalesce(p.total,0),'balance',s.amount-coalesce(p.total,0),'payment_status',s.payment_status)) from public.subscriptions s join public.members m on m.id=s.member_id left join lateral(select sum(amount) total from public.manual_payments where subscription_id=s.id) p on true where app_private.can_manage_center(s.center_id)),'[]'),
 'payments',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('member',m.full_name,'actor',coalesce(nullif(pr.full_name,''),(select email from auth.users where id=p.actor_id),'Aktarılan kayıt'))) from public.manual_payments p join public.subscriptions s on s.id=p.subscription_id join public.members m on m.id=s.member_id left join public.profiles pr on pr.id=p.actor_id where app_private.can_manage_center(p.center_id)),'[]'));
 elsif p_module='crm' then
 return result||jsonb_build_object(
 'leads',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('label',l.full_name)) from public.crm_leads l where app_private.can_manage_center(l.center_id)),'[]'),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('lead',l.full_name)) from public.crm_tasks t join public.crm_leads l on l.id=t.lead_id where app_private.can_manage_center(l.center_id)),'[]'));
 else
 return result||jsonb_build_object(
 'lessons',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('cancellation_hours',coalesce((select cancellation_hours from public.studio_policies where center_id=l.center_id),24),'label',l.title||' · '||to_char(l.starts_at at time zone 'Europe/Istanbul','DD.MM HH24:MI'))) from public.lessons l where app_private.can_manage_center(l.center_id) or exists(select 1 from public.lesson_staff_assignments a where a.lesson_id=l.id and a.profile_id=auth.uid() and a.role='instructor') or exists(select 1 from public.members m where m.profile_id=auth.uid() and (m.id=l.private_member_id or exists(select 1 from public.lesson_enrollments e where e.lesson_id=l.id and e.member_id=m.id)))),'[]'),
 'outcomes',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('title',l.title,'member',(select full_name from public.members where id=o.member_id))) from public.lesson_member_outcomes o join public.lessons l on l.id=o.lesson_id where app_private.can_manage_center(l.center_id) or exists(select 1 from public.lesson_staff_assignments a where a.lesson_id=l.id and a.profile_id=auth.uid() and a.role='instructor') or exists(select 1 from public.members m where m.id=o.member_id and m.profile_id=auth.uid())),'[]'),
 'changes',coalesce((select jsonb_agg(to_jsonb(ch)||jsonb_build_object('title',l.title)) from public.lesson_changes ch join public.lessons l on l.id=ch.lesson_id where app_private.can_manage_center(l.center_id) or l.instructor_id=auth.uid()),'[]'),
 'policies',coalesce((select jsonb_agg(to_jsonb(p)) from public.studio_policies p where app_private.can_manage_center(p.center_id)),'[]'));
 end if;
end;$$;
create function public.studio_workspace(p_module text) returns jsonb language sql stable security invoker set search_path='' as $$select app_private.studio_workspace(p_module);$$;
revoke all on function app_private.studio_workspace(text),public.studio_workspace(text) from public,anon;
grant execute on function app_private.studio_workspace(text),public.studio_workspace(text) to authenticated;

create function app_private.studio_report(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a timestamptz;b timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from public.centers c where app_private.can_manage_center(c.id)) then raise exception 'Yönetici erişimi gerekli.' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from then raise exception 'Tarih aralığı geçersiz.';end if;
 a:=p_from::timestamp at time zone 'Europe/Istanbul';b:=(p_to+1)::timestamp at time zone 'Europe/Istanbul';
 return jsonb_build_object(
 'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'member',m.full_name,'subscription_id',s.id,'amount',p.amount,'kind',p.kind,'occurred_at',p.occurred_at,'note',p.note,'actor_id',p.actor_id)) from public.manual_payments p join public.subscriptions s on s.id=p.subscription_id join public.members m on m.id=s.member_id where p.occurred_at>=a and p.occurred_at<b and app_private.can_manage_center(p.center_id)),'[]'),
 'balances',coalesce((select jsonb_agg(jsonb_build_object('subscription_id',s.id,'member',m.full_name,'amount',s.amount,'paid',coalesce(p.net,0),'balance',s.amount-coalesce(p.net,0),'ends_on',s.ends_on,'credits_remaining',s.credits_remaining,'status',s.status)) from public.subscriptions s join public.members m on m.id=s.member_id left join lateral(select sum(amount) net from public.manual_payments where subscription_id=s.id and occurred_at<b) p on true where s.created_at<b and app_private.can_manage_center(s.center_id)),'[]'),
 'renewals',coalesce((select jsonb_agg(jsonb_build_object('subscription_id',s.id,'member',m.full_name,'ends_on',s.ends_on,'credits_remaining',s.credits_remaining)) from public.subscriptions s join public.members m on m.id=s.member_id where s.status='active' and (s.ends_on between p_from and p_to or s.credits_remaining<=1) and app_private.can_manage_center(s.center_id)),'[]'),
 'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'starts_at',l.starts_at,'status',l.status,'room',r.name,'instructor',p.full_name,'capacity',l.expected_attendees,'enrolled',case when l.type='private' then 1 else (select count(*) from public.lesson_enrollments where lesson_id=l.id) end,'attended',(select count(*) from public.attendance where lesson_id=l.id and attended),'hours',extract(epoch from(l.ends_at-l.starts_at))/3600)) from public.lessons l join public.rooms r on r.id=l.room_id left join public.profiles p on p.id=l.instructor_id where l.starts_at>=a and l.starts_at<b and app_private.can_manage_center(l.center_id)),'[]'),
 'usage',coalesce((select jsonb_agg(to_jsonb(x)) from (
 select r.name room,p.full_name instructor,sum(extract(epoch from(l.ends_at-l.starts_at))/3600) hours,count(*) lessons
 from public.lessons l join public.rooms r on r.id=l.room_id left join public.profiles p on p.id=l.instructor_id
 where l.starts_at>=a and l.starts_at<b and l.status in ('scheduled','completed') and app_private.can_manage_center(l.center_id)
 group by r.id,r.name,p.id,p.full_name) x),'[]'),
 'crm',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.full_name,'source',l.source,'stage',l.stage,'created_at',l.created_at,'converted_at',l.converted_at,'member_id',l.converted_member_id)) from public.crm_leads l where l.created_at>=a and l.created_at<b and app_private.can_manage_center(l.center_id)),'[]'));
end;$$;
create function public.studio_report(p_from date,p_to date) returns jsonb language sql stable security invoker set search_path='' as $$select app_private.studio_report(p_from,p_to);$$;
revoke all on function app_private.studio_report(date,date),public.studio_report(date,date) from public,anon;
grant execute on function app_private.studio_report(date,date),public.studio_report(date,date) to authenticated;
