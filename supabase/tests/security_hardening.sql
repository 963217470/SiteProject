-- Run against a disposable database after 202607100001_security_hardening.sql.
-- The transaction always rolls back. Replace the UUIDs only if they collide.

begin;

do $$
declare
  user_a constant uuid := '10000000-0000-0000-0000-000000000001';
  user_b constant uuid := '10000000-0000-0000-0000-000000000002';
  user_admin constant uuid := '10000000-0000-0000-0000-000000000003';
  article_a uuid;
  comment_b uuid;
  affected integer;
begin
  insert into auth.users (id, aud, role, email, encrypted_password)
  values
    (user_a, 'authenticated', 'authenticated', 'security-a@example.invalid', ''),
    (user_b, 'authenticated', 'authenticated', 'security-b@example.invalid', ''),
    (user_admin, 'authenticated', 'authenticated', 'security-admin@example.invalid', '')
  on conflict (id) do nothing;

  insert into public.profiles (id, username, role)
  values
    (user_a, 'security-a', 'user'),
    (user_b, 'security-b', 'member'),
    (user_admin, 'security-admin', 'admin')
  on conflict (id) do update set role = excluded.role;

  insert into public.articles (title, content, author_id, status, visibility)
  values ('Security test', 'Temporary', user_a, 'draft', 'public')
  returning id into article_a;

  insert into public.article_likes (article_id, user_id) values (article_a, user_b);
  insert into public.article_favorites (article_id, user_id) values (article_a, user_b);
  insert into public.comments (article_id, user_id, content)
  values (article_a, user_b, 'temporary') returning id into comment_b;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';

  begin
    insert into public.articles (title, content, author_id, status, visibility)
    values ('Anonymous', 'Temporary', user_a, 'pending', 'public');
    raise exception 'expected anonymous article insertion to be rejected';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  begin
    update public.profiles set role = 'admin' where id = user_a;
    raise exception 'expected profile role escalation to be rejected';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.articles (title, content, author_id, status, visibility)
    values ('Impersonation', 'Temporary', user_b, 'pending', 'public');
    raise exception 'expected author impersonation to be rejected';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.articles (title, content, author_id, status, visibility)
    values ('Self publish', 'Temporary', user_a, 'published', 'public');
    raise exception 'expected self publishing to be rejected';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.article_likes (article_id, user_id) values (article_a, user_b);
    raise exception 'expected cross-user like to be rejected';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.article_favorites (article_id, user_id) values (article_a, user_b);
    raise exception 'expected cross-user favorite to be rejected';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.comments (article_id, user_id, content)
    values (article_a, user_b, 'forged');
    raise exception 'expected cross-user comment to be rejected';
  exception when insufficient_privilege then null;
  end;

  delete from public.article_likes where article_id = article_a and user_id = user_b;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'cross-user like deletion was allowed'; end if;

  delete from public.article_favorites where article_id = article_a and user_id = user_b;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'cross-user favorite deletion was allowed'; end if;

  delete from public.comments where id = comment_b;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'cross-user comment deletion was allowed'; end if;

  if public.is_member() then
    raise exception 'ordinary user unexpectedly has member access';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  if not public.is_member() then
    raise exception 'member was denied member access';
  end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', user_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  update public.profiles set role = 'member' where id = user_a;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'administrator could not change a role'; end if;
end;
$$;

rollback;
