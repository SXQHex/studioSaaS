create or replace function public.claim_studio_emails(p_centers uuid[] default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 update public.studio_email_outbox o set status='failed',last_error='Recipient suppressed',updated_at=now() where o.status in ('pending','retry','processing') and exists(select 1 from public.studio_email_outbox s where s.recipient_id=o.recipient_id and s.status in ('bounced','complained'));
 update public.studio_email_outbox set status='failed',last_error='Retry window expired',updated_at=now()
 where status in ('retry','processing') and first_attempt_at<now()-interval '23 hours';
 with due as(
 select o.id from public.studio_email_outbox o where (p_centers is null or o.center_id=any(p_centers)) and (
 (o.status in ('pending','retry') and o.next_attempt_at<=now()) or (o.status='processing' and o.lease_until<now()))
 and o.attempts<5 order by o.created_at for update skip locked limit 10
 ), claimed as (
 update public.studio_email_outbox o set status='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),
 lease_until=now()+interval '5 minutes',lease_token=gen_random_uuid(),updated_at=now() from due where o.id=due.id returning o.*
 )
 select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('email',u.email,'title',n.title,'body',n.body,'href',n.href)),'[]') into r
 from claimed o join auth.users u on u.id=o.recipient_id join public.notifications n on n.id=o.notification_id;
 return r;
end;$$;
create or replace function public.retry_studio_email(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.studio_email_outbox%rowtype;
begin
 select * into o from public.studio_email_outbox where id=p_id for update;
 if not found or auth.uid() is null or not app_private.can_manage_center(o.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if exists(select 1 from public.studio_email_outbox where recipient_id=o.recipient_id and status in ('bounced','complained')) then raise exception 'Adres teslim hatası veya şikayet nedeniyle gönderime kapalı.';end if;
 if o.status not in ('failed','retry') or o.provider_id is not null then raise exception 'Bu gönderim tekrar denenemez.';end if;
 if o.first_attempt_at is not null and o.first_attempt_at<now()-interval '23 hours' then raise exception 'Çift gönderimi önlemek için deneme süresi dolmuş gönderimi yeniden açamazsınız.';end if;
 update public.studio_email_outbox set status='retry',attempts=0,next_attempt_at=now(),updated_at=now() where id=o.id;
end;$$;
create or replace function app_private.enqueue_studio_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;total integer:=0;
begin
 insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href,dedupe_key)
 select distinct r.id,c.organization_id,l.center_id,'studio_lesson_reminder','Dersiniz yaklaşıyor',
 l.title||' · '||to_char(l.starts_at at time zone 'Europe/Istanbul','DD.MM.YYYY HH24:MI'),case when r.id=l.instructor_id then '/dashboard/lessons' else '/dashboard/my-learning' end,'lesson:'||l.id::text||':'||l.starts_at::text
 from public.lessons l join public.centers c on c.id=l.center_id cross join lateral (
 select m.profile_id id from public.members m where m.id=l.private_member_id
 union select m.profile_id from public.lesson_enrollments e join public.members m on m.id=e.member_id where e.lesson_id=l.id
 and not exists(select 1 from public.lesson_member_outcomes o where o.lesson_id=l.id and o.member_id=m.id)
 union select l.instructor_id) r
 where l.status='scheduled' and l.starts_at>now() and l.starts_at<=now()+make_interval(hours=>app_private.policy_number(l.center_id,'lesson_reminder_hours')) and r.id is not null
 on conflict do nothing;get diagnostics n=row_count;total:=total+n;
 insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href,dedupe_key)
 select m.profile_id,c.organization_id,s.center_id,'studio_package_expiry','Paketiniz bitmek üzere',
 'Kalan kredi: '||s.credits_remaining::text||coalesce(' · Bitiş: '||app_private.subscription_end(s.id)::text,''),'/dashboard/my-learning','package:'||s.id::text||':'||coalesce(app_private.subscription_end(s.id)::text,'unlimited')
 from public.subscriptions s join public.members m on m.id=s.member_id join public.centers c on c.id=s.center_id
 where s.status='active' and s.starts_on<=(now() at time zone 'Europe/Istanbul')::date and m.profile_id is not null
 and (s.credits_remaining<=app_private.policy_number(s.center_id,'low_credit_threshold') or app_private.subscription_end(s.id)<=(now() at time zone 'Europe/Istanbul')::date+app_private.policy_number(s.center_id,'package_reminder_days'))
 on conflict do nothing;get diagnostics n=row_count;return total+n;
end;$$;

create function app_private.freeze_cancel_package_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.studio_email_outbox o set status='cancelled',updated_at=now() from public.notifications n
 where o.notification_id=n.id and n.type='studio_package_expiry' and n.dedupe_key like 'package:'||new.subscription_id::text||'%'
 and o.status in ('pending','retry','processing');return new;
end;$$;
create trigger freeze_cancel_package_email after insert on public.subscription_freezes for each row execute function app_private.freeze_cancel_package_email();
revoke all on function app_private.freeze_cancel_package_email() from public,anon,authenticated;
