-- Internal resources setup for RD STUDIO.
-- Run this file in Supabase SQL Editor before using the resource upload area.

create table if not exists public.internal_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  version text,
  file_url text not null,
  file_path text,
  file_name text,
  file_size bigint,
  status text not null default 'published' check (status in ('published', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_resources_status_created_idx
on public.internal_resources (status, created_at desc);

alter table public.internal_resources enable row level security;

drop policy if exists "Members can view published resources" on public.internal_resources;
drop policy if exists "Admins can view all resources" on public.internal_resources;
drop policy if exists "Admins can insert resources" on public.internal_resources;
drop policy if exists "Admins can update resources" on public.internal_resources;
drop policy if exists "Admins can delete resources" on public.internal_resources;

create policy "Members can view published resources"
on public.internal_resources
for select
using (
  status = 'published'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('member', 'admin')
  )
);

create policy "Admins can view all resources"
on public.internal_resources
for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "Admins can insert resources"
on public.internal_resources
for insert
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "Admins can update resources"
on public.internal_resources
for update
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "Admins can delete resources"
on public.internal_resources
for delete
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

grant select, insert, update, delete on public.internal_resources to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', false, 524288000)
on conflict (id) do update
set public = false,
    file_size_limit = 524288000;

alter table public.internal_resources
alter column file_url drop not null;

drop policy if exists "Members can download resource files" on storage.objects;
drop policy if exists "Admins can upload resource files" on storage.objects;
drop policy if exists "Admins can manage resource files" on storage.objects;
drop policy if exists "Admins can delete resource files" on storage.objects;

create policy "Members can download resource files"
on storage.objects
for select
using (
  bucket_id = 'resources'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('member', 'admin')
  )
);

create policy "Admins can upload resource files"
on storage.objects
for insert
with check (
  bucket_id = 'resources'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "Admins can manage resource files"
on storage.objects
for update
using (
  bucket_id = 'resources'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  bucket_id = 'resources'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create policy "Admins can delete resource files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'resources'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

select 'internal_resources table and resources bucket are ready' as status;
