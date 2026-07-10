-- DB-002: profiles baseline.
-- This migration intentionally sorts before the Batch 1 security hardening
-- migration, which depends on public.profiles and its role values.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  full_name text,
  avatar_url text,
  bio text,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('user', 'member', 'admin'))
);

-- Historical setup scripts created profiles without bio. Keep the baseline
-- safe to apply before those scripts are retired.
alter table public.profiles add column if not exists bio text;

create unique index if not exists profiles_username_lower_uidx
on public.profiles (lower(username))
where username is not null;

create index if not exists profiles_role_idx on public.profiles (role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only administrators can change profile roles'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_update on public.profiles;
create trigger protect_profile_role_update
before update of role on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_username text := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'preferred_username'
  )), '');
begin
  begin
    insert into public.profiles (id, username, full_name, avatar_url)
    values (
      new.id,
      candidate_username,
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture'
      )), '')
    )
    on conflict (id) do nothing;
  exception when unique_violation then
    -- A provider username is not an identity key. Preserve account creation
    -- when another user already owns the same case-insensitive username.
    insert into public.profiles (id, full_name, avatar_url)
    values (
      new.id,
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture'
      )), '')
    )
    on conflict (id) do nothing;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "Anyone can view profiles" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can insert profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;

create policy "Anyone can view profiles"
on public.profiles for select
using (true);

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Admins can insert profiles"
on public.profiles for insert to authenticated
with check (public.is_admin());

create policy "Admins can update all profiles"
on public.profiles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;

commit;
