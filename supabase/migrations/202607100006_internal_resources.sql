-- DB-007: private internal resources metadata and Storage policies.

begin;

create table if not exists public.internal_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  version text,
  file_url text,
  file_path text not null,
  file_name text not null,
  file_size bigint not null,
  status text not null default 'published',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_resources_title_not_blank check (length(trim(title)) > 0),
  constraint internal_resources_file_path_not_blank check (length(trim(file_path)) > 0),
  constraint internal_resources_file_name_not_blank check (length(trim(file_name)) > 0),
  constraint internal_resources_file_size_check
    check (file_size > 0 and file_size <= 524288000),
  constraint internal_resources_status_check check (status in ('published', 'archived'))
);

create index if not exists internal_resources_status_created_idx
on public.internal_resources (status, created_at desc);

create index if not exists internal_resources_created_by_created_idx
on public.internal_resources (created_by, created_at desc);

drop trigger if exists set_internal_resources_updated_at on public.internal_resources;
create trigger set_internal_resources_updated_at
before update on public.internal_resources
for each row execute function public.set_updated_at();

alter table public.internal_resources enable row level security;

create policy "Members can view published resources"
on public.internal_resources for select to authenticated
using (status = 'published' and public.is_member());

create policy "Admins can view all resources"
on public.internal_resources for select to authenticated
using (public.is_admin());

create policy "Admins can insert resources"
on public.internal_resources for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy "Admins can update resources"
on public.internal_resources for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete resources"
on public.internal_resources for delete to authenticated
using (public.is_admin());

revoke all on table public.internal_resources from anon, authenticated;
grant select, insert, update, delete on table public.internal_resources to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resources',
  'resources',
  false,
  524288000,
  array[
    'application/zip',
    'application/x-7z-compressed',
    'application/vnd.rar',
    'application/gzip',
    'application/x-tar',
    'application/pdf',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members can download resource files" on storage.objects;
drop policy if exists "Admins can upload resource files" on storage.objects;
drop policy if exists "Admins can manage resource files" on storage.objects;
drop policy if exists "Admins can delete resource files" on storage.objects;

create policy "Members can download resource files"
on storage.objects for select to authenticated
using (bucket_id = 'resources' and public.is_member());

create policy "Admins can upload resource files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'resources'
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Admins can manage resource files"
on storage.objects for update to authenticated
using (bucket_id = 'resources' and public.is_admin())
with check (bucket_id = 'resources' and public.is_admin());

create policy "Admins can delete resource files"
on storage.objects for delete to authenticated
using (bucket_id = 'resources' and public.is_admin());

commit;
