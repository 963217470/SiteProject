-- DB-005: maintain article interaction counters atomically.

begin;

update public.articles as article
set
  likes_count = (
    select count(*)::integer from public.article_likes
    where article_likes.article_id = article.id
  ),
  comments_count = (
    select count(*)::integer from public.comments
    where comments.article_id = article.id
  );

create or replace function public.apply_article_interaction_count_delta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_article_id uuid := coalesce(new.article_id, old.article_id);
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  if tg_table_name = 'article_likes' then
    update public.articles
    set likes_count = greatest(0, likes_count + delta)
    where id = target_article_id;
  elsif tg_table_name = 'comments' then
    update public.articles
    set comments_count = greatest(0, comments_count + delta)
    where id = target_article_id;
  end if;

  return null;
end;
$$;

drop trigger if exists update_article_like_count on public.article_likes;
create trigger update_article_like_count
after insert or delete on public.article_likes
for each row execute function public.apply_article_interaction_count_delta();

drop trigger if exists update_article_comment_count on public.comments;
create trigger update_article_comment_count
after insert or delete on public.comments
for each row execute function public.apply_article_interaction_count_delta();

create or replace function public.protect_article_interaction_counts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and pg_trigger_depth() = 1
     and (
       new.likes_count is distinct from old.likes_count
       or new.comments_count is distinct from old.comments_count
     ) then
    raise exception 'Article interaction counts are maintained by database triggers'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_article_interaction_count_update on public.articles;
create trigger protect_article_interaction_count_update
before update of likes_count, comments_count on public.articles
for each row execute function public.protect_article_interaction_counts();

commit;
