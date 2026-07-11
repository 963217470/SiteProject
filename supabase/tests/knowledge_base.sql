-- Run against a disposable Supabase database after migrations through
-- 202607100005_knowledge_base.sql. The transaction always rolls back.

begin;

do $$
declare
  user_a constant uuid := '60000000-0000-0000-0000-000000000001';
  user_b constant uuid := '60000000-0000-0000-0000-000000000002';
  admin_user constant uuid := '60000000-0000-0000-0000-000000000003';
  article_a uuid;
  article_b uuid;
  request_a uuid;
  target_branch_id uuid;
  affected integer;
begin
  insert into auth.users (id, aud, role, email, encrypted_password)
  values
    (user_a, 'authenticated', 'authenticated', 'kb-a@example.invalid', ''),
    (user_b, 'authenticated', 'authenticated', 'kb-b@example.invalid', ''),
    (admin_user, 'authenticated', 'authenticated', 'kb-admin@example.invalid', '');

  update public.profiles set role = 'admin' where id = admin_user;

  insert into public.articles (title, content, author_id)
  values ('Knowledge A', 'Temporary', user_a) returning id into article_a;
  insert into public.articles (title, content, author_id)
  values ('Knowledge B', 'Temporary', user_b) returning id into article_b;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  insert into public.knowledge_branch_requests (article_id, requester_id, requested_path)
  values (article_a, user_a, 'programming/rendering') returning id into request_a;

  begin
    insert into public.knowledge_branch_requests (article_id, requester_id, requested_path)
    values (article_b, user_a, 'forged/request');
    raise exception 'request for another user article was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.knowledge_branches (name, slug, created_by)
    values ('Forged branch', 'forged-branch', user_a);
    raise exception 'ordinary user created a knowledge branch';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  execute 'set local role authenticated';

  select count(*) into affected from public.knowledge_branch_requests;
  if affected <> 0 then raise exception 'user viewed another user branch request'; end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  execute 'set local role authenticated';

  insert into public.knowledge_branches (name, slug, created_by)
  values ('Programming', 'programming', admin_user) returning id into target_branch_id;

  update public.articles
  set kb_enabled = true, kb_branch_id = target_branch_id
  where id = article_a;

  update public.knowledge_branch_requests
  set status = 'approved', reviewed_by = admin_user, reviewed_at = now()
  where id = request_a;

  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'administrator could not approve branch request'; end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  execute 'set local role authenticated';

  begin
    insert into public.knowledge_branch_requests (article_id, requester_id, requested_path)
    values (article_b, user_b, 'pending/one'), (article_b, user_b, 'pending/two');
    raise exception 'multiple pending requests for one article were allowed';
  exception when unique_violation then null;
  end;
end;
$$;

rollback;
