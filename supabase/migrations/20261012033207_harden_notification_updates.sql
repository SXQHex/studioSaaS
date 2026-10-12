begin;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
commit;
