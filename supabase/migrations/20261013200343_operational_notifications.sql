
alter table public.notifications add column dedupe_key text;
create unique index notifications_dedupe_idx on public.notifications(recipient_id,dedupe_key) where dedupe_key is not null;
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check(type in (
 'session_request_created','session_request_approved','session_request_rejected','session_request_updated',
 'studio_lesson_changed','studio_lesson_reminder','studio_package_expiry'));
create function app_private.notify_lesson_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status is distinct from new.status or old.starts_at is distinct from new.starts_at or old.room_id is distinct from new.room_id or old.instructor_id is distinct from new.instructor_id then
 insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href)
 select distinct p.id,c.organization_id,new.center_id,'studio_lesson_changed','Ders bilgisi değişti',new.title||' · '||(case new.status when 'scheduled' then 'Planlandı' when 'completed' then 'Tamamlandı' when 'cancelled' then 'İptal' else 'Ertelendi' end),'/dashboard/my-learning'
 from public.centers c cross join (
 select m.profile_id as id from public.members m where m.id=new.private_member_id
 union select m.profile_id from public.lesson_enrollments e join public.members m on m.id=e.member_id where e.lesson_id=new.id
 union select new.instructor_id union select old.instructor_id) p
 where c.id=new.center_id and p.id is not null;
 end if;return new;
end;$$;
create trigger studio_lesson_notifications after update on public.lessons for each row execute function app_private.notify_lesson_change();
revoke all on function app_private.notify_lesson_change() from public,anon,authenticated;
create function app_private.enqueue_studio_reminders() returns integer language plpgsql security definer set search_path='' as $$
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
 where l.status='scheduled' and l.starts_at>now() and l.starts_at<=now()+interval '24 hours' and r.id is not null
 on conflict do nothing;get diagnostics n=row_count;total:=total+n;
 insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href,dedupe_key)
 select m.profile_id,c.organization_id,s.center_id,'studio_package_expiry','Paketiniz bitmek üzere',
 'Kalan kredi: '||s.credits_remaining::text||coalesce(' · Bitiş: '||s.ends_on::text,''),'/dashboard/my-learning','package:'||s.id::text
 from public.subscriptions s join public.members m on m.id=s.member_id join public.centers c on c.id=s.center_id
 where s.status='active' and s.starts_on<=(now() at time zone 'Europe/Istanbul')::date and m.profile_id is not null
 and (s.credits_remaining<=1 or s.ends_on<=(now() at time zone 'Europe/Istanbul')::date+7)
 on conflict do nothing;get diagnostics n=row_count;return total+n;
end;$$;
revoke all on function app_private.enqueue_studio_reminders() from public,anon,authenticated;
-- Hosted Supabase supplies pg_cron. Lightweight local contract databases can omit it.
do $$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
   create extension if not exists pg_cron;
   perform cron.schedule('studio-notifications','*/15 * * * *','select app_private.enqueue_studio_reminders();');
 end if;
end;$$;
