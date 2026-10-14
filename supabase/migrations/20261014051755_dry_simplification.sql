-- Forward-only: keep historical migrations and existing records intact.
-- Shared package eligibility used by credit charging and attendance warnings.
create function app_private.usable_lesson_subscriptions(p_lesson uuid, p_member uuid)
returns setof public.subscriptions language sql stable security definer set search_path = '' as $$
 select s.* from public.subscriptions s join public.lessons l on l.id = p_lesson
 where s.member_id = p_member and s.center_id = l.center_id and s.status = 'active'
 and s.type = (case when l.type = 'group' then 'group_4_weeks' else 'private_credits' end)::public.subscription_type
 and s.starts_on <= (l.starts_at at time zone 'Europe/Istanbul')::date
 and (app_private.subscription_end(s.id) is null or app_private.subscription_end(s.id) >= (l.starts_at at time zone 'Europe/Istanbul')::date)
 and not exists (select 1 from public.subscription_freezes f where f.subscription_id = s.id and (l.starts_at at time zone 'Europe/Istanbul')::date between f.starts_on and f.ends_on)
 and s.credits_remaining > 0;
$$;
revoke all on function app_private.usable_lesson_subscriptions(uuid, uuid) from public, anon, authenticated;

create or replace function app_private.charge_lesson_member(p_lesson uuid,p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.subscriptions%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_lesson::text || p_member::text, 0));
 if exists(select 1 from public.credit_transactions where lesson_id = p_lesson and member_id = p_member and reason = 'lesson_use') then return; end if;
 select * into s from public.subscriptions
 where id in (select id from app_private.usable_lesson_subscriptions(p_lesson, p_member))
 order by starts_on, created_at, id limit 1 for update;
 if not found then raise exception 'Katılımcı için kullanılabilir ders kredisi yok.'; end if;
 insert into public.credit_transactions(subscription_id,member_id,lesson_id,amount,reason,note,created_by)
 values(s.id,p_member,p_lesson,-1,'lesson_use','Katılım veya geç iptal/gelmeme kuralı',auth.uid());
 update public.subscriptions set credits_remaining = credits_remaining - 1 where id = s.id;
end;
$$;

create function public.lesson_package_eligibility(p_lesson uuid)
returns table(member_id uuid, available_credits bigint)
language plpgsql stable security definer set search_path = '' as $$
declare l public.lessons%rowtype;
begin
 select * into l from public.lessons where id = p_lesson;
 if auth.uid() is null or not found or not (
 app_private.can_manage_center(l.center_id)
 or exists(select 1 from public.lesson_staff_assignments a where a.lesson_id = l.id and a.profile_id = auth.uid() and a.role in ('instructor','ainstructor'))
 ) then raise exception 'Yetkiniz yok.' using errcode = '42501'; end if;
 return query select m.id, coalesce((select sum(s.credits_remaining) from app_private.usable_lesson_subscriptions(l.id,m.id) s),0)::bigint
 from public.members m where m.id = l.private_member_id or exists(select 1 from public.lesson_enrollments e where e.lesson_id = l.id and e.member_id = m.id);
end;
$$;
revoke all on function public.lesson_package_eligibility(uuid) from public, anon;
grant execute on function public.lesson_package_eligibility(uuid) to authenticated;

create function public.subscription_summaries(p_ids uuid[])
returns table(id uuid, effective_ends_on date, frozen boolean)
language sql stable security definer set search_path = '' as $$
 select s.id, app_private.subscription_end(s.id), exists(select 1 from public.subscription_freezes f where f.subscription_id = s.id and (now() at time zone 'Europe/Istanbul')::date between f.starts_on and f.ends_on)
 from public.subscriptions s where s.id = any(p_ids) and (app_private.can_manage_center(s.center_id) or exists(select 1 from public.members m where m.id = s.member_id and m.profile_id = auth.uid()));
$$;
revoke all on function public.subscription_summaries(uuid[]) from public, anon;
grant execute on function public.subscription_summaries(uuid[]) to authenticated;
create function public.subscription_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('total',count(*),'active',count(*) filter(where status = 'active'),'remainingCredits',coalesce(sum(credits_remaining) filter(where status = 'active'),0))
 from public.subscriptions where app_private.can_manage_center(center_id);
$$;
revoke all on function public.subscription_stats() from public, anon;
grant execute on function public.subscription_stats() to authenticated;

-- One parameterized, bounded list API; source SQL comes only from this allowlist.
create function public.workspace_section(p_module text, p_section text, p_page integer default 1,
 p_query text default '', p_sort text default 'id', p_ascending boolean default true,
 p_filters jsonb default '{}', p_selected uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare source_sql text; result jsonb; allowed text[];
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode = '42501'; end if;
 allowed := case p_module
 when 'groups' then array['centers','rooms','instructors','members','groups','enrollments','lessons','waitlist']
 when 'payments' then array['centers','members','subscriptions','payments']
 when 'lesson-operations' then array['members','lessons','outcomes','changes']
 when 'crm' then array['centers','leads','tasks']
 when 'catalog' then array['centers','members','catalog','subscriptions','freezes']
 when 'crm-automation' then array['centers','leads','tasks','forms','managers']
 when 'progress' then array['members','progress']
 when 'communication' then array['emails']
 when 'registration' then array['centers','members','policies','documents']
 else array[]::text[] end;
 if p_module is null or p_section is null or p_page is null or p_query is null or p_sort is null or p_ascending is null or p_filters is null or not p_section = any(allowed) or p_page not between 1 and 10000 or length(p_query) > 80
 or p_sort !~ '^[a-z_]{1,60}$' or jsonb_typeof(p_filters) <> 'object'
 then raise exception 'Liste parametreleri geçersiz.'; end if;
 if p_module not in ('lesson-operations','progress','registration') and not exists(select 1 from public.centers c where app_private.can_manage_center(c.id))
 then raise exception 'Yönetici erişimi gerekli.' using errcode = '42501'; end if;
 case p_section
 when 'centers' then source_sql := $source$select to_jsonb(c) || jsonb_build_object('label',c.name) row from public.centers c where app_private.can_manage_center(c.id)$source$;
 when 'rooms' then source_sql := $source$select to_jsonb(r) || jsonb_build_object('label',r.name || ' · ' || r.capacity) row from public.rooms r where r.is_active and app_private.can_manage_center(r.center_id)$source$;
 when 'instructors' then source_sql := $source$select jsonb_build_object('id',a.profile_id,'center_id',a.center_id,'label',coalesce(p.full_name,'')) row from public.center_role_assignments a join public.profiles p on p.id=a.profile_id where a.role='instructor' and app_private.can_manage_center(a.center_id)$source$;
 when 'managers' then source_sql := $source$select jsonb_build_object('id',a.profile_id,'center_id',a.center_id,'label',coalesce(p.full_name,'')) row from public.center_role_assignments a join public.profiles p on p.id=a.profile_id where a.role='admin' and app_private.can_manage_center(a.center_id)$source$;
 when 'members' then
 if p_module = 'registration' then source_sql := $source$select to_jsonb(m)||coalesce(to_jsonb(d)-'member_id','{}')||jsonb_build_object('label',m.full_name,'organization_id',c.organization_id,'missing',
 concat_ws(' · ',case when nullif(trim(coalesce(d.phone,m.phone)), '') is null then 'Telefon' end,
 case when coalesce(req.emergency_contact,false) and (nullif(trim(d.emergency_name),'') is null or nullif(trim(d.emergency_phone),'') is null) then 'Acil iletişim' end,
 case when coalesce(req.document_required,false) and not exists(select 1 from public.registration_documents doc where doc.member_id=m.id) then 'Belge' end,
 case when exists(select 1 from public.registration_policies p where p.organization_id=c.organization_id and (p.center_id is null or p.center_id=m.center_id) and p.required and p.retired_at is null and not exists(select 1 from public.registration_acceptances a where a.member_id=m.id and a.policy_id=p.id)) then 'Kural kabulü' end)) row
 from public.members m join public.centers c on c.id=m.center_id left join public.registration_details d on d.member_id=m.id left join public.registration_requirements req on req.center_id=m.center_id where app_private.can_access_registration(m.id)$source$;
 else source_sql := $source$select to_jsonb(m) || jsonb_build_object('label',m.full_name) row from public.members m where m.is_active and (app_private.can_manage_center(m.center_id) or m.profile_id=auth.uid() or app_private.instructor_can_access_member_center(m.center_id,m.id))$source$; end if;
 when 'groups' then source_sql := $source$select to_jsonb(g) || jsonb_build_object('label',g.name,'enrolled',(select count(*) from public.studio_group_members where group_id=g.id)) row from public.studio_groups g where app_private.can_manage_center(g.center_id)$source$;
 when 'enrollments' then source_sql := $source$select jsonb_build_object('id',g.id::text || ':' || m.id::text,'group_id',g.id,'group',g.name,'member_id',m.id,'member',m.full_name) row from public.studio_group_members e join public.studio_groups g on g.id=e.group_id join public.members m on m.id=e.member_id where app_private.can_manage_center(g.center_id)$source$;
 when 'waitlist' then source_sql := $source$select to_jsonb(w) || jsonb_build_object('group',g.name,'member',m.full_name) row from public.group_waitlist w join public.studio_groups g on g.id=w.group_id join public.members m on m.id=w.member_id where app_private.can_manage_center(g.center_id)$source$;
 when 'lessons' then source_sql := $source$select to_jsonb(l) || jsonb_build_object('group',(select name from public.studio_groups where id=l.group_id),'label',l.title || ' · ' || to_char(l.starts_at at time zone 'Europe/Istanbul','DD.MM HH24:MI'),'enrolled',(select count(*) from public.lesson_enrollments where lesson_id=l.id),'capacity',l.expected_attendees,'cancellation_hours',app_private.policy_number(l.center_id,'private_cancel_hours')) row from public.lessons l where app_private.can_manage_center(l.center_id) or exists(select 1 from public.lesson_staff_assignments a where a.lesson_id=l.id and a.profile_id=auth.uid() and a.role='instructor') or exists(select 1 from public.members m where m.profile_id=auth.uid() and (m.id=l.private_member_id or exists(select 1 from public.lesson_enrollments e where e.lesson_id=l.id and e.member_id=m.id)))$source$;
 when 'subscriptions' then source_sql := $source$select to_jsonb(s) || jsonb_build_object('member',m.full_name,'label',m.full_name || ' · ' || coalesce(s.catalog_snapshot->>'name',s.type::text),'effective_ends_on',app_private.subscription_end(s.id),'paid',coalesce(p.total,0),'balance',s.amount-coalesce(p.total,0)) row from public.subscriptions s join public.members m on m.id=s.member_id left join lateral(select sum(amount) total from public.manual_payments where subscription_id=s.id) p on true where app_private.can_manage_center(s.center_id)$source$;
 when 'payments' then source_sql := $source$select to_jsonb(p) || jsonb_build_object('member',m.full_name,'actor',coalesce(pr.full_name,'Aktarılan kayıt'),'label',m.full_name || ' · ' || p.amount || ' · ' || p.kind) row from public.manual_payments p join public.subscriptions s on s.id=p.subscription_id join public.members m on m.id=s.member_id left join public.profiles pr on pr.id=p.actor_id where app_private.can_manage_center(p.center_id)$source$;
 when 'leads' then source_sql := $source$select to_jsonb(l) || jsonb_build_object('label',l.full_name) row from public.crm_leads l where app_private.can_manage_center(l.center_id)$source$;
 when 'tasks' then source_sql := $source$select to_jsonb(t) || jsonb_build_object('lead',l.full_name,'center_id',l.center_id,'label',l.full_name || ' · ' || t.title) row from public.crm_tasks t join public.crm_leads l on l.id=t.lead_id where app_private.can_manage_center(l.center_id)$source$;
 when 'outcomes' then source_sql := $source$select to_jsonb(o) || jsonb_build_object('title',l.title,'member',m.full_name) row from public.lesson_member_outcomes o join public.lessons l on l.id=o.lesson_id join public.members m on m.id=o.member_id where app_private.can_manage_center(l.center_id) or m.profile_id=auth.uid() or exists(select 1 from public.lesson_staff_assignments a where a.lesson_id=l.id and a.profile_id=auth.uid() and a.role='instructor')$source$;
 when 'changes' then source_sql := $source$select to_jsonb(c) || jsonb_build_object('title',l.title) row from public.lesson_changes c join public.lessons l on l.id=c.lesson_id where app_private.can_manage_center(l.center_id) or l.instructor_id=auth.uid()$source$;
 when 'catalog' then source_sql := $source$select to_jsonb(p) || jsonb_build_object('label',p.name) row from public.package_catalog p where app_private.can_manage_center(p.center_id)$source$;
 when 'freezes' then source_sql := $source$select to_jsonb(f) row from public.subscription_freezes f join public.subscriptions s on s.id=f.subscription_id where app_private.can_manage_center(s.center_id)$source$;
 when 'forms' then source_sql := $source$select to_jsonb(f) || jsonb_build_object('label',f.title) row from public.crm_intake_forms f where app_private.can_manage_center(f.center_id)$source$;
 when 'progress' then source_sql := $source$select to_jsonb(p) || jsonb_build_object('member',m.full_name) row from public.student_progress p join public.members m on m.id=p.member_id where app_private.can_manage_center(p.center_id) or p.instructor_id=auth.uid() or (p.student_visible and m.profile_id=auth.uid())$source$;
 when 'emails' then source_sql := $source$select to_jsonb(o) || jsonb_build_object('title',n.title,'label',n.title) row from public.studio_email_outbox o join public.notifications n on n.id=o.notification_id where app_private.can_manage_center(o.center_id)$source$;
 when 'policies' then source_sql := $source$select to_jsonb(p) || jsonb_build_object('label',p.title) row from public.registration_policies p where p.retired_at is null and (app_private.policy_org_owner(p.organization_id) or exists(select 1 from public.centers c where c.organization_id=p.organization_id and (p.center_id is null or p.center_id=c.id) and app_private.can_manage_center(c.id)) or exists(select 1 from public.members m where m.profile_id=auth.uid() and (p.center_id is null or p.center_id=m.center_id) and exists(select 1 from public.centers c where c.id=m.center_id and c.organization_id=p.organization_id)))$source$;
 when 'documents' then source_sql := $source$select to_jsonb(d) row from public.registration_documents d where app_private.can_access_registration(d.member_id)$source$;
 else raise exception 'Liste geçersiz.';
 end case;
 if p_module = 'groups' and p_section = 'lessons' then source_sql := source_sql || ' and l.group_id is not null'; end if;
 -- Bound the result before JSON aggregation. Bind every value; never concatenate input SQL.
 execute 'with filtered as (' || source_sql || '), matched as (
 select row from filtered where
 ($1 = '''' or position(lower($1) in lower(row::text)) > 0)
 and not exists(select 1 from jsonb_each_text($2) f where coalesce(row->>f.key,'''') <> f.value)
 ), paged as (select row from matched order by
 (row->>''id'' = $6::text) desc nulls last,
 case when $4 and jsonb_typeof(row->$3) = ''number'' then (row->>$3)::numeric end asc nulls last,
 case when not $4 and jsonb_typeof(row->$3) = ''number'' then (row->>$3)::numeric end desc nulls last,
 case when $4 then row->>$3 end asc nulls last,
 case when not $4 then row->>$3 end desc nulls last,
 row->>''id'' limit 25 offset ($5-1)*25)
 select jsonb_build_object(''rows'',coalesce((select jsonb_agg(row) from paged),''[]''::jsonb),''total'',(select count(*) from matched))'
 into result using p_query,p_filters,p_sort,p_ascending,p_page,p_selected;
 return result;
end;
$$;
revoke all on function public.workspace_section(text,text,integer,text,text,boolean,jsonb,uuid) from public,anon;
grant execute on function public.workspace_section(text,text,integer,text,text,boolean,jsonb,uuid) to authenticated;
create function public.registration_self_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 return jsonb_build_object(
 'centers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'organization_id',organization_id,'label',name)) from public.centers c where exists(select 1 from public.members m where m.center_id=c.id and m.profile_id=auth.uid())),'[]'),
 'members',coalesce((select jsonb_agg(to_jsonb(m)||coalesce(to_jsonb(d)-'member_id','{}')||jsonb_build_object('label',m.full_name,'organization_id',c.organization_id,'missing',
 concat_ws(' · ',case when nullif(trim(coalesce(d.phone,m.phone)), '') is null then 'Telefon' end,
 case when coalesce(req.emergency_contact,false) and (nullif(trim(d.emergency_name),'') is null or nullif(trim(d.emergency_phone),'') is null) then 'Acil iletişim' end,
 case when coalesce(req.document_required,false) and not exists(select 1 from public.registration_documents doc where doc.member_id=m.id) then 'Belge' end,
 case when exists(select 1 from public.registration_policies p where p.organization_id=c.organization_id and (p.center_id is null or p.center_id=m.center_id) and p.required and p.retired_at is null and not exists(select 1 from public.registration_acceptances a where a.member_id=m.id and a.policy_id=p.id)) then 'Kural kabulü' end)))
 from public.members m join public.centers c on c.id=m.center_id left join public.registration_details d on d.member_id=m.id left join public.registration_requirements req on req.center_id=m.center_id where m.profile_id=auth.uid()),'[]'),
 'policies',coalesce((select jsonb_agg(to_jsonb(p)) from public.registration_policies p where p.retired_at is null and exists(select 1 from public.members m join public.centers c on c.id=m.center_id where m.profile_id=auth.uid() and c.organization_id=p.organization_id and (p.center_id is null or p.center_id=m.center_id))),'[]'),
 'acceptances',coalesce((select jsonb_agg(to_jsonb(a)) from public.registration_acceptances a where exists(select 1 from public.members m where m.id=a.member_id and m.profile_id=auth.uid())),'[]'),
 'documents',coalesce((select jsonb_agg(to_jsonb(d)) from public.registration_documents d where exists(select 1 from public.members m where m.id=d.member_id and m.profile_id=auth.uid())),'[]'),
 'requirements',coalesce((select jsonb_agg(to_jsonb(r)) from public.registration_requirements r where exists(select 1 from public.members m where m.center_id=r.center_id and m.profile_id=auth.uid())),'[]'));
end;$$;
revoke all on function public.registration_self_workspace() from public,anon;grant execute on function public.registration_self_workspace() to authenticated;

