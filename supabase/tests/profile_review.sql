-- Run against a disposable Supabase database after migrations through
-- 202607100007_profile_review.sql. The transaction always rolls back.

begin;

do $$
declare
  user_a constant uuid := '80000000-0000-0000-0000-000000000001';
  user_b constant uuid := '80000000-0000-0000-0000-000000000002';
  admin_user constant uuid := '80000000-0000-0000-0000-000000000003';
  approval_id uuid;
  rejection_id uuid;
  current_name text;
  current_status text;
begin
  insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data)
  values
    (user_a, 'authenticated', 'authenticated', 'review-a@example.invalid', '', '{"user_name":"review-a"}'),
    (user_b, 'authenticated', 'authenticated', 'review-b@example.invalid', '', '{"user_name":"review-b"}'),
    (admin_user, 'authenticated', 'authenticated', 'review-admin@example.invalid', '', '{"user_name":"review-admin"}');

  update public.profiles set role = 'admin' where id = admin_user;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  insert into public.profile_changes (user_id, username, bio)
  values (user_a, 'review-a-updated', 'Updated bio') returning id into approval_id;

  insert into public.profile_changes (user_id, username)
  values (user_a, 'review-a-rejected') returning id into rejection_id;

  begin
    insert into public.profile_changes (user_id, username)
    values (user_b, 'forged-name');
    raise exception 'cross-user profile change was allowed';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.review_profile_change(approval_id, 'approved', null);
    raise exception 'ordinary user reviewed a profile change';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', admin_user::text, true);
  execute 'set local role authenticated';

  perform public.review_profile_change(approval_id, 'approved', 'Looks good');

  select username into current_name from public.profiles where id = user_a;
  select status into current_status from public.profile_changes where id = approval_id;
  if current_name <> 'review-a-updated' or current_status <> 'approved' then
    raise exception 'approved profile change was not applied atomically';
  end if;

  begin
    perform public.review_profile_change(approval_id, 'approved', null);
    raise exception 'profile change was reviewed twice';
  exception when no_data_found then null;
  end;

  perform public.review_profile_change(rejection_id, 'rejected', 'Not appropriate');
  select username into current_name from public.profiles where id = user_a;
  select status into current_status from public.profile_changes where id = rejection_id;
  if current_name <> 'review-a-updated' or current_status <> 'rejected' then
    raise exception 'rejected change modified profile or status is incorrect';
  end if;
end;
$$;

rollback;
