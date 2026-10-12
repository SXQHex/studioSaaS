begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  center_id uuid references public.centers(id) on delete cascade,
  type text not null check (type in ('session_request_created', 'session_request_approved', 'session_request_rejected')),
  title text not null check (length(title) between 1 and 160),
  body text not null check (length(body) between 1 and 500),
  href text not null default '/dashboard/notifications',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(recipient_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select to authenticated using (recipient_id = (select auth.uid()));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
revoke all privileges on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create or replace function app_private.notify_session_request_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_center_name text;
  v_title text;
  v_body text;
  v_type text;
begin
  select c.name into v_center_name from public.centers c where c.id = new.center_id;
  if tg_op = 'INSERT' then
    v_title := 'Yeni seans talebi';
    v_body := coalesce(new.title, 'Seans') || ' · ' || coalesce(v_center_name, 'Merkez') || ' için değerlendirme bekliyor.';
    v_type := 'session_request_created';
    insert into public.notifications (recipient_id, organization_id, center_id, type, title, body, href)
      select p.id, new.organization_id, new.center_id, v_type, v_title, v_body, '/dashboard/session-requests'
      from public.profiles p
      join public.center_admins ca on ca.profile_id = p.id and ca.center_id = new.center_id
      where p.role = 'admin'::public.app_role;
    return new;
  end if;

  if old.status is distinct from new.status and new.status in ('approved', 'rejected') then
    v_type := case when new.status = 'approved' then 'session_request_approved' else 'session_request_rejected' end;
    v_title := case when new.status = 'approved' then 'Seans talebi onaylandı' else 'Seans talebi reddedildi' end;
    v_body := coalesce(new.title, 'Seans') || ' · ' || coalesce(v_center_name, 'Merkez') || case when new.status = 'approved' then ' talebiniz onaylandı.' else ' talebiniz reddedildi.' end;
    insert into public.notifications (recipient_id, organization_id, center_id, type, title, body, href)
      select distinct recipients.id, new.organization_id, new.center_id, v_type, v_title, v_body, '/dashboard/session-requests'
      from (values (new.requested_by), (new.instructor_id)) as recipients(id)
      where recipients.id is not null;
  end if;
  return new;
end;
$function$;
revoke all on function app_private.notify_session_request_changes() from public, anon, authenticated;
drop trigger if exists session_request_notification_insert on public.session_requests;
create trigger session_request_notification_insert after insert on public.session_requests for each row execute function app_private.notify_session_request_changes();
drop trigger if exists session_request_notification_review on public.session_requests;
create trigger session_request_notification_review after update of status on public.session_requests for each row execute function app_private.notify_session_request_changes();

commit;
