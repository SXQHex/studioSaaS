create or replace function app_private.notify_session_request_changes()
returns trigger language plpgsql security definer set search_path to ''
as $$
declare
 v_center_name text;
 v_sender_is_manager boolean;
 v_title text;
 v_body text;
 v_type text;
begin
 select c.name into v_center_name from public.centers c where c.id=new.center_id;
 if tg_op='INSERT' then
   select exists(select 1 from public.center_role_assignments a
     where a.center_id=new.center_id and a.profile_id=new.requested_by and a.role='admin')
     or exists(select 1 from public.organization_role_assignments a
       where a.organization_id=new.organization_id and a.profile_id=new.requested_by and a.role='owner')
     or exists(select 1 from public.platform_role_assignments a
       where a.profile_id=new.requested_by and a.role='appowner')
   into v_sender_is_manager;
   v_type:='session_request_created';
   if v_sender_is_manager then
     v_title:='Yeni seans planlama talebi';
     v_body:=coalesce(new.title,'Seans')||' · '||coalesce(v_center_name,'Merkez')||' için bir ders planlama talebi gönderildi.';
     insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href)
     select new.instructor_id,new.organization_id,new.center_id,v_type,v_title,v_body,'/dashboard/session-requests'
     where new.instructor_id is not null;
   else
     v_title:='Yeni seans talebi';
     v_body:=coalesce(new.title,'Seans')||' · '||coalesce(v_center_name,'Merkez')||' için değerlendirme bekliyor.';
     insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href)
     select distinct recipients.profile_id,new.organization_id,new.center_id,v_type,v_title,v_body,'/dashboard/session-requests'
     from (
       select a.profile_id from public.center_role_assignments a
         where a.center_id=new.center_id and a.role='admin'
       union
       select a.profile_id from public.organization_role_assignments a
         where a.organization_id=new.organization_id and a.role='owner'
       union
       select a.profile_id from public.platform_role_assignments a where a.role='appowner'
     ) recipients where recipients.profile_id is distinct from new.requested_by;
   end if;
   return new;
 end if;
 if old.status is distinct from new.status and new.status in ('approved','rejected') then
   v_type:=case when new.status='approved' then 'session_request_approved' else 'session_request_rejected' end;
   v_title:=case when new.status='approved' then 'Seans talebi onaylandı' else 'Seans talebi reddedildi' end;
   v_body:=coalesce(new.title,'Seans')||' · '||coalesce(v_center_name,'Merkez')||
    case when new.status='approved' then ' talebiniz onaylandı.' else ' talebiniz reddedildi.' end;
   insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href)
   select distinct recipients.id,new.organization_id,new.center_id,v_type,v_title,v_body,'/dashboard/session-requests'
   from (values(new.requested_by),(new.instructor_id)) recipients(id)
   where recipients.id is not null;
 end if;
 return new;
end;
$$;
revoke all on function app_private.notify_session_request_changes() from public,anon,authenticated;
