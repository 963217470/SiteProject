-- Run against a disposable Supabase database after migrations through
-- 202607100004_atomic_interaction_counts.sql. The transaction always rolls back.

begin;

do $$
declare
  user_a constant uuid := '50000000-0000-0000-0000-000000000001';
  user_b constant uuid := '50000000-0000-0000-0000-000000000002';
  target_article_id uuid;
  draft_article_id uuid;
  like_count integer;
  comment_count integer;
  comment_a uuid;
begin
  insert into auth.users (id, aud, role, email, encrypted_password)
  values
    (user_a, 'authenticated', 'authenticated', 'counts-a@example.invalid', ''),
    (user_b, 'authenticated', 'authenticated', 'counts-b@example.invalid', '');

  insert into public.articles (title, content, author_id, status, visibility, published_at)
  values ('Counted article', 'Temporary', user_a, 'published', 'public', now())
  returning id into target_article_id;

  insert into public.articles (title, content, author_id, status, visibility)
  values ('Draft counters', 'Temporary', user_b, 'draft', 'public')
  returning id into draft_article_id;

  insert into public.article_likes (article_id, user_id)
  values (target_article_id, user_a), (target_article_id, user_b);

  insert into public.comments (article_id, user_id, content)
  values (target_article_id, user_a, 'First') returning id into comment_a;

  insert into public.comments (article_id, user_id, content)
  values (target_article_id, user_b, 'Second');

  select likes_count, comments_count into like_count, comment_count
  from public.articles where id = target_article_id;

  if like_count <> 2 or comment_count <> 2 then
    raise exception 'insert counters expected 2/2, got %/%', like_count, comment_count;
  end if;

  delete from public.article_likes
  where article_id = target_article_id and user_id = user_a;
  delete from public.comments where id = comment_a;

  select likes_count, comments_count into like_count, comment_count
  from public.articles where id = target_article_id;

  if like_count <> 1 or comment_count <> 1 then
    raise exception 'delete counters expected 1/1, got %/%', like_count, comment_count;
  end if;

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  begin
    update public.articles set likes_count = 99 where id = draft_article_id;
    raise exception 'direct interaction counter update was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
