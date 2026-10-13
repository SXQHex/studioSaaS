-- Backfill legacy identities into scoped-role tables without changing active authorization.
-- Existing center_admins and profiles.role remain effective until a tested cutover.
insert into public.center_role_assignments(center_id, profile_id, role)
select ca.center_id, ca.profile_id, 'admin'
from public.center_admins ca
join public.profiles p on p.id = ca.profile_id
where p.role = 'admin'
on conflict do nothing;

insert into public.center_role_assignments(center_id, profile_id, role)
select distinct l.center_id, l.instructor_id, 'instructor'
from public.lessons l
join public.profiles p on p.id = l.instructor_id
where l.instructor_id is not null
on conflict do nothing;

insert into public.lesson_staff_assignments(lesson_id, profile_id, role)
select l.id, l.instructor_id, 'instructor'
from public.lessons l
where l.instructor_id is not null
on conflict do nothing;

-- Bootstrap organization ownership only from verified historical center administrators
-- who created that organization; never derive owner from public signup metadata.
insert into public.organization_role_assignments(organization_id, profile_id, role)
select o.id, o.created_by, 'owner'
from public.organizations o
where o.created_by is not null and exists (
  select 1 from public.centers c
  join public.center_admins ca on ca.center_id = c.id
  where c.organization_id = o.id and ca.profile_id = o.created_by
)
on conflict do nothing;
