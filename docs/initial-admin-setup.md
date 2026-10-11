# Initial administrator setup

The application intentionally assigns ordinary sign-ups the `student` role. Do not add an admin role from browser code or public sign-up metadata.

The new StudioSaaS database currently has one Auth account and its profile is `student`. Until a trusted project owner promotes the intended owner account, member, subscription, lesson-planning and credit-adjustment screens remain restricted.

## Promote the intended owner account

1. Sign in to the Supabase dashboard for the **StudioSaaS** project.
2. Open SQL Editor and replace the email placeholder below with the exact email of the owner account you intend to administer the studio.
3. Run the block once. It should finish without an exception and report one updated profile in the SQL results/messages.

```sql
do $$
declare
  affected_rows integer;
begin
  update public.profiles as p
     set role = 'admin',
         updated_at = now()
    from auth.users as u
   where p.id = u.id
     and lower(u.email) = lower('replace-with-owner-email@example.com');

  get diagnostics affected_rows = row_count;

  if affected_rows <> 1 then
    raise exception 'Expected exactly one owner profile to be updated; updated % rows.', affected_rows;
  end if;

  raise notice 'Updated exactly one owner profile to admin.';

end
$$;
```

This is a trusted operator action and should be performed only for the owner account. Keep public signup defaulted to `student`; never expose a role-update operation to the browser. The existing RLS policies continue to restrict management writes to the admin role.

## Verify

After changing the role, sign out and sign in again. Open `/dashboard` and confirm the sidebar shows the management modules. Then test member creation, subscription creation, lesson status changes, attendance entries and the credit ledger with test data before using the system operationally.
