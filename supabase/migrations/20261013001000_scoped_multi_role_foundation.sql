-- Additive multi-role foundation. Existing profiles.role and RLS remain authoritative
-- until a separately tested application/RLS cutover.
-- Privileged writes are intentionally restricted to trusted database operators.
create table if not exists public.platform_role_assignments (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role = 'appowner'),
  created_at timestamptz not null default now(),
  primary key (profile_id, role)
);

create table if not exists public.organization_role_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role = 'owner'),
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id, role)
);
create index if not exists organization_role_assignments_profile_idx
  on public.organization_role_assignments (profile_id, organization_id);

create table if not exists public.center_role_assignments (
  center_id uuid not null references public.centers(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'instructor', 'ainstructor')),
  created_at timestamptz not null default now(),
  primary key (center_id, profile_id, role)
);
create index if not exists center_role_assignments_profile_idx
  on public.center_role_assignments (profile_id, center_id);

create table if not exists public.lesson_staff_assignments (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('instructor', 'ainstructor')),
  created_at timestamptz not null default now(),
  primary key (lesson_id, profile_id, role)
);
create index if not exists lesson_staff_assignments_profile_idx
  on public.lesson_staff_assignments (profile_id, lesson_id);

-- A student is connected to a class through a member enrollment. The existing
-- members table identifies the student's profile; enrollment is not a global role.
create table if not exists public.lesson_enrollments (
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lesson_id, member_id)
);
create index if not exists lesson_enrollments_member_idx
  on public.lesson_enrollments (member_id, lesson_id);

alter table public.platform_role_assignments enable row level security;
alter table public.organization_role_assignments enable row level security;
alter table public.center_role_assignments enable row level security;
alter table public.lesson_staff_assignments enable row level security;
alter table public.lesson_enrollments enable row level security;

-- No public API mutation rights: never trust role assignments from signup metadata.
revoke all on public.platform_role_assignments from public, anon, authenticated;
revoke all on public.organization_role_assignments from public, anon, authenticated;
revoke all on public.center_role_assignments from public, anon, authenticated;
revoke all on public.lesson_staff_assignments from public, anon, authenticated;
revoke all on public.lesson_enrollments from public, anon, authenticated;

-- Users can read their own role assignments for UI context, never assign roles.
grant select on public.platform_role_assignments to authenticated;
grant select on public.organization_role_assignments to authenticated;
grant select on public.center_role_assignments to authenticated;
grant select on public.lesson_staff_assignments to authenticated;
grant select on public.lesson_enrollments to authenticated;

create policy platform_roles_read_own on public.platform_role_assignments
  for select to authenticated using (profile_id = (select auth.uid()));
create policy organization_roles_read_own on public.organization_role_assignments
  for select to authenticated using (profile_id = (select auth.uid()));
create policy center_roles_read_own on public.center_role_assignments
  for select to authenticated using (profile_id = (select auth.uid()));
create policy lesson_staff_read_own on public.lesson_staff_assignments
  for select to authenticated using (profile_id = (select auth.uid()));
create policy lesson_enrollments_read_own on public.lesson_enrollments
  for select to authenticated using (
    exists (select 1 from public.members m where m.id = member_id and m.profile_id = (select auth.uid()))
  );

comment on table public.platform_role_assignments is 'Additive RBAC/ABAC foundation; legacy profiles.role stays authoritative until cutover.';
