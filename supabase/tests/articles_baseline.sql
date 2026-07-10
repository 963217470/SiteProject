-- Run against a disposable Supabase database after migrations through
-- 202607100002_articles_baseline.sql. The transaction always rolls back.

begin;

do $$
declare
  author_user constant uuid := '30000000-0000-0000-0000-000000000001';
  other_user constant uuid := '30000000-0000-0000-0000-000000000002';
  member_user constant uuid := '30000000-0000-0000-0000-000000000003';
  admin_user constant uuid := '30000000-0000-0000-0000-000000000004';
  draft_id uuid;
  public_id uuid;
  internal_id uuid;
  affected integer;
begin
  insert into auth.users (id, aud, role, email, encrypted_password)
  values
    (author_user, 'authenticated', 'authenticated', 'articles-author@example.invalid', ''),
    (other_user, 'authenticated', 'authenticated', 'articles-other@example.invalid', ''),
    (member_user, 'authenticated', 'authenticated', 'articles-member@example.invalid', ''),
    (admin_user, 'authenticated', 'authenticated', 'articles-admin@example.invalid', '');

  update public.profiles set role = 'member' where id = member_user;
  update public.profiles set role = 'admin' where id = admin_user;

  begin
    insert into public.articles (title, content, author_id)
    values ('   ', 'Denied blank title', author_user);
    raise exception 'blank article title was allowed';
  exception when check_violation then null;
  end;

  begin
    insert into public.articles (title, content, author_id, status)
    values ('Missing publish time', 'Denied invalid state', author_user, 'published');
    raise exception 'published article without published_at was allowed';
  exception when check_violation then null;
  end;

  insert into public.articles (title, content, author_id, status, visibility)
  values ('Draft', 'Temporary draft', author_user, 'draft', 'public') returning id into draft_id;

  insert into public.articles (
    title, content, author_id, status, visibility, published_at, reviewed_by, reviewed_at
  ) values (
    'Published public', 'Temporary public', author_user, 'published', 'public', now(), admin_user, now()
  ) returning id into public_id;

  insert into public.articles (
    title, content, author_id, status, visibility, published_at, reviewed_by, reviewed_at
  ) values (
    'Published internal', 'Temporary internal', author_user, 'published', 'internal', now(), admin_user, now()
  ) returning id into internal_id;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';

  select count(*) into affected from public.articles;
  if affected <> 1 then raise exception 'anonymous visibility expected 1 row, got %', affected; end if;

  begin
    insert into public.articles (title, content, author_id, status)
    values ('Anonymous', 'Denied', author_user, 'pending');
    raise exception 'anonymous article insertion was allowed';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', other_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into affected from public.articles;
  if affected <> 1 then raise exception 'ordinary visibility expected 1 row, got %', affected; end if;

  begin
    insert into public.articles (title, content, author_id, status)
    values ('Impersonation', 'Denied', author_user, 'pending');
    raise exception 'author impersonation was allowed';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', member_user::text, true);
  execute 'set local role authenticated';

  select count(*) into affected from public.articles;
  if affected <> 2 then raise exception 'member visibility expected 2 rows, got %', affected; end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', author_user::text, true);
  execute 'set local role authenticated';

  select count(*) into affected from public.articles;
  if affected <> 3 then raise exception 'author visibility expected 3 rows, got %', affected; end if;

  update public.articles set title = 'Updated draft' where id = draft_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'author could not update own draft'; end if;

  begin
    update public.articles set status = 'published', published_at = now() where id = draft_id;
    raise exception 'author self-publication was allowed';
  exception when insufficient_privilege then null;
  end;

  delete from public.articles where id = public_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'author deleted a published article'; end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  execute 'set local role authenticated';

  update public.articles
  set status = 'rejected', reject_reason = 'Needs revision', reviewed_by = admin_user, reviewed_at = now(), published_at = null
  where id = draft_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'administrator could not review article'; end if;
end;
$$;

rollback;
