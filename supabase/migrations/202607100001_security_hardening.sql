-- Batch 1 security hardening.
-- Apply after the legacy schema scripts and before exposing write operations.

begin;

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

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role in ('member', 'admin')
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_member() from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_member() to anon, authenticated;

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

alter table public.profiles enable row level security;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can insert profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;

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

alter table public.articles enable row level security;
drop policy if exists "Members can create articles" on public.articles;
drop policy if exists "Allow anonymous users to create articles" on public.articles;
drop policy if exists "Anyone can create articles" on public.articles;
drop policy if exists "Authenticated users can create own articles" on public.articles;
drop policy if exists "Authors can update own articles" on public.articles;

create policy "Authenticated users can create own articles"
on public.articles for insert to authenticated
with check (
  auth.uid() is not null
  and author_id = auth.uid()
  and status in ('draft', 'pending')
);

create policy "Authors can update own articles"
on public.articles for update to authenticated
using (author_id = auth.uid())
with check (
  author_id = auth.uid()
  and status in ('draft', 'pending')
);

alter table public.article_likes enable row level security;
alter table public.comments enable row level security;
alter table public.article_favorites enable row level security;

delete from public.article_likes a
using public.article_likes b
where a.ctid < b.ctid
  and a.article_id = b.article_id
  and a.user_id = b.user_id;

create unique index if not exists article_likes_article_user_uidx
on public.article_likes(article_id, user_id);

drop policy if exists "Users can view own article likes" on public.article_likes;
drop policy if exists "Users can create own article likes" on public.article_likes;
drop policy if exists "Users can delete own article likes" on public.article_likes;

create policy "Users can view own article likes"
on public.article_likes for select to authenticated
using (user_id = auth.uid());

create policy "Users can create own article likes"
on public.article_likes for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.articles
    where articles.id = article_likes.article_id
  )
);

create policy "Users can delete own article likes"
on public.article_likes for delete to authenticated
using (user_id = auth.uid());

drop policy if exists "Readers can view article comments" on public.comments;
drop policy if exists "Users can create own comments" on public.comments;
drop policy if exists "Users can update own comments" on public.comments;
drop policy if exists "Users can delete own comments" on public.comments;

create policy "Readers can view article comments"
on public.comments for select
using (
  exists (
    select 1 from public.articles
    where articles.id = comments.article_id
  )
);

create policy "Users can create own comments"
on public.comments for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.articles
    where articles.id = comments.article_id
  )
);

create policy "Users can update own comments"
on public.comments for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.articles
    where articles.id = comments.article_id
  )
);

create policy "Users can delete own comments"
on public.comments for delete to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can view own article favorites" on public.article_favorites;
drop policy if exists "Users can create own article favorites" on public.article_favorites;
drop policy if exists "Users can delete own article favorites" on public.article_favorites;

create policy "Users can view own article favorites"
on public.article_favorites for select to authenticated
using (user_id = auth.uid());

create policy "Users can create own article favorites"
on public.article_favorites for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.articles
    where articles.id = article_favorites.article_id
  )
);

create policy "Users can delete own article favorites"
on public.article_favorites for delete to authenticated
using (user_id = auth.uid());

update storage.buckets
set public = false
where id = 'resources';

alter table public.internal_resources
alter column file_url drop not null;

drop policy if exists "Members can download resource files" on storage.objects;
drop policy if exists "Admins can upload resource files" on storage.objects;
drop policy if exists "Admins can manage resource files" on storage.objects;
drop policy if exists "Admins can delete resource files" on storage.objects;

create policy "Members can download resource files"
on storage.objects for select to authenticated
using (bucket_id = 'resources' and public.is_member());

create policy "Admins can upload resource files"
on storage.objects for insert to authenticated
with check (bucket_id = 'resources' and public.is_admin());

create policy "Admins can manage resource files"
on storage.objects for update to authenticated
using (bucket_id = 'resources' and public.is_admin())
with check (bucket_id = 'resources' and public.is_admin());

create policy "Admins can delete resource files"
on storage.objects for delete to authenticated
using (bucket_id = 'resources' and public.is_admin());

commit;
