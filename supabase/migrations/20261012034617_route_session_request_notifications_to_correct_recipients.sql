begin;

create or replace function app_private.notify_session_request_changes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_center_name text;
  v_requester_role public.app_role;
  v_title text;
  v_body text;
  v_type text;
begin
  select c.name into v_center_name
  from public.centers c
  where c.id = new.center_id;

  if tg_op = 'INSERT' then
    select p.role into v_requester_role
    from public.profiles p
    where p.id = new.requested_by;

    if v_requester_role = 'admin'::public.app_role then
      v_title := 'Yeni seans planlama talebi';
      v_body := coalesce(new.title, 'Seans') || ' · ' ||
        coalesce(v_center_name, 'Merkez') || ' için size bir ders planlama talebi gönderildi.';
      v_type := 'session_request_created';
      insert into public.notifications
        (recipient_id, organization_id, center_id, type, title, body, href)
      select p.id, new.organization_id, new.center_id, v_type, v_title, v_body,
        '/dashboard/session-requests'
      from public.profiles p
      where p.id = new.instructor_id
        and p.role = 'instructor'::public.app_role;
    else
      v_title := 'Yeni seans talebi';
      v_body := coalesce(new.title, 'Seans') || ' · ' ||
        coalesce(v_center_name, 'Merkez') || ' için değerlendirme bekliyor.';
      v_type := 'session_request_created';
      insert into public.notifications
        (recipient_id, organization_id, center_id, type, title, body, href)
      select p.id, new.organization_id, new.center_id, v_type, v_title, v_body,
        '/dashboard/session-requests'
      from public.profiles p
      join public.center_admins ca
        on ca.profile_id = p.id and ca.center_id = new.center_id
      where p.role = 'admin'::public.app_role;
    end if;
    return new;
  end if;

  if old.status is distinct from new.status
    and new.status in ('approved', 'rejected') then
    v_type := case when new.status = 'approved'
      then 'session_request_approved' else 'session_request_rejected' end;
    v_title := case when new.status = 'approved'
      then 'Seans talebi onaylandı' else 'Seans talebi reddedildi' end;
    v_body := coalesce(new.title, 'Seans') || ' · ' ||
      coalesce(v_center_name, 'Merkez') ||
      case when new.status = 'approved'
        then ' talebiniz onaylandı.' else ' talebiniz reddedildi.' end;
    insert into public.notifications
      (recipient_id, organization_id, center_id, type, title, body, href)
    select distinct recipients.id, new.organization_id, new.center_id,
      v_type, v_title, v_body, '/dashboard/session-requests'
    from (values (new.requested_by), (new.instructor_id)) as recipients(id)
    where recipients.id is not null;
  end if;

  return new;
end;
$function$;

revoke all on function app_private.notify_session_request_changes()
  from public, anon, authenticated;

commit;
