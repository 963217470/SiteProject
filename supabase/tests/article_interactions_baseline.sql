-- Run against a disposable Supabase database after migrations through
-- 202607100003_article_interactions_baseline.sql. The transaction always rolls back.

begin;

do $$
declare
  user_a constant uuid := '40000000-0000-0000-0000-000000000001';
  user_b constant uuid := '40000000-0000-0000-0000-000000000002';
  admin_user constant uuid := '40000000-0000-0000-0000-000000000003';
  target_article_id uuid;
  hidden_target_id uuid;
  comment_id uuid;
  affected integer;
begin
  insert into auth.users (id, aud, role, email, encrypted_password)
  values
    (user_a, 'authenticated', 'authenticated', 'interactions-a@example.invalid', ''),
    (user_b, 'authenticated', 'authenticated', 'interactions-b@example.invalid', ''),
    (admin_user, 'authenticated', 'authenticated', 'interactions-admin@example.invalid', '');

  update public.profiles set role = 'admin' where id = admin_user;

  insert into public.articles (title, content, author_id, status, visibility, published_at)
  values ('Visible article', 'Temporary', user_a, 'published', 'public', now())
  returning id into target_article_id;

  insert into public.articles (title, content, author_id, status, visibility)
  values ('Hidden draft', 'Temporary', user_b, 'draft', 'public')
  returning id into hidden_target_id;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  insert into public.article_likes (article_id, user_id) values (target_article_id, user_a);
  insert into public.article_favorites (article_id, user_id) values (target_article_id, user_a);
  insert into public.comments (article_id, user_id, content)
  values (target_article_id, user_a, 'First comment') returning id into comment_id;

  begin
    insert into public.article_likes (article_id, user_id) values (target_article_id, user_a);
    raise exception 'duplicate like was allowed';
  exception when unique_violation then null;
  end;

  begin
    insert into public.article_favorites (article_id, user_id) values (target_article_id, user_a);
    raise exception 'duplicate favorite was allowed';
  exception when unique_violation then null;
  end;

  select count(*) into affected from public.article_likes
  where article_likes.article_id = target_article_id and user_id = user_a;
  if affected <> 1 then raise exception 'duplicate like changed stored row count'; end if;

  select count(*) into affected from public.article_favorites
  where article_favorites.article_id = target_article_id and user_id = user_a;
  if affected <> 1 then raise exception 'duplicate favorite changed stored row count'; end if;

  begin
    insert into public.article_likes (article_id, user_id) values (target_article_id, user_b);
    raise exception 'cross-user like was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.comments (article_id, user_id, content)
    values (hidden_target_id, user_a, 'Cannot see target');
    raise exception 'comment on inaccessible article was allowed';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  execute 'set local role authenticated';

  update public.comments set content = 'Forged edit' where id = comment_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'cross-user comment update was allowed'; end if;

  delete from public.article_likes where article_likes.article_id = target_article_id and user_id = user_a;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'cross-user like deletion was allowed'; end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  execute 'set local role authenticated';

  delete from public.comments where id = comment_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'administrator could not moderate comment'; end if;
end;
$$;

rollback;
