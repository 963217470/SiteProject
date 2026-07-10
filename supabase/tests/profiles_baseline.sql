-- Run against a disposable Supabase database after
-- 202607100000_profiles_baseline.sql. The transaction always rolls back.

begin;

do $$
declare
  ordinary_user constant uuid := '20000000-0000-0000-0000-000000000001';
  admin_user constant uuid := '20000000-0000-0000-0000-000000000002';
  created_role text;
  created_name text;
  affected integer;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data)
  values (
    ordinary_user,
    'authenticated',
    'authenticated',
    'profiles-user@example.invalid',
    '',
    '{"user_name":"profiles-user","full_name":"Profiles User"}'::jsonb
  );

  select role, full_name into created_role, created_name
  from public.profiles where id = ordinary_user;

  if created_role <> 'user' or created_name <> 'Profiles User' then
    raise exception 'new auth user did not receive the expected profile';
  end if;

  insert into auth.users (id, aud, role, email, encrypted_password)
  values (admin_user, 'authenticated', 'authenticated', 'profiles-admin@example.invalid', '');
  update public.profiles set role = 'admin' where id = admin_user;

  perform set_config('request.jwt.claim.sub', ordinary_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  update public.profiles set bio = 'updated by owner' where id = ordinary_user;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'owner could not update own profile'; end if;

  begin
    update public.profiles set role = 'admin' where id = ordinary_user;
    raise exception 'owner unexpectedly changed own role';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  update public.profiles set role = 'member' where id = ordinary_user;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'administrator could not change a role'; end if;
end;
$$;

rollback;
