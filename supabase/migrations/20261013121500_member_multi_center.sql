alter table public.members drop constraint if exists members_profile_id_key;
create unique index if not exists members_center_profile_unique on public.members(center_id, profile_id) where profile_id is not null;
