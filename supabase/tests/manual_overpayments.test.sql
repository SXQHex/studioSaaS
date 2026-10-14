-- Overpayment, return of change, refund reversal and tenant isolation.
begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
 ('d1000000-0000-4000-8000-000000000001','authenticated','authenticated','dry-admin@example.invalid','',now(),'{}','{}'),
 ('d1000000-0000-4000-8000-000000000002','authenticated','authenticated','dry-other@example.invalid','',now(),'{}','{}'),
 ('d1000000-0000-4000-8000-000000000003','authenticated','authenticated','dry-student@example.invalid','',now(),'{}','{}'),
 ('d1000000-0000-4000-8000-000000000004','authenticated','authenticated','dry-instructor@example.invalid','',now(),'{}','{}');
insert into public.organizations(id,name,slug) values('d2000000-0000-4000-8000-000000000001','DRY Org','dry-test-org');
insert into public.centers(id,organization_id,name) values
 ('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','DRY A'),
 ('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','DRY B');
insert into public.center_role_assignments(center_id,profile_id,role) values
 ('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','admin'),
 ('d3000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','admin'),
 ('d3000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000004','instructor');
insert into public.members(id,center_id,full_name,profile_id) values
 ('d4000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','DRY Student','d1000000-0000-4000-8000-000000000003'),
 ('d4000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000002','DRY Secret',null);

insert into public.subscriptions(id,center_id,member_id,type,starts_on,credits_purchased,credits_remaining,amount,created_by) values
 ('d7000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001','private_credits',current_date,4,4,950,'d1000000-0000-4000-8000-000000000001');
set local role authenticated;
do $$declare r jsonb; retry jsonb; receipt uuid; refund_id uuid; k uuid:=gen_random_uuid(); sub uuid:='d7000000-0000-4000-8000-000000000001'; payload jsonb; denied boolean; begin
 perform set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
 payload:=jsonb_build_object('action','collect','subscription_id',sub,'amount',1000,'method','cash','key',k,'occurred_at',now(),'note','Change owed');
 r:=public.payments_command(payload);receipt:=(r->>'id')::uuid;
 if (r->>'paid')::numeric<>1000 or (r->>'balance')::numeric<>-50 or (r->>'remaining_debt')::numeric<>0 or (r->>'credit_balance')::numeric<>50 then raise exception 'Overpayment balances incorrect'; end if;
 if (select payment_status from public.subscriptions where id=sub)<>'paid' then raise exception 'Overpaid package must be paid';end if;
 retry:=public.payments_command(payload);
 if retry->>'id'<>r->>'id' or (select count(*) from public.manual_payments where subscription_id=sub)<>1 then raise exception 'Retry duplicated cash';end if;
 denied:=false;begin perform public.payments_command(payload||jsonb_build_object('amount',1001));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Changed idempotent payload accepted';end if;
 r:=public.payments_command(jsonb_build_object('action','refund','subscription_id',sub,'amount',50,'method','cash','key',gen_random_uuid(),'occurred_at',now(),'note','Return change'));
 refund_id:=(r->>'id')::uuid;
 if (r->>'balance')::numeric<>0 or (r->>'credit_balance')::numeric<>0 then raise exception 'Change return did not clear credit';end if;
 r:=public.payments_command(jsonb_build_object('action','reverse','subscription_id',sub,'entry_id',refund_id,'key',gen_random_uuid(),'occurred_at',now(),'note','Correct mistaken change return'));
 if (r->>'credit_balance')::numeric<>50 then raise exception 'Refund reversal must restore overpayment';end if;
 denied:=false;begin perform public.payments_command(jsonb_build_object('action','refund','subscription_id',sub,'amount',1001,'key',gen_random_uuid(),'occurred_at',now(),'note','Excess refund'));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Refund above cash held accepted';end if;
 perform set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000003',true);
 if (select balance from public.my_payment_balances() where subscription_id=sub)<>-50 then raise exception 'Student overpayment hidden';end if;
 perform set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000002',true);
 denied:=false;begin perform public.payments_command(payload||jsonb_build_object('key',gen_random_uuid()));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-center receipt accepted';end if;
 perform set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
 perform public.payments_command(jsonb_build_object('action','refund','subscription_id',sub,'amount',20,'key',gen_random_uuid(),'occurred_at',now(),'note','Partial return'));
 denied:=false;begin perform public.payments_command(jsonb_build_object('action','reverse','subscription_id',sub,'entry_id',receipt,'key',gen_random_uuid(),'occurred_at',now(),'note','Would make net negative'));exception when raise_exception then denied:=true;end;
 if not denied then raise exception 'Reversal above net cash accepted';end if;
 r:=public.payments_command(jsonb_build_object('action','refund','subscription_id',sub,'amount',980,'key',gen_random_uuid(),'occurred_at',now(),'note','Full return'));
 if (r->>'paid')::numeric<>0 or (r->>'balance')::numeric<>950 then raise exception 'Full refund incorrect';end if;
 if (select payment_status from public.subscriptions where id=sub)<>'refunded' then raise exception 'Full refund state incorrect';end if;
end;$$;
reset role;
rollback;
