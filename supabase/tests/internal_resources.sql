-- Run against a disposable Supabase database after migrations through
-- 202607100006_internal_resources.sql. The transaction always rolls back.

begin;

do $$
declare
  ordinary_user constant uuid := '70000000-0000-0000-0000-000000000001';
  member_user constant uuid := '70000000-0000-0000-0000-000000000002';
  admin_user constant uuid := '70000000-0000-0000-0000-000000000003';
  affected integer;
  bucket_public boolean;
  bucket_limit bigint;
begin
  insert into auth.users (id, aud, role, email, encrypted_password)
  values
    (ordinary_user, 'authenticated', 'authenticated', 'resources-user@example.invalid', ''),
    (member_user, 'authenticated', 'authenticated', 'resources-member@example.invalid', ''),
    (admin_user, 'authenticated', 'authenticated', 'resources-admin@example.invalid', '');

  update public.profiles set role = 'member' where id = member_user;
  update public.profiles set role = 'admin' where id = admin_user;

  select public, file_size_limit into bucket_public, bucket_limit
  from storage.buckets where id = 'resources';
  if bucket_public or bucket_limit <> 524288000 then
    raise exception 'resources bucket is not private with the expected limit';
  end if;

  insert into storage.objects (bucket_id, name, owner, metadata)
  values (
    'resources',
    admin_user::text || '/fixture.zip',
    admin_user,
    '{"mimetype":"application/zip","size":128}'::jsonb
  );

  insert into public.internal_resources (
    title, file_path, file_name, file_size, status, created_by
  ) values
    ('Published resource', admin_user::text || '/fixture.zip', 'fixture.zip', 128, 'published', admin_user),
    ('Archived resource', admin_user::text || '/archived.zip', 'archived.zip', 128, 'archived', admin_user);

  begin
    insert into public.internal_resources (
      title, file_path, file_name, file_size, created_by
    ) values ('Oversized', 'too-large.zip', 'too-large.zip', 524288001, admin_user);
    raise exception 'oversized resource metadata was allowed';
  exception when check_violation then null;
  end;

  perform set_config('request.jwt.claim.sub', ordinary_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  select count(*) into affected from public.internal_resources;
  if affected <> 0 then raise exception 'ordinary user viewed resource metadata'; end if;
  select count(*) into affected from storage.objects where bucket_id = 'resources';
  if affected <> 0 then raise exception 'ordinary user viewed resource files'; end if;

  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('resources', ordinary_user::text || '/forged.zip', ordinary_user);
    raise exception 'ordinary user uploaded a resource file';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', member_user::text, true);
  execute 'set local role authenticated';

  select count(*) into affected from public.internal_resources;
  if affected <> 1 then raise exception 'member metadata visibility expected 1, got %', affected; end if;
  select count(*) into affected from storage.objects where bucket_id = 'resources';
  if affected <> 1 then raise exception 'member file visibility expected 1, got %', affected; end if;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  execute 'set local role authenticated';

  insert into storage.objects (bucket_id, name, owner)
  values ('resources', admin_user::text || '/admin-upload.zip', admin_user);
  insert into public.internal_resources (
    title, file_path, file_name, file_size, created_by
  ) values (
    'Admin upload', admin_user::text || '/admin-upload.zip', 'admin-upload.zip', 256, admin_user
  );

  select count(*) into affected from public.internal_resources;
  if affected <> 3 then raise exception 'administrator could not view all resources'; end if;
end;
$$;

rollback;
