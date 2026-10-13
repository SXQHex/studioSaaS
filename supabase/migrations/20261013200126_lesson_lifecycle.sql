
create table public.studio_policies(center_id uuid primary key references public.centers(id),cancellation_hours integer not null default 24 check(cancellation_hours between 0 and 168));
alter table public.studio_policies enable row level security;

revoke all on public.studio_policies from public,anon,authenticated;
create table public.lesson_member_outcomes(
 lesson_id uuid not null references public.lessons(id),member_id uuid not null references public.members(id),
 outcome text not null check(outcome in ('student_cancel','late_cancel','no_show')),
 actor_id uuid not null references public.profiles(id),note text not null,created_at timestamptz not null default now(),primary key(lesson_id,member_id));
alter table public.lesson_member_outcomes enable row level security;
create policy outcomes_read on public.lesson_member_outcomes for select to authenticated using(
 exists(select 1 from public.lessons l where l.id=lesson_id and app_private.can_manage_center(l.center_id))
 or exists(select 1 from public.members m where m.id=member_id and m.profile_id=auth.uid()));
revoke all on public.lesson_member_outcomes from public,anon,authenticated;grant select on public.lesson_member_outcomes to authenticated;
create index outcomes_member_idx on public.lesson_member_outcomes(member_id);
create index outcomes_actor_idx on public.lesson_member_outcomes(actor_id);
create table public.lesson_changes(
 id uuid primary key default gen_random_uuid(),lesson_id uuid not null references public.lessons(id),actor_id uuid references public.profiles(id),
 action text not null,note text not null,old_starts_at timestamptz,new_starts_at timestamptz,created_at timestamptz not null default now());
alter table public.lesson_changes enable row level security;
create policy changes_read on public.lesson_changes for select to authenticated using(exists(select 1 from public.lessons l where l.id=lesson_id));
revoke all on public.lesson_changes from public,anon,authenticated;grant select on public.lesson_changes to authenticated;
create index changes_lesson_idx on public.lesson_changes(lesson_id);
create index changes_actor_idx on public.lesson_changes(actor_id);
alter table public.lessons add column makeup_of uuid references public.lessons(id);
create unique index lessons_single_makeup on public.lessons(makeup_of) where makeup_of is not null;

create function app_private.charge_lesson_member(p_lesson uuid,p_member uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.lessons%rowtype;s public.subscriptions%rowtype;d date;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_lesson::text||p_member::text,0));
 if exists(select 1 from public.credit_transactions where lesson_id=p_lesson and member_id=p_member and reason='lesson_use') then return;end if;
 select * into l from public.lessons where id=p_lesson;d:=(l.starts_at at time zone 'Europe/Istanbul')::date;
 select * into s from public.subscriptions where member_id=p_member and center_id=l.center_id and status='active'
 and type=(case when l.type='group' then 'group_4_weeks' else 'private_credits' end)::public.subscription_type
 and starts_on<=d and (ends_on is null or ends_on>=d) and credits_remaining>0 order by starts_on,created_at limit 1 for update;
 if not found then raise exception 'Katılımcı için kullanılabilir ders kredisi yok.';end if;
 insert into public.credit_transactions(subscription_id,member_id,lesson_id,amount,reason,note,created_by)
 values(s.id,p_member,p_lesson,-1,'lesson_use','Katılım veya geç iptal/gelmeme kuralı',auth.uid());
 update public.subscriptions set credits_remaining=credits_remaining-1 where id=s.id;
end;$$;
revoke all on function app_private.charge_lesson_member(uuid,uuid) from public,anon,authenticated;

create or replace function app_private.consume_lesson_credit(p_lesson_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.lessons%rowtype;mid uuid;
begin
 select * into l from public.lessons where id=p_lesson_id;
 if not found or l.status<>'completed' then return;end if;
 if l.type='private' then
  if not exists(select 1 from public.lesson_member_outcomes where lesson_id=l.id and member_id=l.private_member_id and outcome='student_cancel') then perform app_private.charge_lesson_member(l.id,l.private_member_id);end if;
 else
  for mid in select member_id from public.attendance where lesson_id=l.id and attended
    union select member_id from public.lesson_member_outcomes where lesson_id=l.id and outcome in ('late_cancel','no_show')
  loop
   if not exists(select 1 from public.lesson_member_outcomes where lesson_id=l.id and member_id=mid and outcome='student_cancel') then perform app_private.charge_lesson_member(l.id,mid);end if;
  end loop;
 end if;
end;$$;

create function app_private.refund_cancelled_lesson() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.credit_transactions%rowtype;
begin
 if new.status in ('cancelled','postponed') and old.status is distinct from new.status then
  for t in select * from public.credit_transactions where lesson_id=new.id and reason='lesson_use' loop
   if not (current_setting('app.student_cancel',true) is not distinct from 'on' and exists(select 1 from public.lesson_member_outcomes where lesson_id=new.id and member_id=t.member_id and outcome='late_cancel')) and not exists(select 1 from public.credit_transactions where subscription_id=t.subscription_id and member_id=t.member_id and lesson_id=t.lesson_id and reason='refund') then
    insert into public.credit_transactions(subscription_id,member_id,lesson_id,amount,reason,note,created_by)
    values(t.subscription_id,t.member_id,t.lesson_id,-t.amount,'refund','Ders iptal/erteleme kredi iadesi',auth.uid());
   end if;
  end loop;
 end if;return new;
end;$$;
create trigger lessons_credit_refund after update of status on public.lessons for each row execute function app_private.refund_cancelled_lesson();
revoke all on function app_private.refund_cancelled_lesson() from public,anon,authenticated;

create function app_private.lesson_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.lessons%rowtype;m public.members%rowtype;mid uuid;staff boolean;manager boolean;hrs integer;outcome text;lid uuid;op text:=p_data->>'action';s timestamptz;e timestamptz;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 if op='policy' then
 if not app_private.can_manage_center((p_data->>'center_id')::uuid) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 insert into public.studio_policies(center_id,cancellation_hours) values((p_data->>'center_id')::uuid,(p_data->>'hours')::integer)
 on conflict(center_id) do update set cancellation_hours=excluded.cancellation_hours;return '{}'::jsonb;end if;
 select * into l from public.lessons where id=(p_data->>'lesson_id')::uuid for update;
 if not found then raise exception 'Ders bulunamadı.';end if;
 manager:=app_private.can_manage_center(l.center_id);
 staff:=manager or exists(select 1 from public.lesson_staff_assignments where lesson_id=l.id and profile_id=auth.uid() and role='instructor');
 if length(trim(coalesce(p_data->>'note',''))) not between 1 and 500 then raise exception 'İşlem açıklaması zorunlu.';end if;
 perform set_config('app.lesson_change_note',trim(p_data->>'note'),true);
 perform set_config('app.lesson_change_action',op,true);
 if op in ('student_cancel','no_show') then
  mid:=(p_data->>'member_id')::uuid;
  select * into m from public.members where id=mid and center_id=l.center_id;
  if not found or not (coalesce(l.private_member_id=mid,false) or exists(select 1 from public.lesson_enrollments where lesson_id=l.id and member_id=mid)) then raise exception 'Bu dersin katılımcısı seçilmelidir.';end if;
  if (op='student_cancel' and not staff and m.profile_id is distinct from auth.uid()) or (op='no_show' and not staff) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
  if op='student_cancel' and (l.status<>'scheduled' or l.starts_at<=now()) then raise exception 'Yalnızca gelecek ders iptal edilebilir.';end if;
  if op='no_show' and exists(select 1 from public.attendance where lesson_id=l.id and member_id=mid and attended) then raise exception 'Katılımı olan öğrenci gelmedi olarak işaretlenemez.';end if;
  if op='no_show' and (l.status not in ('scheduled','completed') or l.starts_at>now()) then raise exception 'Gelmeme kaydı ders başladıktan sonra girilir.';end if;
  if exists(select 1 from public.lesson_member_outcomes where lesson_id=l.id and member_id=mid) then return '{}'::jsonb;end if;
  select cancellation_hours into hrs from public.studio_policies where center_id=l.center_id;hrs:=coalesce(hrs,24);
  outcome:=case when op='no_show' then 'no_show' when l.starts_at-now()>=make_interval(hours=>hrs) then 'student_cancel' else 'late_cancel' end;
  insert into public.lesson_member_outcomes(lesson_id,member_id,outcome,actor_id,note) values(l.id,mid,outcome,auth.uid(),trim(p_data->>'note'));
  if outcome in ('no_show','late_cancel') then perform app_private.charge_lesson_member(l.id,mid);end if;
  if op='student_cancel' and l.type='private' then
   perform set_config('app.student_cancel','on',true);
   update public.lessons set status='cancelled' where id=l.id;
   perform set_config('app.student_cancel','',true);
  elsif outcome='student_cancel' then
   delete from public.lesson_enrollments where lesson_id=l.id and member_id=mid;
  end if;
  return jsonb_build_object('outcome',outcome);
 end if;
 if not staff then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if op='cancel' then
  if l.status='cancelled' then return '{}'::jsonb;end if;
  update public.lessons set status='cancelled' where id=l.id;
 elsif op='reschedule' then
  if l.status<>'scheduled' then raise exception 'Yalnızca planlanmış ders ertelenebilir.';end if;
  s:=(p_data->>'starts_at')::timestamptz;e:=(p_data->>'ends_at')::timestamptz;
  if s is null or s<=now() or e is null or e<=s then raise exception 'Yeni ders saati geçersiz.';end if;
  update public.lessons set starts_at=s,ends_at=e where id=l.id;
 elsif op='makeup' then
  if not manager or l.status not in ('cancelled','postponed') then raise exception 'Telafiyi yönetici iptal/ertelenen ders için oluşturabilir.';end if;
  if exists(select 1 from public.lessons where makeup_of=l.id) then raise exception 'Bu ders için telafi zaten oluşturuldu.';end if;
  s:=(p_data->>'starts_at')::timestamptz;e:=(p_data->>'ends_at')::timestamptz;
  if s is null or s<=now() or e is null or e<=s then raise exception 'Telafi saati geçersiz.';end if;
  insert into public.lessons(center_id,room_id,instructor_id,type,title,starts_at,ends_at,expected_attendees,private_member_id,created_by,makeup_of,group_id)
  values(l.center_id,l.room_id,l.instructor_id,l.type,l.title||' · Telafi',s,e,l.expected_attendees,l.private_member_id,auth.uid(),l.id,l.group_id) returning id into lid;
  insert into public.lesson_enrollments(lesson_id,center_id,member_id) select lid,l.center_id,member_id from public.lesson_enrollments where lesson_id=l.id;
 else raise exception 'İşlem geçersiz.';end if;
 if op='makeup' then insert into public.lesson_changes(lesson_id,actor_id,action,note,old_starts_at,new_starts_at)
 values(l.id,auth.uid(),op,trim(p_data->>'note'),l.starts_at,s);end if;
 return jsonb_build_object('id',coalesce(lid,l.id));
end;$$;
create function public.lesson_command(p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select app_private.lesson_command(p_data);$$;
revoke all on function app_private.lesson_command(jsonb),public.lesson_command(jsonb) from public,anon;
grant execute on function app_private.lesson_command(jsonb),public.lesson_command(jsonb) to authenticated;

-- A refunded/cancelled lesson cannot be reopened and consume credit under its old identity.
create function app_private.prevent_cancelled_lesson_reopen() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status in ('cancelled','postponed') and new.status in ('scheduled','completed') then raise exception 'İptal/ertelenen ders yeniden açılamaz; telafi dersi oluşturun.';end if;
 if new.expected_attendees<(select count(*) from public.lesson_enrollments where lesson_id=new.id) then raise exception 'Kontenjan kayıtlı öğrenci sayısının altına indirilemez.';end if;
 return new;
end;$$;
create trigger lessons_reopen_and_capacity_guard before update on public.lessons for each row execute function app_private.prevent_cancelled_lesson_reopen();
revoke all on function app_private.prevent_cancelled_lesson_reopen() from public,anon,authenticated;

create function app_private.record_lesson_change_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status is distinct from old.status or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at
 or new.room_id is distinct from old.room_id or new.instructor_id is distinct from old.instructor_id then
 insert into public.lesson_changes(lesson_id,actor_id,action,note,old_starts_at,new_starts_at)
 values(new.id,auth.uid(),coalesce(nullif(current_setting('app.lesson_change_action',true),''),'status_change'),
 coalesce(nullif(current_setting('app.lesson_change_note',true),''),'Ders durumu veya programı güncellendi.'),old.starts_at,new.starts_at);
 end if;return new;
end;$$;
create trigger lesson_change_audit after update on public.lessons for each row execute function app_private.record_lesson_change_history();
revoke all on function app_private.record_lesson_change_history() from public,anon,authenticated;
