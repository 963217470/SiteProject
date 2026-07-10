-- DB-004: article likes, favorites, and comments baseline.

begin;

create table if not exists public.article_likes (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

create table if not exists public.article_favorites (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_content_not_blank check (length(trim(content)) > 0),
  constraint comments_content_length_check check (length(content) <= 4000)
);

create index if not exists article_likes_user_created_idx
on public.article_likes (user_id, created_at desc);

create index if not exists article_favorites_user_created_idx
on public.article_favorites (user_id, created_at desc);

create index if not exists comments_article_created_idx
on public.comments (article_id, created_at, id);

create index if not exists comments_user_created_idx
on public.comments (user_id, created_at desc);

drop trigger if exists set_comments_updated_at on public.comments;
create trigger set_comments_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

alter table public.article_likes enable row level security;
alter table public.article_favorites enable row level security;
alter table public.comments enable row level security;

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

drop policy if exists "Readers can view article comments" on public.comments;
drop policy if exists "Users can create own comments" on public.comments;
drop policy if exists "Users can update own comments" on public.comments;
drop policy if exists "Users can delete own comments" on public.comments;
drop policy if exists "Admins can delete article comments" on public.comments;

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

create policy "Admins can delete article comments"
on public.comments for delete to authenticated
using (public.is_admin());

revoke all on table public.article_likes from anon, authenticated;
revoke all on table public.article_favorites from anon, authenticated;
revoke all on table public.comments from anon, authenticated;

grant select, insert, delete on table public.article_likes to authenticated;
grant select, insert, delete on table public.article_favorites to authenticated;
grant select on table public.comments to anon;
grant select, insert, update, delete on table public.comments to authenticated;

commit;
