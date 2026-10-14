-- Forward-only recovery corrections. Existing credit/payment history is preserved.
alter default privileges in schema app_private revoke execute on functions from public;
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='app_private' and (p.prorettype='trigger'::regtype or p.proname in ('consume_lesson_credit','charge_lesson_member'))
 loop execute format('revoke execute on function %s from public, anon, authenticated',f.signature);end loop;
end;$$;

alter table public.manual_payments add column method text not null default 'manual' check(method in ('cash','manual'));
comment on column public.manual_payments.method is 'cash: cash receipt; manual: other manually recorded payment or historical opening. Reversals preserve original method.';
create or replace function app_private.notify_lesson_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status is distinct from new.status or old.starts_at is distinct from new.starts_at or old.ends_at is distinct from new.ends_at or old.room_id is distinct from new.room_id or old.instructor_id is distinct from new.instructor_id then
 insert into public.notifications(recipient_id,organization_id,center_id,type,title,body,href)
 select distinct p.id,c.organization_id,new.center_id,'studio_lesson_changed','Ders bilgisi değişti',new.title||' · '||to_char(new.starts_at at time zone 'Europe/Istanbul','DD.MM.YYYY HH24:MI')||'–'||to_char(new.ends_at at time zone 'Europe/Istanbul','HH24:MI')||' · '||(case new.status when 'scheduled' then 'Planlandı' when 'completed' then 'Tamamlandı' when 'cancelled' then 'İptal' else 'Ertelendi' end),case when p.id in (new.instructor_id,old.instructor_id) then '/dashboard/my-students' else '/dashboard/my-learning' end
 from public.centers c cross join (
 select m.profile_id as id from public.members m where m.id=new.private_member_id
 union select m.profile_id from public.lesson_enrollments e join public.members m on m.id=e.member_id where e.lesson_id=new.id
 union select new.instructor_id union select old.instructor_id) p
 where c.id=new.center_id and p.id is not null;
 end if;return new;
end;$$;
create or replace function app_private.payments_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.subscriptions%rowtype;p public.manual_payments%rowtype;existing public.manual_payments%rowtype;
 a numeric;net numeric;pid uuid;op text:=p_data->>'action';k uuid:=(p_data->>'key')::uuid;t timestamptz:=(p_data->>'occurred_at')::timestamptz;method text:=coalesce(nullif(p_data->>'method',''),'manual');
begin
 select * into s from public.subscriptions where id=(p_data->>'subscription_id')::uuid for update;
 if not found or auth.uid() is null or not app_private.can_manage_center(s.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if k is null or t is null or t>now()+interval '5 minutes' or length(trim(coalesce(p_data->>'note',''))) not between 1 and 500 then raise exception 'İşlem tarihi, açıklama ve işlem anahtarı zorunlu.';end if;
 if method not in ('cash','manual') then raise exception 'Ödeme yöntemi geçersiz.';end if;
 if op='reverse' then
  select * into p from public.manual_payments where id=(p_data->>'entry_id')::uuid and subscription_id=s.id;
  if not found or p.kind='reversal' then raise exception 'Düzeltilecek işlem geçersiz.';end if;a:=-p.amount;method:=p.method;
 elsif op in ('collect','refund') then
  a:=(p_data->>'amount')::numeric;
  if a is null or a<=0 or a<>round(a,2) then raise exception 'Pozitif ve iki ondalıklı tutar girin.';end if;
  if op='refund' then a:=-a;end if;
 else raise exception 'İşlem geçersiz.';end if;
 select * into existing from public.manual_payments where idempotency_key=k;
 if found then
  if existing.subscription_id<>s.id or existing.amount<>a or existing.method<>method or (op='reverse' and existing.reversed_entry_id is distinct from p.id) or existing.kind<>(case op when 'collect' then 'collection' when 'refund' then 'refund' else 'reversal' end) then raise exception 'İşlem anahtarı başka bir işlemde kullanılmış.';end if;
  return jsonb_build_object('id',existing.id);
 end if;
 select coalesce(sum(amount),0) into net from public.manual_payments where subscription_id=s.id;
 if net+a<0 or net+a>s.amount then raise exception 'Tutar, tahsil edilen tutarı veya kalan borcu aşıyor.';end if;
 insert into public.manual_payments(subscription_id,center_id,amount,kind,occurred_at,actor_id,note,reversed_entry_id,idempotency_key,method)
 values(s.id,s.center_id,a,case op when 'collect' then 'collection' when 'refund' then 'refund' else 'reversal' end,t,auth.uid(),trim(p_data->>'note'),case when op='reverse' then p.id else null end,k,method) returning id into pid;
 update public.subscriptions set payment_status=case when net+a>=amount then 'paid'::public.payment_status when net+a=0 and op in ('refund','reverse') then 'refunded'::public.payment_status else 'pending'::public.payment_status end,
 paid_at=case when net+a>=amount then t else null end where id=s.id;
 return jsonb_build_object('id',pid,'paid',net+a,'balance',s.amount-net-a);
end;$$;
create or replace function app_private.crm_command(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.crm_leads%rowtype;cid uuid;mid uuid;lid uuid;matches integer;op text:=p_data->>'action';em text;ph text;
begin
 if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501';end if;
 if op='create' then
 cid:=(p_data->>'center_id')::uuid;
 if not app_private.can_manage_center(cid) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 em:=nullif(lower(trim(p_data->>'email')),'');ph:=nullif(regexp_replace(coalesce(p_data->>'phone',''),'[^0-9]','','g'),'');
 if length(coalesce(em,''))>320 or length(coalesce(ph,''))>20 or length(coalesce(p_data->>'source','')) not between 1 and 160 then raise exception 'İletişim veya kaynak geçersiz.';end if;
 insert into public.crm_leads(center_id,full_name,email,phone,source,interests,notes,created_by)
 values(cid,trim(p_data->>'full_name'),em,ph,trim(p_data->>'source'),nullif(trim(p_data->>'interests'),''),nullif(trim(p_data->>'notes'),''),auth.uid()) returning id into lid;
 return jsonb_build_object('id',lid);
 end if;
 select * into l from public.crm_leads where id=(p_data->>'lead_id')::uuid for update;
 if not found or not app_private.can_manage_center(l.center_id) then raise exception 'Yetkiniz yok.' using errcode='42501';end if;
 if op='update' then
 if l.converted_member_id is not null then raise exception 'Üyeye dönüşen adayın bilgilerini üye ekranından yönetin.';end if;
 if p_data->>'stage'='converted' then raise exception 'Üyeye dönüştür işlemini kullanın.';end if;
 update public.crm_leads set stage=p_data->>'stage',interests=p_data->>'interests',notes=p_data->>'notes',
 trial_at=nullif(p_data->>'trial_at','')::timestamptz,updated_at=now() where id=l.id;
 elsif op='task' then
 if length(trim(coalesce(p_data->>'title',''))) not between 1 and 160 or nullif(p_data->>'due_at','') is null then raise exception 'Görev başlığı ve tarih zorunlu.';end if;
 insert into public.crm_tasks(lead_id,title,due_at,created_by) values(l.id,trim(p_data->>'title'),(p_data->>'due_at')::timestamptz,auth.uid());
 elsif op='complete_task' then
 update public.crm_tasks set completed_at=coalesce(completed_at,now()) where id=(p_data->>'task_id')::uuid and lead_id=l.id;
 if not found then raise exception 'Görev bulunamadı.';end if;
 elsif op='convert' then
 if l.converted_member_id is not null then return jsonb_build_object('member_id',l.converted_member_id);end if;
 perform pg_advisory_xact_lock(hashtextextended('crm-convert:'||l.center_id::text,0));
 select count(*),min(id::text)::uuid into matches,mid from public.members where center_id=l.center_id and
 ((l.email is not null and lower(trim(email))=l.email) or (l.phone is not null and regexp_replace(phone,'[^0-9]','','g')=l.phone));
 if matches>1 then raise exception 'Birden fazla üye eşleşti; yönetici kayıtları önce incelemeli.';end if;
 if mid is null then
 insert into public.members(center_id,full_name,email,phone,notes) values(l.center_id,l.full_name,l.email,l.phone,l.notes) returning id into mid;
 end if;
 update public.crm_leads set converted_member_id=mid,stage='converted',updated_at=now(),converted_at=now() where id=l.id;
 return jsonb_build_object('member_id',mid);
 else raise exception 'İşlem geçersiz.';end if;
 return '{}'::jsonb;
end;$$;
create or replace function app_private.studio_report(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a timestamptz;b timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from public.centers c where app_private.can_manage_center(c.id)) then raise exception 'Yönetici erişimi gerekli.' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from then raise exception 'Tarih aralığı geçersiz.';end if;
 a:=p_from::timestamp at time zone 'Europe/Istanbul';b:=(p_to+1)::timestamp at time zone 'Europe/Istanbul';
 return jsonb_build_object(
 'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'member',m.full_name,'subscription_id',s.id,'amount',p.amount,'kind',p.kind,'method',p.method,'occurred_at',p.occurred_at,'note',p.note,'actor_id',p.actor_id)) from public.manual_payments p join public.subscriptions s on s.id=p.subscription_id join public.members m on m.id=s.member_id where p.occurred_at>=a and p.occurred_at<b and app_private.can_manage_center(p.center_id)),'[]'),
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

create function public.my_payment_balances()
returns table(subscription_id uuid,amount numeric,paid numeric,balance numeric)
language sql stable security definer set search_path='' as $$
 select s.id,s.amount,coalesce(p.net,0),s.amount-coalesce(p.net,0)
 from public.subscriptions s join public.members m on m.id=s.member_id
 left join lateral(select sum(mp.amount) net from public.manual_payments mp where mp.subscription_id=s.id) p on true
 where auth.uid() is not null and m.profile_id=auth.uid();
$$;
revoke all on function public.my_payment_balances() from public,anon;
grant execute on function public.my_payment_balances() to authenticated;

-- Attendance must refer to an actual participant and respect prior cancellation.
create function app_private.validate_attendance_outcome() returns trigger
language plpgsql security definer set search_path='' as $$
declare l public.lessons%rowtype;o text;
begin
 select * into l from public.lessons where id=new.lesson_id for update;
 if l.status in ('cancelled','postponed') then raise exception 'İptal/ertelenen dersin yoklaması değiştirilemez.';end if;
 if l.type='group' and not exists(select 1 from public.lesson_enrollments where lesson_id=l.id and member_id=new.member_id)
 then raise exception 'Öğrenci önce bu derse kaydedilmelidir.';end if;
 if l.type='private' and l.private_member_id is distinct from new.member_id then raise exception 'Özel ders katılımcısı geçersiz.';end if;
 select outcome into o from public.lesson_member_outcomes where lesson_id=l.id and member_id=new.member_id;
 if new.attended and o is not null then raise exception 'İptal/gelmeme kaydı olan öğrenci katıldı olarak işaretlenemez.';end if;
 if not new.attended then
  if l.starts_at>now() then raise exception 'Gelmeme kaydı ders başladıktan sonra girilir.';end if;
  if o is null then
   insert into public.lesson_member_outcomes(lesson_id,member_id,outcome,actor_id,note)
   values(l.id,new.member_id,'no_show',auth.uid(),coalesce(nullif(trim(new.notes),''),'Yoklama: gelmedi'));
   perform app_private.charge_lesson_member(l.id,new.member_id);
  end if;
 end if;
 return new;
end;$$;
create trigger attendance_outcome_guard before insert or update on public.attendance for each row execute function app_private.validate_attendance_outcome();
revoke all on function app_private.validate_attendance_outcome() from public,anon,authenticated;

-- A recorded absence does not by itself mark the entire group lesson completed.
create or replace function app_private.on_group_attendance_added() returns trigger
language plpgsql security definer set search_path='' as $$
declare l public.lessons%rowtype;
begin
 select * into l from public.lessons where id=new.lesson_id;
 if l.type='group' and new.attended and l.status not in ('cancelled','postponed') then
  update public.lessons set status='completed' where id=l.id and status<>'completed';
  perform app_private.consume_lesson_credit(l.id);
 end if;
 return new;
end;$$;
revoke all on function app_private.on_group_attendance_added() from public,anon,authenticated;

-- Personal lesson reads use an actual enrollment, not just a package in that center.
drop policy lessons_scoped_read on public.lessons;
create policy lessons_scoped_read on public.lessons for select to authenticated using(
 app_private.can_manage_center(center_id) or app_private.is_assigned_staff(id)
 or exists(select 1 from public.members m where m.id=private_member_id and m.profile_id=(select auth.uid()))
 or exists(select 1 from public.lesson_enrollments e join public.members m on m.id=e.member_id
 where e.lesson_id=lessons.id and m.profile_id=(select auth.uid())));

-- Cover frequently used foreign-key access paths without deleting historical indexes.
create index if not exists members_profile_id_idx on public.members(profile_id);
create index if not exists attendance_lesson_center_idx on public.attendance(lesson_id,center_id);
create index if not exists attendance_member_center_idx on public.attendance(member_id,center_id);
create index if not exists credit_transactions_lesson_center_idx on public.credit_transactions(lesson_id,center_id);
create index if not exists credit_transactions_member_center_idx on public.credit_transactions(member_id,center_id);
create index if not exists credit_transactions_subscription_center_idx on public.credit_transactions(subscription_id,center_id);
create index if not exists lesson_staff_center_profile_role_idx on public.lesson_staff_assignments(center_id,profile_id,role);
create index if not exists lesson_enrollments_member_center_idx on public.lesson_enrollments(member_id,center_id);
create index if not exists subscriptions_member_center_idx on public.subscriptions(member_id,center_id);
