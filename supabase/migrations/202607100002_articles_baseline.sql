-- DB-003: articles baseline.

begin;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  content text not null,
  cover_url text,
  tags text[] not null default '{}',
  status text not null default 'draft',
  visibility text not null default 'public',
  author_id uuid not null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  published_at timestamptz,
  reject_reason text,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  views_count integer not null default 0,
  kb_enabled boolean not null default false,
  kb_branch_id uuid,
  kb_sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete cascade,
  constraint articles_reviewed_by_fkey
    foreign key (reviewed_by) references public.profiles(id) on delete set null,
  constraint articles_title_not_blank check (length(trim(title)) > 0),
  constraint articles_content_not_blank check (length(trim(content)) > 0),
  constraint articles_status_check
    check (status in ('draft', 'pending', 'published', 'rejected')),
  constraint articles_visibility_check
    check (visibility in ('public', 'internal')),
  constraint articles_counts_nonnegative_check
    check (likes_count >= 0 and comments_count >= 0 and views_count >= 0),
  constraint articles_kb_sort_order_nonnegative_check check (kb_sort_order >= 0),
  constraint articles_internal_not_in_kb_check
    check (not (visibility = 'internal' and kb_enabled)),
  constraint articles_rejection_reason_check
    check (status <> 'rejected' or length(trim(coalesce(reject_reason, ''))) > 0),
  constraint articles_published_at_check
    check (status <> 'published' or published_at is not null)
);

create index if not exists articles_status_visibility_created_idx
on public.articles (status, visibility, created_at desc);

create index if not exists articles_author_status_created_idx
on public.articles (author_id, status, created_at desc);

create index if not exists articles_kb_branch_status_sort_idx
on public.articles (kb_branch_id, status, kb_enabled, kb_sort_order, created_at desc);

drop trigger if exists set_articles_updated_at on public.articles;
create trigger set_articles_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

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

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to anon, authenticated;

alter table public.articles enable row level security;

drop policy if exists "Public articles viewable by everyone" on public.articles;
drop policy if exists "Users can view own articles" on public.articles;
drop policy if exists "Members can view internal articles" on public.articles;
drop policy if exists "Admins can view all articles" on public.articles;
drop policy if exists "Authenticated users can create own articles" on public.articles;
drop policy if exists "Authors can update own articles" on public.articles;
drop policy if exists "Admins can update all articles" on public.articles;
drop policy if exists "Authors can delete own articles" on public.articles;
drop policy if exists "Admins can delete all articles" on public.articles;

create policy "Public articles viewable by everyone"
on public.articles for select
using (status = 'published' and visibility = 'public');

create policy "Users can view own articles"
on public.articles for select to authenticated
using (author_id = auth.uid());

create policy "Members can view internal articles"
on public.articles for select to authenticated
using (
  status = 'published'
  and visibility = 'internal'
  and public.is_member()
);

create policy "Admins can view all articles"
on public.articles for select to authenticated
using (public.is_admin());

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

create policy "Admins can update all articles"
on public.articles for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authors can delete own articles"
on public.articles for delete to authenticated
using (author_id = auth.uid() and status in ('draft', 'rejected'));

create policy "Admins can delete all articles"
on public.articles for delete to authenticated
using (public.is_admin());

revoke all on table public.articles from anon, authenticated;
grant select on table public.articles to anon, authenticated;
grant insert, update, delete on table public.articles to authenticated;

commit;
